import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Sparkles, Paperclip, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { upsertClienteFromLaudo } from "@/lib/upsertCliente";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Attachment = {
  name: string;
  size: number;
  storagePath: string;
  bucket: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
};

interface LaudoChatPanelProps {
  laudoId: string | null;
  nomeCliente?: string;
  onDadosExtraidos?: (dados: Record<string, any>) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-laudo`;

const SUGESTOES_INICIAIS = [
  "Preciso fazer um laudo de perda de safra de soja",
  "Laudo de capacidade de pagamento para renegociação",
  "Produtor teve quebra de safra por estiagem severa",
];

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export function LaudoChatPanel({ laudoId, nomeCliente, onDadosExtraidos: _onDadosExtraidos }: LaudoChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load existing conversation
  useEffect(() => {
    if (!laudoId) return;
    const load = async () => {
      const { data } = await supabase
        .from("laudo_conversas" as any)
        .select("*")
        .eq("laudo_id", laudoId)
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
          attachments: m.metadata?.attachments || undefined,
        })));
      }
    };
    load();
  }, [laudoId]);

  const saveMessage = useCallback(async (role: string, content: string, attachments?: Attachment[]) => {
    if (!laudoId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("laudo_conversas" as any).insert({
      laudo_id: laudoId,
      user_id: user.id,
      role,
      content,
      metadata: attachments ? { attachments } : {},
    });
  }, [laudoId]);

  // Upload files to both laudos bucket AND cliente-drive
  const uploadFiles = useCallback(async (files: File[]): Promise<Attachment[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || files.length === 0) return [];

    setUploading(true);
    const attachments: Attachment[] = [];

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const timestamp = Date.now();

      // 1. Upload to laudos bucket (for laudo context)
      if (laudoId) {
        const laudoPath = `${user.id}/${laudoId}/${timestamp}_${safeName}`;
        const { error: laudoErr } = await supabase.storage.from("laudos").upload(laudoPath, file);
        if (laudoErr) {
          console.error("Erro upload laudos:", laudoErr);
        } else {
          // Register in documentos table
          await supabase.from("documentos").insert({
            laudo_id: laudoId,
            user_id: user.id,
            nome_arquivo: file.name,
            storage_path: laudoPath,
            tamanho_bytes: file.size,
            categoria: "chat_upload",
          });
        }
      }

      // 2. Upload to cliente-drive (for client's drive)
      const clientName = nomeCliente || "Sem_Cliente";
      const drivePath = `${user.id}/${clientName.replace(/\s+/g, "_")}/${timestamp}_${safeName}`;
      const { error: driveErr } = await supabase.storage.from("cliente-drive").upload(drivePath, file);
      if (driveErr) {
        console.error("Erro upload drive:", driveErr);
        toast.error(`Erro ao salvar ${file.name} no drive`);
      } else {
        // Register in arquivos_cliente
        await supabase.from("arquivos_cliente").insert({
          user_id: user.id,
          nome_cliente: clientName,
          nome_arquivo: file.name,
          storage_path: drivePath,
          tamanho_bytes: file.size,
          pasta: "Geral",
        });
      }

      attachments.push({
        name: file.name,
        size: file.size,
        storagePath: drivePath,
        bucket: "cliente-drive",
      });
    }

    setUploading(false);
    return attachments;
  }, [laudoId, nomeCliente]);

  const streamChat = async (userMessage: string, attachments?: Attachment[]) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
      attachments,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setInput("");
    setPendingFiles([]);

    // Save user message
    await saveMessage("user", userMessage, attachments);

    // Auto-create client record if we have a name
    if (nomeCliente) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        upsertClienteFromLaudo(authData.user.id, { nome: nomeCliente });
      }
    }

    // Build content with attachment info
    let fullContent = userMessage;
    if (attachments && attachments.length > 0) {
      const fileList = attachments.map(a => `📎 ${a.name} (${formatSize(a.size)})`).join("\n");
      fullContent = `${userMessage}\n\n[Arquivos anexados e salvos no Drive do cliente:\n${fileList}]`;
    }

    const chatMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
    chatMessages.push({ role: "user", content: fullContent });

    let assistantContent = "";
    const assistantId = crypto.randomUUID();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: chatMessages,
          laudoId,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro na comunicação" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("Sem resposta do servidor");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ") && !line.startsWith("event:")) continue;
          if (line.startsWith("event:")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "content_block_delta") {
              const delta = parsed.delta?.text;
              if (delta) { assistantContent += delta; updateAssistantMessage(assistantId, assistantContent); }
            } else if (parsed.choices?.[0]?.delta?.content) {
              assistantContent += parsed.choices[0].delta.content;
              updateAssistantMessage(assistantId, assistantContent);
            } else if (parsed.type === "message_stop") { streamDone = true; break; }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final buffer flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              assistantContent += parsed.delta.text;
            } else if (parsed.choices?.[0]?.delta?.content) {
              assistantContent += parsed.choices[0].delta.content;
            }
          } catch {}
        }
        if (assistantContent) updateAssistantMessage(assistantId, assistantContent);
      }

      if (assistantContent) await saveMessage("assistant", assistantContent);

    } catch (error: any) {
      console.error("Chat error:", error);
      toast.error(error.message || "Erro ao comunicar com a IA");
      if (!assistantContent) setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  };

  const updateAssistantMessage = (id: string, content: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && last.id === id) {
        return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
      }
      return [...prev, { id, role: "assistant" as const, content, timestamp: new Date() }];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pendingFiles.length === 0) || isStreaming || uploading) return;

    let attachments: Attachment[] | undefined;
    if (pendingFiles.length > 0) {
      attachments = await uploadFiles(pendingFiles);
      if (attachments.length > 0) {
        toast.success(`${attachments.length} arquivo(s) salvos no Drive do cliente`);
      }
    }

    const msg = input.trim() || `Enviei ${attachments?.length || 0} arquivo(s) para análise`;
    streamChat(msg, attachments && attachments.length > 0 ? attachments : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestion = (text: string) => {
    if (isStreaming) return;
    streamChat(text);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Assistente de Laudos</h3>
          <p className="text-xs text-muted-foreground">
            {nomeCliente
              ? `Cliente: ${nomeCliente} · Arquivos salvos no Drive`
              : "Descreva o caso e eu gero o laudo pra você"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Bot className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-foreground mb-1">Como posso ajudar?</h4>
              <p className="text-sm text-muted-foreground max-w-md">
                Me conte sobre o caso do produtor — nome, município, cultura, o que aconteceu — e eu monto o laudo automaticamente.
                Você também pode anexar contratos e documentos.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGESTOES_INICIAIS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="px-3 py-2 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-accent/20 hover:text-accent transition-all border border-border"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-accent/20 text-accent"
            }`}>
              {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={`max-w-[80%] space-y-2`}>
              <div className={`rounded-xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-foreground border border-border"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {/* Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                      <FileText className="w-3 h-3 text-accent" />
                      <span className="truncate max-w-[120px]">{att.name}</span>
                      <span className="text-[10px]">({formatSize(att.size)})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="bg-muted/50 border border-border rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-muted/10 flex flex-wrap gap-2">
          {pendingFiles.map((file, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs">
              <FileText className="w-3 h-3 text-accent" />
              <span className="truncate max-w-[120px]">{file.name}</span>
              <button onClick={() => removePendingFile(i)} className="text-muted-foreground hover:text-destructive ml-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border bg-muted/20">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic,.txt,.csv"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || uploading}
            className="h-11 w-11 rounded-xl border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent/50 disabled:opacity-40 transition-all flex-shrink-0"
            title="Anexar arquivo (salvo no Drive do cliente)"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Descreva o caso do produtor..."
              rows={1}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-muted-foreground"
              style={{ maxHeight: "120px" }}
              disabled={isStreaming}
            />
          </div>
          <button
            type="submit"
            disabled={(!input.trim() && pendingFiles.length === 0) || isStreaming || uploading}
            className="h-11 w-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center hover:shadow-md disabled:opacity-40 transition-all flex-shrink-0"
          >
            {isStreaming || uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
