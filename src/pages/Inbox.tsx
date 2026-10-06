import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Inbox as InboxIcon, ListChecks, CalendarClock, Bell, MessageSquare,
  AlertTriangle, Loader2, CheckCircle2,
} from "lucide-react";

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_vencimento: string | null;
  prioridade: string | null;
  concluida: boolean;
};

type Vencimento = {
  id: string;
  nome_cliente: string;
  banco: string | null;
  numero_contrato: string | null;
  vencimento_proxima_parcela: string | null;
  valor_parcela: number | null;
};

type Notif = {
  id: string;
  tipo: string;
  mensagem: string;
  created_at: string;
  lida: boolean;
};

function diasAte(dataIso: string | null): number | null {
  if (!dataIso) return null;
  const d = new Date(dataIso + "T00:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoje.getTime()) / 86400000);
}

function fmtBR(dataIso: string | null) {
  if (!dataIso) return "—";
  const [y, m, d] = dataIso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

export default function Inbox() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [vencimentos, setVencimentos] = useState<Vencimento[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notif[]>([]);
  const aliveRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(hoje.getDate() + 30);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const [tarefasRes, vencRes, notifRes] = await Promise.all([
      supabase
        .from("tarefas")
        .select("id, titulo, descricao, data_vencimento, prioridade, concluida")
        .eq("concluida", false)
        .lte("data_vencimento", iso(limite))
        .order("data_vencimento", { ascending: true })
        .limit(50),
      supabase
        .from("contratos_vencimentos")
        .select("id, nome_cliente, banco, numero_contrato, vencimento_proxima_parcela, valor_parcela")
        .is("deleted_at", null)
        .eq("resolvido", false)
        .gte("vencimento_proxima_parcela", iso(hoje))
        .lte("vencimento_proxima_parcela", iso(limite))
        .order("vencimento_proxima_parcela", { ascending: true })
        .limit(50),
      supabase
        .from("notificacoes_sistema")
        .select("id, tipo, mensagem, created_at, lida")
        .eq("user_id", user.id)
        .eq("lida", false)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (!aliveRef.current) return;
    setTarefas((tarefasRes.data || []) as Tarefa[]);
    setVencimentos((vencRes.data || []) as Vencimento[]);
    setNotificacoes((notifRes.data || []) as Notif[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    aliveRef.current = true;
    if (!user) return;
    setLoading(true);
    fetchAll();

    // Debounce refetch para evitar tempestade de eventos realtime
    let t: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { fetchAll(); }, 400);
    };

    // Realtime: RLS já limita o que chega (por org / por user)
    const channel = supabase
      .channel(`inbox-realtime-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes_sistema", filter: `user_id=eq.${user.id}` }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "contratos_vencimentos" }, schedule)
      .subscribe();

    // Refetch quando a aba volta ao foco
    const onFocus = () => { if (document.visibilityState === "visible") schedule(); };
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      aliveRef.current = false;
      if (t) clearTimeout(t);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user, fetchAll]);

  const tarefasHoje = useMemo(
    () => tarefas.filter((t) => {
      const d = diasAte(t.data_vencimento);
      return d !== null && d <= 0;
    }),
    [tarefas]
  );
  const tarefasSemana = useMemo(
    () => tarefas.filter((t) => {
      const d = diasAte(t.data_vencimento);
      return d !== null && d > 0 && d <= 7;
    }),
    [tarefas]
  );
  const venc15 = useMemo(
    () => vencimentos.filter((v) => {
      const d = diasAte(v.vencimento_proxima_parcela);
      return d !== null && d <= 15;
    }),
    [vencimentos]
  );

  const totalUrgente =
    tarefasHoje.length + venc15.length + notificacoes.length;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <InboxIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Inbox</h1>
              <p className="text-xs text-muted-foreground">
                Tudo o que precisa da sua atenção em um só lugar
              </p>
            </div>
          </div>
          <Badge variant={totalUrgente > 0 ? "destructive" : "secondary"} className="text-sm">
            {totalUrgente} {totalUrgente === 1 ? "item urgente" : "itens urgentes"}
          </Badge>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <ResumoCard icon={AlertTriangle} label="Vencidas / Hoje" value={tarefasHoje.length} tone="danger" />
          <ResumoCard icon={ListChecks} label="Tarefas 7 dias" value={tarefasSemana.length} tone="default" />
          <ResumoCard icon={CalendarClock} label="Vencimentos 15 dias" value={venc15.length} tone="warn" />
          <ResumoCard icon={Bell} label="Notificações" value={notificacoes.length} tone="default" />
        </div>

        <Tabs defaultValue="tarefas">
          <TabsList>
            <TabsTrigger value="tarefas">
              Tarefas <Badge variant="secondary" className="ml-2">{tarefas.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="vencimentos">
              Vencimentos <Badge variant="secondary" className="ml-2">{vencimentos.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="notificacoes">
              Notificações <Badge variant="secondary" className="ml-2">{notificacoes.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tarefas" className="space-y-2 mt-3">
            {loading ? (
              <LoadingRow />
            ) : tarefas.length === 0 ? (
              <EmptyRow icon={CheckCircle2} text="Nenhuma tarefa pendente para os próximos 30 dias 🎉" />
            ) : (
              tarefas.map((t) => {
                const dias = diasAte(t.data_vencimento);
                const atrasada = dias !== null && dias < 0;
                const hoje = dias === 0;
                return (
                  <Link
                    key={t.id}
                    to={`/tarefas?id=${t.id}`}
                    className="block bg-card border rounded-lg p-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{t.titulo}</p>
                        {t.descricao && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.descricao}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={atrasada ? "destructive" : hoje ? "default" : "secondary"} className="text-[10px]">
                          {atrasada ? `Atrasada ${Math.abs(dias!)}d` : hoje ? "Hoje" : `Em ${dias}d`}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{fmtBR(t.data_vencimento)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="vencimentos" className="space-y-2 mt-3">
            {loading ? (
              <LoadingRow />
            ) : vencimentos.length === 0 ? (
              <EmptyRow icon={CheckCircle2} text="Nenhum vencimento nos próximos 30 dias." />
            ) : (
              vencimentos.map((v) => {
                const dias = diasAte(v.vencimento_proxima_parcela);
                const urgente = dias !== null && dias <= 15;
                return (
                  <Link
                    key={v.id}
                    to={`/clientes/${encodeURIComponent(v.nome_cliente)}`}
                    className="block bg-card border rounded-lg p-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{v.nome_cliente}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {v.banco || "Sem banco"} {v.numero_contrato ? `· ${v.numero_contrato}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={urgente ? "destructive" : "secondary"} className="text-[10px]">
                          {dias !== null ? `Em ${dias}d` : "—"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{fmtBR(v.vencimento_proxima_parcela)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="notificacoes" className="space-y-2 mt-3">
            {loading ? (
              <LoadingRow />
            ) : notificacoes.length === 0 ? (
              <EmptyRow icon={CheckCircle2} text="Sem notificações novas." />
            ) : (
              notificacoes.map((n) => (
                <Link
                  key={n.id}
                  to="/notificacoes"
                  className="block bg-card border rounded-lg p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{n.mensagem}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ResumoCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "default" | "warn" | "danger" }) {
  const toneCls =
    tone === "danger"
      ? "text-destructive bg-destructive/10"
      : tone === "warn"
      ? "text-amber-600 bg-amber-500/10 dark:text-amber-400"
      : "text-primary bg-primary/10";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          <span className={`h-6 w-6 rounded flex items-center justify-center ${toneCls}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );
}

function EmptyRow({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="bg-card border rounded-lg p-8 text-center">
      <Icon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}