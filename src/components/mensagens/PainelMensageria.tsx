import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquarePlus, Send, Users, User as UserIcon, AtSign, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useConversas, Conversa } from "@/hooks/useConversas";
import { useMensagens } from "@/hooks/useMensagens";
import { NovaConversaDialog } from "./NovaConversaDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  /** Quando informado, restringe a lista a conversas vinculadas a este cliente. */
  clienteId?: string | null;
  nomeCliente?: string;
  /** Altura do painel. Padrão: 70vh */
  height?: string;
}

export function PainelMensageria({ clienteId, nomeCliente, height = "70vh" }: Props) {
  const { user } = useAuth();
  const { members, orgId } = useOrgMembers();
  const { conversas, loading, marcarComoLida, reload } = useConversas({ clienteId });
  const [params, setParams] = useSearchParams();
  const [ativoId, setAtivoId] = useState<string | null>(params.get("c"));
  const [novaOpen, setNovaOpen] = useState(false);

  const nomePorId = useMemo(
    () => new Map((members || []).map((m) => [m.user_id, m.nome || "Membro"])),
    [members]
  );

  // Quando lista muda, ajusta ativo
  useEffect(() => {
    if (!ativoId && conversas.length > 0) setAtivoId(conversas[0].id);
    if (ativoId && conversas.length > 0 && !conversas.find((c) => c.id === ativoId)) {
      setAtivoId(conversas[0].id);
    }
  }, [conversas, ativoId]);

  // Marca como lida quando troca de conversa
  useEffect(() => {
    if (ativoId) {
      marcarComoLida(ativoId);
      if (!clienteId) setParams({ c: ativoId }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativoId]);

  const ativa = conversas.find((c) => c.id === ativoId) || null;

  const tituloConversa = (c: Conversa) => {
    if (c.titulo) return c.titulo;
    if (c.tipo === "direta") {
      const outro = (c.membros || []).find((m) => m.user_id !== user?.id);
      return outro ? nomePorId.get(outro.user_id) || "Conversa" : "Conversa";
    }
    return "Conversa em grupo";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3 border rounded-xl overflow-hidden bg-card" style={{ height }}>
      {/* Lista */}
      <div className="border-r flex flex-col bg-background/40">
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Conversas</h3>
          <Button size="sm" variant="ghost" onClick={() => setNovaOpen(true)} title="Nova conversa">
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="p-4 text-xs text-muted-foreground">Carregando...</p>}
          {!loading && conversas.length === 0 && (
            <div className="p-6 text-center">
              <MessageSquarePlus className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma conversa ainda.</p>
              <Button size="sm" variant="link" onClick={() => setNovaOpen(true)}>Criar a primeira</Button>
            </div>
          )}
          {conversas.map((c) => {
            const Icon = c.tipo === "grupo" ? Users : UserIcon;
            const isActive = c.id === ativoId;
            return (
              <button
                key={c.id}
                onClick={() => setAtivoId(c.id)}
                className={`w-full text-left px-3 py-2.5 border-b text-sm transition-colors ${
                  isActive ? "bg-accent/10" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate flex-1">{tituloConversa(c)}</span>
                  {(c.nao_lidas || 0) > 0 && (
                    <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full font-semibold">
                      {c.nao_lidas}
                    </span>
                  )}
                </div>
                {c.ultima_mensagem_preview && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5 pl-5">{c.ultima_mensagem_preview}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread */}
      <div className="flex flex-col min-w-0">
        {ativa ? (
          <ThreadView conversa={ativa} nomePorId={nomePorId} orgId={orgId} userId={user?.id || ""} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Selecione uma conversa
          </div>
        )}
      </div>

      <NovaConversaDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        contexto={clienteId ? { cliente_id: clienteId, nomeCliente } : undefined}
        onCreated={async (id) => {
          setAtivoId(id);
          await reload();
          // valida visibilidade pós-POST consultando direto o banco —
          // se a conversa criada não puder ser lida via RLS, avisa o usuário.
          try {
            const { data, error } = await supabase
              .from("conversas")
              .select("id")
              .eq("id", id)
              .maybeSingle();
            if (error) {
              // eslint-disable-next-line no-console
              console.error("[mensageria:pos-criacao] erro ao validar visibilidade", error);
              toast.error("Conversa criada, mas não foi possível confirmar visibilidade (RLS).");
            } else if (!data) {
              // eslint-disable-next-line no-console
              console.warn("[mensageria:pos-criacao] conversa invisível após POST 201", { id });
              toast.error("Conversa criada, mas não está visível para você (RLS de SELECT).");
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[mensageria:pos-criacao] exceção", err);
          }
        }}
      />
    </div>
  );
}

function ThreadView({
  conversa,
  nomePorId,
  orgId,
  userId,
}: {
  conversa: Conversa;
  nomePorId: Map<string, string>;
  orgId: string | null;
  userId: string;
}) {
  const { mensagens, enviar, excluir } = useMensagens(conversa.id);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mostrarMencoes, setMostrarMencoes] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  const handleEnviar = async () => {
    if (!orgId || !texto.trim()) return;
    setEnviando(true);
    try {
      // detecta menções "@Nome" simples — mapeia para user_ids dos membros da conversa
      const mencoes: string[] = [];
      for (const m of conversa.membros || []) {
        const nome = nomePorId.get(m.user_id) || "";
        const primeiro = nome.split(" ")[0];
        if (primeiro && new RegExp(`@${primeiro}\\b`, "i").test(texto)) {
          mencoes.push(m.user_id);
        }
      }
      await enviar({ organizacao_id: orgId, conteudo: texto, mencoes });
      setTexto("");
    } finally {
      setEnviando(false);
    }
  };

  const insertMencao = (nome: string) => {
    const primeiro = nome.split(" ")[0];
    setTexto((t) => `${t}${t.endsWith(" ") || t === "" ? "" : " "}@${primeiro} `);
    setMostrarMencoes(false);
  };

  const tituloHeader = conversa.titulo ||
    (conversa.tipo === "direta"
      ? nomePorId.get((conversa.membros || []).find((m) => m.user_id !== userId)?.user_id || "") || "Conversa"
      : "Conversa em grupo");

  const outrosMembros = (conversa.membros || []).filter((m) => m.user_id !== userId);

  return (
    <>
      <div className="px-4 py-3 border-b">
        <p className="text-sm font-semibold">{tituloHeader}</p>
        <p className="text-xs text-muted-foreground">
          {(conversa.membros || []).length} participante{(conversa.membros || []).length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {mensagens.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">Sem mensagens. Diga olá!</p>
        )}
        {mensagens.map((m) => {
          const meu = m.autor_id === userId;
          const autor = nomePorId.get(m.autor_id) || "Membro";
          return (
            <div key={m.id} className={`flex ${meu ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                  meu ? "bg-accent text-accent-foreground" : "bg-background border"
                }`}
              >
                {!meu && <p className="text-[11px] font-semibold opacity-80 mb-0.5">{autor}</p>}
                <p className={`whitespace-pre-wrap break-words ${m.excluida_em ? "italic opacity-60" : ""}`}>
                  {m.conteudo}
                </p>
                <div className="flex items-center gap-2 mt-1 opacity-70">
                  <span className="text-[10px]">{format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  {meu && !m.excluida_em && (
                    <button onClick={() => excluir(m.id)} title="Excluir" className="hover:opacity-100">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t p-3 space-y-2 relative bg-card">
        {mostrarMencoes && outrosMembros.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-background border rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {outrosMembros.map((m) => (
              <button
                key={m.user_id}
                onClick={() => insertMencao(nomePorId.get(m.user_id) || "")}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
              >
                @{(nomePorId.get(m.user_id) || "").split(" ")[0]}
                <span className="text-xs text-muted-foreground ml-2">{nomePorId.get(m.user_id)}</span>
              </button>
            ))}
          </div>
        )}
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma mensagem... (use @ para mencionar)"
          className="min-h-[60px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleEnviar();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={() => setMostrarMencoes((v) => !v)}>
            <AtSign className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={handleEnviar} disabled={enviando || !texto.trim()}>
            <Send className="w-4 h-4 mr-1" /> Enviar
          </Button>
        </div>
      </div>
    </>
  );
}