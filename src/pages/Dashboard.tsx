import { useState, useEffect, useMemo } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { motion } from "framer-motion";
import {
  PlusCircle, ArrowRight, ShieldAlert, CalendarClock,
  CheckCircle2, Circle, Handshake, TrendingUp,
  Building2, Scale, FileWarning, Trophy, BellPlus,
  ChevronDown, ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buscarMembroAtual } from "@/hooks/useMembroAtual";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useTarefas } from "@/hooks/useTarefas";
import { OliviaAlertasCard } from "@/components/dashboard/OliviaAlertasCard";
import { RadarDashboardCards } from "@/components/radar/RadarDashboardCards";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateBR } from "@/lib/utils";
import { toast } from "sonner";

interface LaudoRow {
  id: string;
  numero_laudo: string;
  status: string;
  created_at: string;
  dados_etapa1: any;
}

interface ContratoRow {
  id: string;
  nome_cliente: string;
  banco: string | null;
  numero_contrato: string | null;
  vencimento_proxima_parcela: string | null;
  valor_total_operacao: number | null;
  parcelas_vencidas: boolean | null;
  possui_laudo: boolean | null;
  protocolo_realizado: boolean | null;
  status_prazo: string | null;
  data_limite_protocolo: string | null;
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [laudos, setLaudos] = useState<LaudoRow[]>([]);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { tarefas, toggleConcluida, createTarefa } = useTarefas({ responsavelId: user?.id });
  const { papel, canAccess, isAdmin } = usePermissions();

  const [peticoesTotal, setPeticoesTotal] = useState(0);
  const [bancosAguardando, setBancosAguardando] = useState(0);
  const [vitorias, setVitorias] = useState(0);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Role-specific greeting subtitle
  const roleSubtitle = useMemo(() => {
    switch (papel) {
      case "setor_acordos": return "Acompanhe suas tarefas de acordo e vencimentos.";
      case "comercial": case "closer": case "sdr": case "social_seller":
        return "Acompanhe seu pipeline comercial e leads.";
      case "marketing": case "gerente_marketing": case "criacao": case "copywriter": case "social_media":
        return "Acompanhe suas campanhas e leads gerados.";
      case "advogado": case "assessor_juridico": case "estagiario_direito":
        return "Acompanhe seus processos jurídicos e prazos.";
      case "coordenador":
        return "Gerencie sua equipe e acompanhe a produtividade.";
      default:
        return "";
    }
  }, [papel]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profileRes, laudosRes, contratosRes, processosRes, peticoesRes, movsRes, membroRes] = await Promise.all([
        supabase.from("profiles").select("nome, onboarding_completo").eq("id", user.id).single(),
        supabase.from("laudos").select("id, numero_laudo, status, created_at, dados_etapa1").order("created_at", { ascending: false }),
        lerTudo(() => supabase.from("contratos_vencimentos").select("id, nome_cliente, banco, numero_contrato, vencimento_proxima_parcela, valor_total_operacao, parcelas_vencidas, possui_laudo, protocolo_realizado, status_prazo, data_limite_protocolo")),
        lerTudo(() => supabase.from("processos").select("id, laudo_id, dados_fase3").is("deleted_at", null)),
        supabase.from("peticoes").select("id, status, created_at").is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.from("movimentacoes").select("tipo").is("deleted_at", null),
        buscarMembroAtual(user.id).catch(() => null),
      ]);

      if (profileRes.data) {
        setProfileName(profileRes.data.nome || "");
        if (!profileRes.data.onboarding_completo) setShowOnboarding(true);
      }
      if (membroRes?.principal?.organizacao_id) setOrgId(membroRes.principal.organizacao_id);

      // Hide only EMPTY shell laudos created for processes (same rule used in Meus Laudos)
      const processoLaudoIds = new Set((processosRes.data || []).map((p: any) => p.laudo_id));
      if (laudosRes.data) {
        setLaudos((laudosRes.data as LaudoRow[]).filter((l) => {
          const d = (l.dados_etapa1 || {}) as Record<string, any>;
          const nome = (d.nome || d.nomeProdutor || d.produtor || "").trim();
          const isShellEmpty = processoLaudoIds.has(l.id) && !nome && l.status === "rascunho";
          return !isShellEmpty;
        }));
      }
      if (contratosRes.data) setContratos((contratosRes.data as ContratoRow[]).filter((c: any) => !c.resolvido));

      setPeticoesTotal((peticoesRes.data || []).length);

