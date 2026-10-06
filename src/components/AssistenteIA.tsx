import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Send, X, Loader2, ArrowRight, History, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Acao = { tipo: string; rota?: string; motivo?: string; ferramenta?: string; detalhe?: string };
type Fonte = { id?: string; titulo?: string | null; categoria?: string | null; fonte?: string | null; similarity?: number };
type Msg = { role: "user" | "assistant"; content: string; acoes?: Acao[]; fontes?: Fonte[] };
type Conversa = { id: string; titulo: string; updated_at: string };

const SUGESTOES = [
  "Quantos laudos temos no total?",
  "Vencimentos dos próximos 15 dias",
  "Crie uma tarefa de retorno para amanhã",
  "Métricas dos últimos 30 dias",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistente-ia`;
const BRIEFING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/olivia-briefing`;

export function AssistenteIA() {
  const askConfirm = useConfirm();
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [vendoHistorico, setVendoHistorico] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [briefing, setBriefing] = useState<any | null>(null);
  const [carregandoBriefing, setCarregandoBriefing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, carregando]);

  useEffect(() => {
    if (aberto && vendoHistorico) void carregarConversas();
  }, [aberto, vendoHistorico]);

  // Carrega o briefing do dia ao abrir o chat com conversa vazia
  useEffect(() => {
    if (!aberto || vendoHistorico || msgs.length > 0 || briefing || carregandoBriefing) return;
    setCarregandoBriefing(true);
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) return;
        const r = await fetch(BRIEFING_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        if (r.ok) setBriefing(await r.json());
      } catch { /* silencioso */ }
      finally { setCarregandoBriefing(false); }
    })();
  }, [aberto, vendoHistorico, msgs.length, briefing, carregandoBriefing]);

  if (!user) return null;

  async function carregarConversas() {
    const { data } = await (supabase as any).from("olivia_conversas")
      .select("id, titulo, updated_at").order("updated_at", { ascending: false }).limit(30);
    setConversas(data || []);
  }

  async function abrirConversa(id: string) {
    setConversaId(id);
    setVendoHistorico(false);
    const { data } = await (supabase as any).from("olivia_mensagens")
      .select("role, content, acoes").eq("conversa_id", id).order("created_at");
    setMsgs((data || []).map((m: any) => ({ role: m.role, content: m.content, acoes: m.acoes || [], fontes: [] })));
  }

  async function excluirConversa(id: string) {
    if (!(await askConfirm({ title: "Excluir conversa", description: "Excluir esta conversa?", destructive: true, confirmText: "Excluir" }))) return;
    await (supabase as any).from("olivia_conversas").delete().eq("id", id);
    setConversas(prev => prev.filter(c => c.id !== id));
    if (conversaId === id) { setMsgs([]); setConversaId(null); }
  }

  function novaConversa() {
    setMsgs([]);
    setConversaId(null);
    setVendoHistorico(false);
    setBriefing(null);
  }

  async function enviar(texto: string) {
    if (!texto.trim() || carregando) return;
    const novoUser: Msg = { role: "user", content: texto };
    const proximos = [...msgs, novoUser];
    setMsgs(proximos);
    setInput("");
    setCarregando(true);

    // adiciona placeholder do assistente que será preenchido pelo streaming
    setMsgs(prev => [...prev, { role: "assistant", content: "", acoes: [], fontes: [] }]);

    try {
      let { data: sess } = await supabase.auth.getSession();
      let token = sess?.session?.access_token;
      // Tenta renovar se não há sessão válida (token expirado ou removido)
      if (!token) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed?.session?.access_token;
      }
      if (!token) {
        throw new Error("Sua sessão expirou. Faça login novamente para conversar com a Olívia.");
      }
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          rota_atual: location.pathname,
          conversa_id: conversaId,
          user_message: texto,
          messages: proximos.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (resp.status === 401) {
        throw new Error("Sua sessão expirou. Faça login novamente para continuar conversando com a Olívia.");
      }
      if (resp.status === 429) {
        throw new Error("Muitas mensagens em sequência. Aguarde alguns segundos e tente novamente.");
      }
      if (resp.status === 402) {
        throw new Error("Créditos de IA esgotados. Avise o administrador para adicionar créditos no workspace.");
      }
      if (!resp.ok || !resp.body) {
        let detalhe = "";
        try { detalhe = (await resp.json())?.error || ""; } catch { /* noop */ }
        throw new Error(detalhe || `A Olívia está temporariamente indisponível (HTTP ${resp.status}). Tente novamente em instantes.`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let textoAcum = "";
      const acoesAcum: Acao[] = [];
      let fontesAcum: Fonte[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const linhas = raw.split("\n");
          let evento = "message";
          let payload = "";
          for (const ln of linhas) {
            if (ln.startsWith("event: ")) evento = ln.slice(7).trim();
            else if (ln.startsWith("data: ")) payload += ln.slice(6);
          }
          if (!payload) continue;
          try {
            const parsed = JSON.parse(payload);
            if (evento === "token") {
              textoAcum += parsed.text || "";
              setMsgs(prev => {
                const arr = [...prev];
                arr[arr.length - 1] = { ...arr[arr.length - 1], content: textoAcum };
                return arr;
              });
            } else if (evento === "action") {
              acoesAcum.push(parsed);
              setMsgs(prev => {
                const arr = [...prev];
                arr[arr.length - 1] = { ...arr[arr.length - 1], acoes: [...acoesAcum] };
                return arr;
              });
            } else if (evento === "rag") {
              fontesAcum = Array.isArray(parsed?.fontes) ? parsed.fontes : [];
              setMsgs(prev => {
                const arr = [...prev];
                arr[arr.length - 1] = { ...arr[arr.length - 1], fontes: [...fontesAcum] };
                return arr;
              });
            } else if (evento === "done") {
              if (parsed.conversa_id) setConversaId(parsed.conversa_id);
            } else if (evento === "error") {
              const msg = String(parsed.message || "");
              if (msg.includes("429")) throw new Error("Muitas mensagens em sequência. Aguarde alguns segundos e tente novamente.");
              if (msg.includes("402")) throw new Error("Créditos de IA esgotados. Avise o administrador para adicionar créditos.");
              throw new Error("A Olívia teve um problema ao gerar a resposta. Tente reenviar a pergunta.");
            }
          } catch {
            // ignora payload parcial
          }
        }
      }
    } catch (e: any) {
      const mensagem = e?.message || "Não foi possível falar com a Olívia agora.";
      const instrucao = "Se o problema persistir, recarregue a página (Ctrl+R / Cmd+R) ou faça login novamente.";
      const completa = `⚠️ ${mensagem}\n\n${instrucao}`;
      toast.error(mensagem, {
        description: "Tente novamente em instantes ou recarregue a página.",
        action: { label: "Recarregar", onClick: () => window.location.reload() },
      });
      setMsgs(prev => {
        const arr = [...prev];
        const last = arr[arr.length - 1];
        if (last?.role === "assistant" && !last.content) {
          arr[arr.length - 1] = { ...last, content: completa };
        } else {
          arr.push({ role: "assistant", content: completa });
        }
        return arr;
      });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir Olívia"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {aberto && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(96vw,420px)] h-[min(80vh,640px)] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/10 to-accent/10">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">Olívia</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Sua assistente Oliveira Agro</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Nova conversa" onClick={novaConversa}>
                <Plus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Histórico" onClick={() => setVendoHistorico(v => !v)}>
                <History className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAberto(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {vendoHistorico ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {conversas.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-6">Nenhuma conversa anterior</p>
              )}
              {conversas.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-2 hover:bg-muted/50 transition-colors">
                  <button onClick={() => abrirConversa(c.id)} className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">{c.titulo}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(c.updated_at).toLocaleString("pt-BR")}
                    </p>
                  </button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => excluirConversa(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgs.length === 0 && (
                  <div className="space-y-3">
                    {briefing && (
                      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-3 space-y-2">
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0">
                          <ReactMarkdown>{briefing.cabecalho}</ReactMarkdown>
                        </div>
                        {briefing.tem_alertas ? (
                          <div className="space-y-1.5">
                            {briefing.alertas.map((a: any, i: number) => (
                              <button
                                key={i}
                                onClick={() => {
                                  if (a.acao?.rota) { navigate(a.acao.rota); setAberto(false); }
                                }}
                                className="w-full text-left rounded-lg border border-border/60 bg-background/60 hover:bg-background px-2.5 py-1.5 transition-colors"
                              >
                                <p className="text-xs font-medium leading-tight">{a.titulo}</p>
                                {a.itens && a.itens.length > 0 && (
                                  <ul className="mt-1 text-[10px] text-muted-foreground space-y-0.5">
                                    {a.itens.slice(0, 3).map((it: string, j: number) => (
                                      <li key={j} className="truncate">• {it}</li>
                                    ))}
                                  </ul>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{briefing.vazio_msg}</p>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Posso navegar, contar laudos/vencimentos/métricas e <strong>criar</strong> tarefas, leads, atividades e lembretes pra você.
                    </p>
                    <div className="space-y-1.5">
                      {SUGESTOES.map(s => (
                        <button key={s} onClick={() => enviar(s)}
                          className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent/10 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}>
                      {m.content ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : m.role === "assistant" && carregando ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : null}

                      {m.acoes && m.acoes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {m.acoes.map((a, j) => {
                            if (a.tipo === "navegar" && a.rota) {
                              return (
                                <button key={j}
                                  onClick={() => { navigate(a.rota!); setAberto(false); }}
                                  className="w-full flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-background/60 hover:bg-background border border-border/60 transition-colors">
                                  <span className="truncate">Ir para {a.rota}</span>
                                  <ArrowRight className="w-3 h-3 shrink-0" />
                                </button>
                              );
                            }
                            if (a.tipo === "criou") {
                              return (
                                <div key={j} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{a.detalhe}</span>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                      {m.role === "assistant" && m.fontes && m.fontes.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/40">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Fontes da base</p>
                          <ul className="space-y-0.5">
                            {m.fontes.map((f, k) => (
                              <li key={k} className="text-[11px] text-muted-foreground leading-snug">
                                <span className="font-medium text-foreground/80">{f.titulo || "(sem título)"}</span>
                                {f.categoria ? <span> — {f.categoria}</span> : null}
                                {f.fonte ? <span className="opacity-70"> · {f.fonte}</span> : null}
                                {typeof f.similarity === "number" ? (
                                  <span className="opacity-60"> · {(f.similarity * 100).toFixed(0)}%</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={e => { e.preventDefault(); enviar(input); }}
                className="border-t p-3 flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)}
                  placeholder="Pergunte, peça ou navegue..."
                  disabled={carregando}
                  className="flex-1 text-sm bg-muted border border-transparent focus:border-primary/40 rounded-xl px-3 py-2 outline-none transition-colors" />
                <Button type="submit" size="icon" disabled={carregando || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}