import { AppLayout } from "@/components/AppLayout";
import { lerTudo } from "@/lib/lerTudo";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Scale, Trophy, Gavel, CheckCircle2, Loader2, FileWarning,
  TrendingUp, Users, Activity, AlertTriangle, FileText,
} from "lucide-react";
import { formatDateBR } from "@/lib/utils";
import { Link } from "react-router-dom";

type Membro = { user_id: string; nome: string; foto_url: string | null; papel: string };
type Mov = { id: string; processo_id: string; tipo: string; descricao: string; created_at: string; user_id: string };

const VITORIA_TIPOS = ["liminar_concedida", "sentenca_procedente", "acordo_homologado"];
const DERROTA_TIPOS = ["liminar_negada", "sentenca_improcedente"];

const TIPO_LABEL: Record<string, string> = {
  liminar_concedida: "Liminar concedida",
  liminar_negada: "Liminar negada",
  sentenca_procedente: "Sentença procedente",
  sentenca_improcedente: "Sentença improcedente",
  acordo_homologado: "Acordo homologado",
  decisao: "Decisão",
  despacho: "Despacho",
  intimacao: "Intimação",
  audiencia: "Audiência",
  recurso: "Recurso",
  outro: "Outro",
  sentenca: "Sentença",
};

export default function JuridicoOverview() {
  const [loading, setLoading] = useState(true);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [tarefasPorMembro, setTarefasPorMembro] = useState<Record<string, { concluidas: number; pendentes: number; atrasadas: number }>>({});
  const [peticoesPorMembro, setPeticoesPorMembro] = useState<Record<string, number>>({});
  const [movs, setMovs] = useState<Mov[]>([]);
  const [totalProcessos, setTotalProcessos] = useState(0);
  const [totalPeticoes, setTotalPeticoes] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data: membrosData } = await supabase.from("membros").select("user_id, papel");
        const userIds = (membrosData ?? []).map((m: any) => m.user_id);
        const { data: perfis } = await supabase
          .from("profiles_publico")
          .select("id, nome, foto_url")
          .in("id", userIds);
        const perfilMap = new Map((perfis ?? []).map((p: any) => [p.id, p]));
        const membrosList: Membro[] = (membrosData ?? []).map((m: any) => {
          const p: any = perfilMap.get(m.user_id);
          return {
            user_id: m.user_id,
            nome: p?.nome || "Sem nome",
            foto_url: p?.foto_url || null,
            papel: m.papel,
          };
        });
        setMembros(membrosList);

        const hoje = new Date().toISOString().slice(0, 10);
        const { data: tarefas } = await lerTudo(() => supabase
          .from("tarefas")
          .select("responsavel_id, concluida, data_vencimento, processo_id")
          .not("processo_id", "is", null));
        const tMap: Record<string, { concluidas: number; pendentes: number; atrasadas: number }> = {};
        (tarefas ?? []).forEach((t: any) => {
          const id = t.responsavel_id;
          if (!tMap[id]) tMap[id] = { concluidas: 0, pendentes: 0, atrasadas: 0 };
          if (t.concluida) tMap[id].concluidas++;
          else {
            tMap[id].pendentes++;
            if (t.data_vencimento && t.data_vencimento < hoje) tMap[id].atrasadas++;
          }
        });
        setTarefasPorMembro(tMap);

        const { data: peticoes, count: peticoesCount } = await supabase
          .from("peticoes")
          .select("user_id", { count: "exact" })
          .is("deleted_at", null);
        const pMap: Record<string, number> = {};
        (peticoes ?? []).forEach((p: any) => {
          pMap[p.user_id] = (pMap[p.user_id] || 0) + 1;
        });
        setPeticoesPorMembro(pMap);
        setTotalPeticoes(peticoesCount || 0);

        const { count: processosCount } = await supabase
          .from("processos")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null);
        setTotalProcessos(processosCount || 0);

        const { data: movsData } = await supabase
          .from("movimentacoes")
          .select("id, processo_id, tipo, descricao, created_at, user_id")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500);
        setMovs((movsData ?? []) as Mov[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const contagem = (tipos: string[]) => movs.filter((m) => tipos.includes(m.tipo)).length;
  const vitorias = contagem(VITORIA_TIPOS);
  const derrotas = contagem(DERROTA_TIPOS);
  const totalDecididos = vitorias + derrotas;
  const indiceVitoria = totalDecididos > 0 ? Math.round((vitorias / totalDecididos) * 100) : 0;

  const recentesRelevantes = movs
    .filter((m) => [...VITORIA_TIPOS, ...DERROTA_TIPOS].includes(m.tipo))
    .slice(0, 10);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Scale className="w-8 h-8 text-accent" />
            Overview Jurídico
          </h1>
          <p className="text-muted-foreground mt-1">
            Mapa do contencioso: produtividade da equipe e índice de vitórias.
          </p>
        </div>

        {/* KPIs principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Scale} label="Processos ativos" value={totalProcessos} tone="default" />
          <KpiCard icon={FileText} label="Petições geradas" value={totalPeticoes} tone="default" />
          <KpiCard icon={Trophy} label="Vitórias" value={vitorias} tone="success" hint={`${derrotas} derrota(s)`} />
          <KpiCard icon={TrendingUp} label="Índice de vitória" value={`${indiceVitoria}%`} tone={indiceVitoria >= 70 ? "success" : indiceVitoria >= 40 ? "warning" : "danger"} hint={`${totalDecididos} caso(s) decididos`} />
        </div>

        {/* Detalhamento por tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gavel className="w-5 h-5 text-accent" /> Índice de Vitórias por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <TipoBox label="Liminares concedidas" value={contagem(["liminar_concedida"])} tone="success" />
              <TipoBox label="Liminares negadas" value={contagem(["liminar_negada"])} tone="danger" />
              <TipoBox label="Sentenças procedentes" value={contagem(["sentenca_procedente"])} tone="success" />
              <TipoBox label="Sentenças improcedentes" value={contagem(["sentenca_improcedente"])} tone="danger" />
              <TipoBox label="Acordos homologados" value={contagem(["acordo_homologado"])} tone="success" />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Para alimentar este índice, registre as decisões em <span className="font-medium">Movimentações Judiciais</span> dentro de cada processo.
            </p>
          </CardContent>
        </Card>

        {/* Produtividade por membro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-accent" /> Produtividade da Equipe Jurídica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4">Membro</th>
                    <th className="py-2 pr-4">Papel</th>
                    <th className="py-2 pr-4 text-center">Tarefas concluídas</th>
                    <th className="py-2 pr-4 text-center">Pendentes</th>
                    <th className="py-2 pr-4 text-center">Atrasadas</th>
                    <th className="py-2 pr-4 text-center">Petições</th>
                  </tr>
                </thead>
                <tbody>
                  {membros.map((m) => {
                    const t = tarefasPorMembro[m.user_id] || { concluidas: 0, pendentes: 0, atrasadas: 0 };
                    const pet = peticoesPorMembro[m.user_id] || 0;
                    if (t.concluidas + t.pendentes + pet === 0) return null;
                    return (
                      <tr key={m.user_id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {m.foto_url ? (
                              <img src={m.foto_url} alt={m.nome} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {m.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-foreground">{m.nome}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="capitalize">{m.papel}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> {t.concluidas}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-center text-muted-foreground">{t.pendentes}</td>
                        <td className="py-3 pr-4 text-center">
                          {t.atrasadas > 0 ? (
                            <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                              <AlertTriangle className="w-4 h-4" /> {t.atrasadas}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="inline-flex items-center gap-1 text-accent font-semibold">
                            <FileWarning className="w-4 h-4" /> {pet}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {membros.every((m) => {
                    const t = tarefasPorMembro[m.user_id] || { concluidas: 0, pendentes: 0 };
                    return (t.concluidas + t.pendentes + (peticoesPorMembro[m.user_id] || 0)) === 0;
                  }) && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        Nenhuma atividade jurídica registrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Últimas decisões */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5 text-accent" /> Últimas Decisões Registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentesRelevantes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma liminar ou sentença registrada ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {recentesRelevantes.map((m) => {
                  const isVit = VITORIA_TIPOS.includes(m.tipo);
                  return (
                    <Link
                      key={m.id}
                      to={`/processos/${m.processo_id}`}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full mt-2 ${isVit ? "bg-emerald-500" : "bg-destructive"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={isVit ? "default" : "destructive"} className={isVit ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
                            {TIPO_LABEL[m.tipo] || m.tipo}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatDateBR(m.created_at)}</span>
                        </div>
                        <p className="text-sm text-foreground mt-1 line-clamp-2">{m.descricao}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function KpiCard({
  icon: Icon, label, value, tone = "default", hint,
}: { icon: any; label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger"; hint?: string }) {
  const toneClasses = {
    default: "text-accent bg-accent/10",
    success: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
    warning: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
    danger: "text-destructive bg-destructive/10",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${toneClasses}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TipoBox({ label, value, tone }: { label: string; value: number; tone: "success" | "danger" }) {
  const cls = tone === "success"
    ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20"
    : "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20";
  const text = tone === "success" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400";
  return (
    <div className={`p-3 rounded-lg border ${cls}`}>
      <p className={`text-2xl font-bold ${text}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}