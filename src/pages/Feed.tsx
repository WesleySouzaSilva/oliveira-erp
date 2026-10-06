import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCircle2, AlertTriangle, Info, Clock, User, FileText, Scale, CalendarDays } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface FeedItem {
  id: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  created_at: string;
  processo_id: string | null;
}

const tipoConfig: Record<string, { icon: any; color: string; bg: string }> = {
  urgente: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  alerta: { icon: AlertTriangle, color: "text-accent", bg: "bg-accent/10" },
  sucesso: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10" },
  tarefa: { icon: Clock, color: "text-accent", bg: "bg-accent/10" },
  laudo: { icon: FileText, color: "text-primary", bg: "bg-primary/10" },
  processo: { icon: Scale, color: "text-accent", bg: "bg-accent/10" },
};

export default function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");

  useEffect(() => {
    if (!user) return;
    loadNotifs();

    // Realtime subscription
    const channel = supabase
      .channel("feed-notifs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes_sistema", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setItems(prev => [payload.new as FeedItem, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadNotifs = async () => {
    const { data } = await supabase
      .from("notificacoes_sistema")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) setItems(data);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from("notificacoes_sistema").update({ lida: true }).eq("id", id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const markAllRead = async () => {
    const unreadIds = items.filter(n => !n.lida).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notificacoes_sistema").update({ lida: true }).in("id", unreadIds);
    setItems(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const filtered = filter === "todos"
    ? items
    : filter === "nao_lidas"
    ? items.filter(n => !n.lida)
    : items.filter(n => n.tipo === filter);

  const unreadCount = items.filter(n => !n.lida).length;

  // Group by date
  const grouped = filtered.reduce<Record<string, FeedItem[]>>((acc, item) => {
    const dateKey = format(new Date(item.created_at), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

    let label: string;
    if (dateKey === today) label = "Hoje";
    else if (dateKey === yesterday) label = "Ontem";
    else label = format(new Date(item.created_at), "dd 'de' MMMM", { locale: ptBR });

    if (!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-accent" /> Feed de Notificações
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Acompanhe tudo que acontece no sistema em tempo real
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Marcar todas como lidas ({unreadCount})
            </button>
          )}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-2 mb-6 overflow-x-auto pb-1"
        >
          {[
            { key: "todos", label: "Todos" },
            { key: "nao_lidas", label: `Não lidas (${unreadCount})` },
            { key: "urgente", label: "Urgentes" },
            { key: "alerta", label: "Alertas" },
            { key: "info", label: "Info" },
            { key: "sucesso", label: "Concluídos" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filter === f.key
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Feed */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {filter === "nao_lidas" ? "Nenhuma notificação não lida" : "Nenhuma notificação encontrada"}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateLabel, dateItems]) => (
              <div key={dateLabel}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{dateLabel}</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="space-y-2">
                  {dateItems.map((item, i) => {
                    const config = tipoConfig[item.tipo] || tipoConfig.info;
                    const Icon = config.icon;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => {
                          markRead(item.id);
                          if (item.processo_id) navigate(`/processos/${item.processo_id}`);
                        }}
                        className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer group ${
                          !item.lida
                            ? "bg-card border-accent/20 shadow-card hover:shadow-card-hover"
                            : "bg-card/50 border-border hover:bg-card"
                        }`}
                      >
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-relaxed ${
                            !item.lida ? "text-foreground font-medium" : "text-muted-foreground"
                          }`}>
                            {item.mensagem}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 mt-1">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>

                        {/* Unread dot */}
                        {!item.lida && (
                          <span className="w-2.5 h-2.5 rounded-full bg-accent mt-2 shrink-0 animate-pulse" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
