import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users, FileText, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Circle, CheckCircle2, ArrowRight, BarChart3,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface MemberStats {
  userId: string;
  nome: string;
  papel: string;
  peticoesMesAtual: number;
  peticoesMesPassado: number;
  tarefasPendentes: number;
  tarefasAtrasadas: number;
  tarefasConcluidas: number;
  tarefasTotal: number;
}

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

export function PerformanceOverview() {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [memberTarefas, setMemberTarefas] = useState<any[]>([]);

  useEffect(() => {
    if (!user || members.length === 0) return;

    const loadStats = async () => {
      const memberIds = members.map((m) => m.user_id);

      const now = new Date();
      const mesAtualInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const mesPassadoInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const mesPassadoFim = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      const hoje = now.toISOString().split("T")[0];

      const [petRes, tarefasRes] = await Promise.all([
        supabase.from("peticoes").select("id, user_id, created_at").in("user_id", memberIds),
        supabase.from("tarefas" as any).select("*").in("responsavel_id", memberIds),
      ]);

      const peticoes = petRes.data || [];
      const tarefas = (tarefasRes.data || []) as any[];

      const result: MemberStats[] = members.map((m) => {
        const memberPeticoes = peticoes.filter((p) => p.user_id === m.user_id);
        const memberTarefas = tarefas.filter((t: any) => t.responsavel_id === m.user_id);

        const peticoesMesAtual = memberPeticoes.filter(
          (p) => p.created_at >= mesAtualInicio
        ).length;
        const peticoesMesPassado = memberPeticoes.filter(
          (p) => p.created_at >= mesPassadoInicio && p.created_at <= mesPassadoFim
        ).length;

        const pendentes = memberTarefas.filter((t: any) => !t.concluida);
        const atrasadas = pendentes.filter((t: any) => t.data_vencimento < hoje);
        const concluidas = memberTarefas.filter((t: any) => t.concluida);

        return {
          userId: m.user_id,
          nome: m.nome || "Sem nome",
          papel: m.papel,
          peticoesMesAtual,
          peticoesMesPassado,
          tarefasPendentes: pendentes.length,
          tarefasAtrasadas: atrasadas.length,
          tarefasConcluidas: concluidas.length,
          tarefasTotal: memberTarefas.length,
        };
      });

      setStats(result);
      setLoading(false);
    };

    loadStats();
  }, [user, members]);

  const toggleExpand = async (userId: string) => {
    if (expandedMember === userId) {
      setExpandedMember(null);
      setMemberTarefas([]);
      return;
    }
    setExpandedMember(userId);
    const { data } = await supabase
      .from("tarefas" as any)
      .select("*")
      .eq("responsavel_id", userId)
      .eq("concluida", false)
      .order("data_vencimento", { ascending: true });
    setMemberTarefas((data || []) as any[]);
  };

  const chartData = useMemo(() => {
    return stats.map((s) => ({
      name: s.nome.split(" ")[0],
      atual: s.peticoesMesAtual,
      passado: s.peticoesMesPassado,
    }));
  }, [stats]);

  const hoje = new Date().toISOString().split("T")[0];

  const roleLabel = (papel: string) => {
    const map: Record<string, string> = {
      admin: "Admin",
      advogado: "Advogado",
      agronomo: "Agrônomo",
      engenheiro_agronomo: "Eng. Agrônomo",
      estagiario_direito: "Estagiário",
      assessor_juridico: "Assessor",
    };
    return map[papel] || papel;
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-card border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground font-body">Desempenho da Equipe</h2>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      </div>
    );
  }

  if (stats.length === 0) return null;

  return (
    <motion.div {...fadeUp} transition={{ delay: 0.12 }} className="bg-card rounded-lg shadow-card border border-border mb-6">
      <div className="p-5 flex items-center justify-between border-b border-border">
        <h2 className="text-sm font-semibold text-foreground font-body flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          Desempenho da Equipe
        </h2>
        <Link to="/agenda" className="text-xs text-accent font-medium hover:underline flex items-center gap-1">
          Ver agenda <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Taskscore chart */}
      {chartData.length > 0 && (
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" /> Mês atual
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/40 inline-block" /> Mês passado
            </span>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} layout="vertical" barCategoryGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [
                  value,
                  name === "atual" ? "Mês atual" : "Mês passado",
                ]}
              />
              <Bar dataKey="passado" fill="hsl(var(--muted-foreground) / 0.35)" radius={[0, 3, 3, 0]} barSize={14} />
              <Bar dataKey="atual" fill="hsl(var(--accent))" radius={[0, 3, 3, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Member cards */}
      <div className="divide-y divide-border">
        {stats.map((s) => (
          <div key={s.userId}>
            <button
              onClick={() => toggleExpand(s.userId)}
              className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                {s.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{s.nome}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(s.papel)}</p>
              </div>

              {/* Metrics inline */}
              <div className="hidden sm:flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Petições</p>
                  <p className="text-sm font-semibold text-foreground">{s.peticoesMesAtual}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="text-sm font-semibold text-foreground">{s.tarefasPendentes}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Atrasadas</p>
                  <p className={`text-sm font-semibold ${s.tarefasAtrasadas > 0 ? "text-destructive" : "text-foreground"}`}>
                    {s.tarefasAtrasadas}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Concluídas</p>
                  <p className="text-sm font-semibold text-foreground">{s.tarefasConcluidas}</p>
                </div>
              </div>

              {/* Badges on mobile */}
              <div className="flex sm:hidden items-center gap-1.5">
                {s.tarefasAtrasadas > 0 && (
                  <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-semibold">
                    {s.tarefasAtrasadas} atraso
                  </span>
                )}
                <span className="text-[10px] bg-secondary text-foreground px-1.5 py-0.5 rounded-full font-medium">
                  {s.tarefasPendentes} pend.
                </span>
              </div>

              {expandedMember === s.userId ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {/* Expanded task list */}
            {expandedMember === s.userId && (
              <div className="bg-secondary/30 border-t border-border">
                {memberTarefas.length === 0 ? (
                  <p className="px-5 py-3 text-xs text-muted-foreground text-center">
                    Nenhuma tarefa pendente
                  </p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {memberTarefas.map((t: any) => (
                      <div key={t.id} className="px-5 py-2.5 flex items-center gap-3">
                        <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{t.titulo}</p>
                          {t.descricao && (
                            <p className="text-[11px] text-muted-foreground truncate">{t.descricao}</p>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            t.data_vencimento < hoje
                              ? "bg-destructive/10 text-destructive"
                              : t.data_vencimento === hoje
                              ? "bg-accent/10 text-accent"
                              : "bg-secondary text-foreground"
                          }`}
                        >
                          {t.data_vencimento < hoje
                            ? "Atrasada"
                            : t.data_vencimento === hoje
                            ? "Hoje"
                            : new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-5 py-2 border-t border-border/50">
                  <Link
                    to="/agenda"
                    className="text-xs text-accent font-medium hover:underline flex items-center gap-1"
                  >
                    Ver todas as tarefas <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
