import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Extrai o nome do cliente de mensagens padronizadas, ex.:
 *  - "Fulano registrou uma atividade em Cliente Nome · Banco"
 *  - "Novo laudo anexado para Cliente Nome (Fase 1)"
 *  - "Onboarding de Cliente Nome — ..."
 */
function extrairClienteDaMensagem(msg: string): string | null {
  if (!msg) return null;
  const padroes = [
    /atividade em\s+(.+?)(?:\s+·|\s+—|\s+-|\s*\(|$)/i,
    /laudo[^]*?para\s+(.+?)(?:\s+·|\s+—|\s+-|\s*\(|$)/i,
    /onboarding de\s+(.+?)(?:\s+·|\s+—|\s+-|\s*\(|$)/i,
    /cliente\s+(.+?)(?:\s+·|\s+—|\s+-|\s*\(|$)/i,
  ];
  for (const re of padroes) {
    const m = msg.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

interface Notificacao {
  id: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  created_at: string;
  processo_id: string | null;
}

export function NotificacoesDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Cache compartilhado: a lista não é buscada de novo a cada troca de tela;
  // o tempo real mantém o cache atualizado.
  const qc = useQueryClient();
  const chave = ["notificacoes-dropdown", user?.id];
  const { data: notifsData } = useQuery({
    queryKey: chave,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("notificacoes_sistema")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as Notificacao[];
    },
  });
  const notifs = notifsData ?? [];
  const setNotifs = (fn: (prev: Notificacao[]) => Notificacao[]) =>
    qc.setQueryData<Notificacao[]>(chave, (prev) => fn(prev ?? []));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const abrir = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const largura = 320;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - largura - 8);
      setPos({ top: r.bottom + 8, left });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!user) return;
    // Realtime subscription
    const channel = supabase
      .channel("notifs-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes_sistema", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new as Notificacao;
          setNotifs((prev) => [newNotif, ...prev].slice(0, 30));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notificacoes_sistema", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Notificacao;
          setNotifs((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notificacoes_sistema", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const oldId = (payload.old as { id?: string } | null)?.id;
          if (oldId) setNotifs((prev) => prev.filter((n) => n.id !== oldId));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (ref.current?.contains(alvo)) return;
      if (panelRef.current?.contains(alvo)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifs.filter((n) => !n.lida).length;

  const handleClick = async (n: Notificacao) => {
    if (!n.lida) {
      await supabase.from("notificacoes_sistema").update({ lida: true }).eq("id", n.id);
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    }
    if (n.processo_id) {
      setOpen(false);
      navigate(`/processos/${n.processo_id}`);
      return;
    }
    const cliente = extrairClienteDaMensagem(n.mensagem);
    if (cliente) {
      setOpen(false);
      navigate(`/clientes/${encodeURIComponent(cliente)}`);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifs.filter((n) => !n.lida).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notificacoes_sistema").update({ lida: true }).in("id", unreadIds);
    setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  const dismissNotif = async (e: React.MouseEvent, n: Notificacao) => {
    e.stopPropagation();
    setNotifs((prev) => prev.filter((x) => x.id !== n.id));
    const { error } = await supabase.from("notificacoes_sistema").delete().eq("id", n.id);
    if (error) console.error("Falha ao dispensar notificação:", error);
  };

  const tipoColor: Record<string, string> = {
    info: "bg-primary/15 text-primary",
    sucesso: "bg-success/15 text-success",
    alerta: "bg-accent/15 text-accent",
    erro: "bg-destructive/15 text-destructive",
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        aria-label="Notificações"
        onClick={abrir}
        className="relative p-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: 320 }}
          className="fixed bg-card border border-border rounded-lg shadow-card-hover z-[9999] overflow-hidden max-h-[70vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-accent hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma notificação
              </p>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  className={`group relative border-b border-border/50 transition-colors ${
                    !n.lida ? "bg-accent/5" : ""
                  } hover:bg-secondary/50`}
                >
                  <button
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 pr-9 ${n.processo_id ? "cursor-pointer" : ""}`}
                    title={n.processo_id ? "Abrir processo relacionado" : undefined}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tipoColor[n.tipo] || tipoColor.info}`}>
                        {n.tipo}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!n.lida ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {n.mensagem}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                      {!n.lida && <span className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Dispensar notificação"
                    onClick={(e) => dismissNotif(e, n)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-secondary opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
