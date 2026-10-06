import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { LifeBuoy, Loader2, Plus, Send, Sparkles, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePortalCliente } from "@/hooks/usePortalCliente";
import { cn } from "@/lib/utils";

type Acao = { tipo: "chamado_aberto"; chamado_id: string; titulo: string } | { tipo: string; [k: string]: unknown };
type Msg = { role: "user" | "assistant"; content: string; acoes?: Acao[] };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/olivia-portal`;

const SUGESTOES = [
  "Como está meu processo?",
  "Qual o próximo vencimento dos meus contratos?",
  "Recebi uma carta do banco, o que faço?",
  "Quero falar com alguém da equipe",
];

/**
 * OlivIA do PORTAL: assistente do cliente. Fala só sobre o que o cliente
 * enxerga no portal (função `olivia-portal`, separada da OlivIA interna).
 * Única ação que ela executa: abrir um chamado para a equipe.
 */
export function PortalOlivia({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const { invalidar } = usePortalCliente();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, carregando]);

  useEffect(() => {
    if (aberta) setTimeout(() => inputRef.current?.focus(), 150);
  }, [aberta]);

  function novaConversa() {
    setMsgs([]);
    setConversaId(null);
  }

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || carregando) return;
    const proximos: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs([...proximos, { role: "assistant", content: "", acoes: [] }]);
    setInput("");
    setCarregando(true);

    try {
      let { data: sess } = await supabase.auth.getSession();
      let token = sess?.session?.access_token;
      if (!token) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed?.session?.access_token;
      }
      if (!token) throw new Error("Sua sessão expirou. Entre de novo para conversar com a OlivIA.");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          conversa_id: conversaId,
          user_message: t,
          messages: proximos.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (resp.status === 401) throw new Error("Sua sessão expirou. Entre de novo para continuar.");
      if (resp.status === 429) throw new Error("Muitas mensagens seguidas. Aguarde alguns segundos e tente de novo.");
      if (!resp.ok || !resp.body) {
        let detalhe = "";
        try { detalhe = (await resp.json())?.error || ""; } catch { /* noop */ }
        throw new Error(detalhe || "A OlivIA está indisponível agora. Tente de novo em instantes ou abra um chamado.");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acumulado = "";
      const acoes: Acao[] = [];

      const atualiza = (patch: Partial<Msg>) =>
        setMsgs((prev) => {
          const arr = [...prev];
          arr[arr.length - 1] = { ...arr[arr.length - 1], ...patch };
          return arr;
        });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let evento = "message";
          let payload = "";
          for (const ln of raw.split("\n")) {
            if (ln.startsWith("event: ")) evento = ln.slice(7).trim();
            else if (ln.startsWith("data: ")) payload += ln.slice(6);
          }
          if (!payload) continue;
          let parsed: any;
          try { parsed = JSON.parse(payload); } catch { continue; }
          if (evento === "token") {
            acumulado += parsed.text || "";
            atualiza({ content: acumulado });
          } else if (evento === "meta") {
            if (parsed.conversa_id) setConversaId(parsed.conversa_id);
          } else if (evento === "action") {
            acoes.push(parsed);
            atualiza({ acoes: [...acoes] });
            if (parsed.tipo === "chamado_aberto") invalidar("chamados");
          } else if (evento === "error") {
            throw new Error(parsed.error || "Erro na OlivIA");
          }
        }
      }
      if (!acumulado.trim()) {
        atualiza({ content: "Não consegui responder agora. Se preferir, abra um chamado e a equipe responde." });
      }
    } catch (e: any) {
      setMsgs((prev) => {
        const arr = [...prev];
        arr[arr.length - 1] = { role: "assistant", content: e?.message || "Erro ao falar com a OlivIA." };
        return arr;
      });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Sheet open={aberta} onOpenChange={(o) => { if (!o) onFechar(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">OlivIA, assistente do portal</SheetTitle>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-primary text-primary-foreground">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex-1 leading-tight">
            <p className="text-sm font-semibold">OlivIA</p>
            <p className="text-[11px] text-primary-foreground/70">Assistente do escritório · responde sobre o seu caso</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={novaConversa} title="Nova conversa">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={onFechar} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background">
          {msgs.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl rounded-tl-sm bg-card border border-border p-3 text-sm text-foreground">
                Olá! Eu sou a OlivIA. Posso explicar o andamento dos seus processos, os vencimentos dos seus contratos
                e o que fazer quando o banco entrar em contato. Se precisar de alguém da equipe, eu abro um chamado para você.
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void enviar(s)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-accent hover:text-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-tl-sm",
                )}
              >
                {m.role === "assistant" ? (
                  <>
                    {m.content ? (
                      <div className="max-w-none text-foreground [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:my-1.5 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-semibold">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      carregando && i === msgs.length - 1 && (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> pensando…
                        </span>
                      )
                    )}
                    {(m.acoes || []).map((a, j) =>
                      a.tipo === "chamado_aberto" ? (
                        <Link
                          key={j}
                          to={`/portal/chamados/${(a as any).chamado_id}`}
                          onClick={onFechar}
                          className="mt-2 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent/20"
                        >
                          <LifeBuoy className="h-3.5 w-3.5 text-accent" />
                          Chamado aberto: {(a as any).titulo}. Ver chamado
                        </Link>
                      ) : null,
                    )}
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void enviar(input); }}
          className="border-t border-border bg-card px-3 py-3 flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(input); }
            }}
            rows={1}
            placeholder="Escreva sua pergunta…"
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring max-h-32"
          />
          <Button type="submit" size="icon" disabled={carregando || !input.trim()} className="h-10 w-10 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        <p className="px-4 pb-3 text-[10px] text-muted-foreground bg-card">
          A OlivIA orienta com base no que está registrado no seu caso. Decisões e prazos são confirmados pela equipe.
        </p>
      </SheetContent>
    </Sheet>
  );
}