      // ─── Bancos aguardando resposta de notificação (apenas contagem) ───
      let aguardando = 0;
      (processosRes.data || []).forEach((p: any) => {
        const f3 = p.dados_fase3 || {};
        const respostas = Array.isArray(f3.respostasPorContrato) ? f3.respostasPorContrato : [];
        if (respostas.length === 0 && (f3.tipoRespostaBanco === "aguardando" || f3.tipoRespostaBanco === "silencio")) {
          aguardando += 1;
        }
        respostas.forEach((r: any) => {
          if (r.tipoResposta === "aguardando" || r.tipoResposta === "silencio") aguardando += 1;
        });
      });
      setBancosAguardando(aguardando);

      const movs = (movsRes.data || []) as any[];
      const vitTipos = ["liminar_concedida", "sentenca_procedente", "acordo_homologado"];
      setVitorias(movs.filter((m) => vitTipos.includes(m.tipo)).length);

      setLoading(false);
    };
    load();
  }, [user]);

  // Vencimentos alerts (banner crítico)
  const alerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const vencidos: ContratoRow[] = [];
    const hoje: ContratoRow[] = [];
    const urgentes: ContratoRow[] = [];

    contratos.forEach((c) => {
      if (!c.protocolo_realizado && c.data_limite_protocolo) {
        if (c.data_limite_protocolo === "URGENTE" || c.data_limite_protocolo === "Já chegou vencida") {
          urgentes.push(c);
        }
      }

      if (!c.vencimento_proxima_parcela) return;
      const [vy, vm, vd] = c.vencimento_proxima_parcela.split("T")[0].split("-").map(Number);
      const venc = new Date(vy, (vm || 1) - 1, vd || 1);
      const diff = (venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

      if (diff < 0) vencidos.push(c);
      else if (diff === 0) hoje.push(c);
    });

    return { vencidos, hoje, urgentes };
  }, [contratos]);

  const totalAlerts = alerts.vencidos.length + alerts.hoje.length + alerts.urgentes.length;

  // Vencimentos nos próximos 5 dias (corte específico pedido pelo gestor)
  const proximos5 = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return contratos.filter((c) => {
      if (!c.vencimento_proxima_parcela) return false;
      const [vy, vm, vd] = c.vencimento_proxima_parcela.split("T")[0].split("-").map(Number);
      const v = new Date(vy, (vm || 1) - 1, vd || 1);
      const diff = (v.getTime() - today.getTime()) / 86400000;
      return diff >= 0 && diff <= 5;
    });
  }, [contratos]);

  // ── Cria lembretes em lote para o usuário atual ──
  const criarLembrete = async (titulo: string, descricao: string, diasFuturo = 1, processoId?: string) => {
    if (!user) return;
    if (!orgId) {
      toast.error("Organização não identificada. Recarregue a página.");
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + diasFuturo);
    const { error } = await createTarefa({
      organizacao_id: orgId,
      processo_id: processoId || null,
      fase: null,
      responsavel_id: user.id,
      titulo,
      descricao,
      data_vencimento: d.toISOString().slice(0, 10),
      concluida: false,
    } as any);
    if (error) toast.error("Não foi possível criar a tarefa: " + error.message);
  };

  const criarLembretesVencimentos = async () => {
    if (proximos5.length === 0) {
      toast.info("Nenhum vencimento nos próximos 5 dias.");
      return;
    }
    let n = 0;
    for (const c of proximos5) {
      const dias = Math.max(1, Math.ceil(((new Date(c.vencimento_proxima_parcela!).getTime() - Date.now()) / 86400000) - 1));
      await criarLembrete(
        `Vencimento: ${c.nome_cliente}`,
        `${c.banco || "Banco"} · contrato ${c.numero_contrato || "s/n"} vence em ${formatDateBR(c.vencimento_proxima_parcela)}`,
        dias,
      );
      n++;
    }
    toast.success(`${n} lembrete(s) de vencimento adicionados.`);
  };

  const recentLaudos = laudos.slice(0, 5);
  const tarefasAbertas = tarefas.filter((t) => !t.concluida);

  const getLaudoInfo = (laudo: LaudoRow) => {
    const d = laudo.dados_etapa1 as Record<string, any> | null;
    return { produtor: d?.nome || "Sem nome", cultura: d?.cultura || "—", safra: d?.safra || "—" };
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const SECOES = ["olivia", "operacao", "vencimentos", "tarefas", "laudos", "atalhos"] as const;
  const [colapsados, setColapsados] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("oliveira:dashboard-colapsados") || "{}"); } catch { return {}; }
  });
  const salvar = (next: Record<string, boolean>) => {
    setColapsados(next);
    try { localStorage.setItem("oliveira:dashboard-colapsados", JSON.stringify(next)); } catch { /* ignore */ }
  };
  const aberto = (k: string) => !colapsados[k];
  const toggleSecao = (k: string) => salvar({ ...colapsados, [k]: !colapsados[k] });
  const allCollapsed = SECOES.every((k) => colapsados[k]);
  const setAllCollapsed = (v: boolean) =>
    salvar(Object.fromEntries(SECOES.map((k) => [k, v])));

  return (
    <AppLayout>
      {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}

      {/* Welcome */}
      <motion.div {...fadeUp} transition={{ delay: 0 }} className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {greeting()}, {profileName || "Engenheiro"} 👋
            </h1>
            {roleSubtitle && <p className="text-muted-foreground mt-1 font-body">{roleSubtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => setAllCollapsed(!allCollapsed)}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-card hover:bg-secondary/60 transition-colors"
          >
            {allCollapsed ? <ChevronsUpDown className="w-3.5 h-3.5" /> : <ChevronsDownUp className="w-3.5 h-3.5" />}
            {allCollapsed ? "Expandir todos" : "Recolher todos"}
          </button>
        </div>
      </motion.div>

      <RadarDashboardCards />

      {/* Alert Banner */}
      {!loading && totalAlerts > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.02 }}>
          <Link
            to="/vencimentos"
            className="mb-6 flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-lg p-4 hover:bg-destructive/15 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">
                {totalAlerts} contrato{totalAlerts > 1 ? "s" : ""} requer{totalAlerts === 1 ? "" : "em"} atenção imediata
              </p>
              <p className="text-xs text-destructive/70 mt-0.5">
                {alerts.vencidos.length > 0 && `${alerts.vencidos.length} vencido${alerts.vencidos.length > 1 ? "s" : ""}`}
                {alerts.vencidos.length > 0 && alerts.hoje.length > 0 && " · "}
                {alerts.hoje.length > 0 && `${alerts.hoje.length} vence${alerts.hoje.length > 1 ? "m" : ""} hoje`}
                {(alerts.vencidos.length > 0 || alerts.hoje.length > 0) && alerts.urgentes.length > 0 && " · "}
                {alerts.urgentes.length > 0 && `${alerts.urgentes.length} urgente${alerts.urgentes.length > 1 ? "s" : ""}`}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-destructive shrink-0" />
          </Link>
        </motion.div>
      )}

      <motion.div {...fadeUp} transition={{ delay: 0.03 }} className="mb-6">
        <OliviaAlertasCard open={aberto("olivia")} onToggle={() => toggleSecao("olivia")} />
      </motion.div>

      {/* Resumo compacto da operação — uma linha */}
      <motion.div {...fadeUp} transition={{ delay: 0.04 }} className="mb-6">
        <div className="bg-card border border-border rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            type="button"
            onClick={() => toggleSecao("operacao")}
            aria-expanded={aberto("operacao")}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"
          >
            <Scale className="w-3.5 h-3.5 text-accent" /> Operação
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberto("operacao") ? "" : "-rotate-90"}`} />
          </button>
          {aberto("operacao") && (<>
          <ResumoItem icon={CalendarClock} label="vencem em 5 dias" value={loading ? "—" : proximos5.length} to="/vencimentos" />
          <ResumoItem icon={Building2} label="bancos aguardando" value={loading ? "—" : bancosAguardando} to="/processos" />
          <ResumoItem icon={FileWarning} label="petições" value={loading ? "—" : peticoesTotal} to="/peticoes/historico" />
          <ResumoItem icon={Trophy} label="vitórias" value={loading ? "—" : vitorias} to="/juridico/overview" />
          <Link to="/juridico/overview" className="ml-auto text-xs text-accent hover:underline">
            Overview jurídico →
          </Link>
          </>)}
        </div>
      </motion.div>

      {/* Vencimentos dos próximos 5 dias */}
      {!loading && proximos5.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.06 }} className="bg-card rounded-lg border border-border shadow-card mb-6">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => toggleSecao("vencimentos")}
              aria-expanded={aberto("vencimentos")}
              className="text-sm font-semibold text-foreground font-body flex items-center gap-2"
            >
              <CalendarClock className="w-4 h-4 text-accent" />
              Vencendo nos próximos 5 dias
              <span className="text-xs font-normal text-muted-foreground">({proximos5.length})</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${aberto("vencimentos") ? "" : "-rotate-90"}`} />
            </button>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  onClick={criarLembretesVencimentos}
                  className="text-xs inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium"
                >
                  <BellPlus className="w-3.5 h-3.5" /> Criar lembretes
                </button>
              )}
              <Link to="/vencimentos" className="text-xs text-accent font-medium hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          {aberto("vencimentos") && (
          <div className="divide-y divide-border">
            {proximos5.slice(0, 5).map((c) => (
              <Link key={c.id} to="/vencimentos" className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p data-private className="text-sm font-medium text-foreground truncate">{c.nome_cliente}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.banco || "—"} · {c.numero_contrato || "s/n"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDateBR(c.vencimento_proxima_parcela)}
                </span>
              </Link>
            ))}
          </div>
          )}
        </motion.div>
      )}

      {/* Minhas Tarefas */}
      {tarefasAbertas.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.08 }} className="bg-card rounded-lg shadow-card border border-border mb-6">
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-border">
            <button
              type="button"
              onClick={() => toggleSecao("tarefas")}
              aria-expanded={aberto("tarefas")}
              className="text-sm font-semibold text-foreground font-body flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-accent" />
              Minhas tarefas
              <span className="text-xs font-normal text-muted-foreground">({tarefasAbertas.length})</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${aberto("tarefas") ? "" : "-rotate-90"}`} />
            </button>
            <Link to="/agenda" className="text-xs text-accent font-medium hover:underline flex items-center gap-1">
              Ver agenda <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {aberto("tarefas") && (
          <div className="divide-y divide-border">
            {tarefasAbertas.slice(0, 5).map((t) => {
              const hoje = new Date().toISOString().split("T")[0];
              return (
                <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <button onClick={() => toggleConcluida(t.id, true)} className="shrink-0" aria-label="Concluir tarefa">
                    <Circle className="w-4 h-4 text-muted-foreground hover:text-accent transition-colors" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.titulo}</p>
                    {t.descricao && <p className="text-xs text-muted-foreground truncate">{t.descricao}</p>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    t.data_vencimento < hoje
                      ? "bg-destructive/10 text-destructive"
                      : t.data_vencimento === hoje
                        ? "bg-accent/10 text-accent"
                        : "bg-secondary text-foreground"
                  }`}>
                    {t.data_vencimento < hoje
                      ? "Atrasada"
                      : t.data_vencimento === hoje
                        ? "Hoje"
                        : new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
              );
            })}
          </div>
          )}
        </motion.div>
      )}

      {/* Últimos laudos */}
      {canAccess("laudos") && (
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="bg-card rounded-lg shadow-card border border-border mb-6">
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-border">
            <button
              type="button"
              onClick={() => toggleSecao("laudos")}
              aria-expanded={aberto("laudos")}
              className="text-sm font-semibold text-foreground font-body flex items-center gap-2"
            >
              Últimos laudos
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${aberto("laudos") ? "" : "-rotate-90"}`} />
            </button>
            <Link to="/laudos" className="text-xs text-accent font-medium hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {aberto("laudos") && (
          <div className="divide-y divide-border">
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : recentLaudos.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum laudo criado ainda.</div>
            ) : (
              recentLaudos.map((laudo) => {
                const info = getLaudoInfo(laudo);
                return (
                  <Link key={laudo.id} to={`/novo-laudo?id=${laudo.id}`} className="px-5 py-3 flex items-center gap-4 hover:bg-secondary/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {info.produtor.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p data-private className="text-sm font-medium text-foreground truncate">{info.produtor}</p>
                      <p className="text-xs text-muted-foreground">{info.cultura} · {info.safra}</p>
                    </div>
                    <StatusBadge status={laudo.status as any} />
                  </Link>
                );
              })
            )}
          </div>
          )}
        </motion.div>
      )}

      {/* CTAs - role-aware */}
      <motion.div {...fadeUp} transition={{ delay: 0.12 }} className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={() => toggleSecao("atalhos")}
          aria-expanded={aberto("atalhos")}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-secondary/60 transition-colors"
        >
          Atalhos
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberto("atalhos") ? "" : "-rotate-90"}`} />
        </button>
        {aberto("atalhos") && (<>
        {canAccess("novo-laudo") && (
          <Link to="/novo-laudo" className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-5 py-2.5 rounded-lg font-semibold shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
            <PlusCircle className="w-4 h-4" /> Novo Laudo
          </Link>
        )}
        {canAccess("acordos") && (
          <Link to="/acordos" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
            <Handshake className="w-4 h-4" /> Acordos
          </Link>
        )}
        {canAccess("comercial") && (
          <Link to="/comercial" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
            <TrendingUp className="w-4 h-4" /> Comercial
          </Link>
        )}
        <Link to="/agenda" className="inline-flex items-center gap-2 bg-card text-foreground border px-5 py-2.5 rounded-lg font-semibold shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
          <CalendarClock className="w-4 h-4" /> Agenda
        </Link>
        </>)}
      </motion.div>
    </AppLayout>
  );
}

function ResumoItem({
  icon: Icon, label, value, to,
}: { icon: any; label: string; value: string | number; to: string }) {
  return (
    <Link to={to} className="flex items-baseline gap-1.5 group">
      <Icon className="w-3.5 h-3.5 text-muted-foreground self-center" />
      <span className="text-base font-semibold text-foreground group-hover:text-accent transition-colors">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Link>
  );
}
