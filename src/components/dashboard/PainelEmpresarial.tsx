import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Building2, Briefcase, Inbox, FileText, Lock, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Clock, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { PageHeader } from "@/components/ui/page-header";

type Avenca = { id: string; empresa_id: string; status: string; created_at: string; updated_at: string };
type Demanda = {
  id: string; status: string; prazo: string | null; created_at: string;
  concluida_em: string | null; responsavel_id: string | null;
};
type Proposta = { id: string; status: string; valor_sugerido: number | null; created_at: string };
type Empresa = {
  id: string; status: string; risco: string | null; nps: number | null;
  responsavel_pos_venda: string | null;
};
type Valor = { avenca_id: string; valor_mensal: number };

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export default function PainelEmpresarial() {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [avencas, setAvencas] = useState<Avenca[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [valores, setValores] = useState<Valor[]>([]);
  const [canSeeFinance, setCanSeeFinance] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const ehFinanceiro = (() => {
        const m = (members || []).find((x) => x.user_id === user.id);
        return m?.papel === "admin" || m?.papel === "coordenador";
      })();

      const [{ data: emps }, { data: avs }, { data: dms }, { data: pps }] = await Promise.all([
        (supabase as any)
          .from("empresas_consultoria")
          .select("id, status, risco, nps, responsavel_pos_venda")
          .is("deleted_at", null),
        (supabase as any)
          .from("avencas")
          .select("id, empresa_id, status, created_at, updated_at")
          .is("deleted_at", null),
        (supabase as any)
          .from("consultoria_demandas")
          .select("id, status, prazo, created_at, concluida_em, responsavel_id")
          .is("deleted_at", null),
        (supabase as any)
          .from("consultoria_propostas")
          .select("id, status, valor_sugerido, created_at")
          .is("deleted_at", null),
      ]);

      let vls: Valor[] = [];
      if (ehFinanceiro) {
        const { data: v } = await (supabase as any)
          .from("avenca_valores")
          .select("avenca_id, valor_mensal");
        vls = (v ?? []) as Valor[];
      }
      if (cancel) return;
      setCanSeeFinance(ehFinanceiro);
      setEmpresas((emps ?? []) as Empresa[]);
      setAvencas((avs ?? []) as Avenca[]);
      setDemandas((dms ?? []) as Demanda[]);
      setPropostas((pps ?? []) as Proposta[]);
      setValores(vls);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user, members]);

  const ini = startOfMonth();
  const hojeISO = new Date().toISOString().slice(0, 10);

  const opAvencas = useMemo(() => {
    const ativas = avencas.filter((a) => a.status === "ativa").length;
    const suspensas = avencas.filter((a) => a.status === "suspensa").length;
    const encerradas = avencas.filter((a) => a.status === "encerrada").length;
    const novasMes = avencas.filter((a) => a.created_at >= ini).length;
    // "encerradas no mês" = status encerrada e updated_at no mês
    const encerradasMes = avencas.filter((a) => a.status === "encerrada" && a.updated_at >= ini).length;
    return { ativas, suspensas, encerradas, novasMes, encerradasMes };
  }, [avencas, ini]);

  const opDemandas = useMemo(() => {
    const abertas = demandas.filter((d) => d.status === "aberta").length;
    const emAnalise = demandas.filter((d) => d.status === "em_analise").length;
    const aguardando = demandas.filter((d) => d.status === "aguardando_empresa").length;
    const ativas = demandas.filter((d) => !["concluida", "cancelada"].includes(d.status));
    const concluidasMes = demandas.filter((d) => d.status === "concluida" && d.concluida_em && d.concluida_em >= ini);
    // No prazo / atrasada
    const atrasadas = ativas.filter((d) => d.prazo && d.prazo < hojeISO).length
      + concluidasMes.filter((d) => d.prazo && d.concluida_em && d.concluida_em.slice(0, 10) > d.prazo).length;
    const consideradas = ativas.length + concluidasMes.length;
    const pctPrazo = consideradas === 0 ? null : Math.round(((consideradas - atrasadas) / consideradas) * 100);
    // Tempo médio de resolução (dias) sobre concluídas no mês
    let tmedio: number | null = null;
    if (concluidasMes.length > 0) {
      const soma = concluidasMes.reduce((s, d) => {
        const ms = new Date(d.concluida_em!).getTime() - new Date(d.created_at).getTime();
        return s + Math.max(0, ms);
      }, 0);
      tmedio = Math.round(soma / concluidasMes.length / (1000 * 60 * 60 * 24));
    }
    // Backlog por responsável
    const backlog = new Map<string | null, number>();
    for (const d of ativas) backlog.set(d.responsavel_id, (backlog.get(d.responsavel_id) ?? 0) + 1);
    return { abertas, emAnalise, aguardando, concluidasMes: concluidasMes.length, atrasadas, pctPrazo, tmedio, backlog };
  }, [demandas, ini, hojeISO]);

  const opPropostas = useMemo(() => {
    const noMes = propostas.filter((p) => p.created_at >= ini);
    const enviadas = noMes.filter((p) => p.status === "enviada" || p.status === "aceita" || p.status === "recusada").length;
    const aceitas = noMes.filter((p) => p.status === "aceita").length;
    const recusadas = noMes.filter((p) => p.status === "recusada").length;
    const denom = aceitas + recusadas;
    const taxa = denom === 0 ? null : Math.round((aceitas / denom) * 100);
    return { enviadas, aceitas, recusadas, taxa };
  }, [propostas, ini]);

  const opCarteira = useMemo(() => {
    const empComAvenca = new Set(avencas.map((a) => a.empresa_id));
    const carteira = empresas.filter((e) => empComAvenca.has(e.id));
    const porRisco = { alto: 0, medio: 0, baixo: 0 };
    let npsSoma = 0, npsCount = 0, semResp = 0;
    for (const e of carteira) {
      if (e.risco && (e.risco === "alto" || e.risco === "medio" || e.risco === "baixo")) porRisco[e.risco]++;
      if (e.nps != null) { npsSoma += e.nps; npsCount++; }
      if (!e.responsavel_pos_venda) semResp++;
    }
    const npsMedio = npsCount === 0 ? null : Math.round((npsSoma / npsCount) * 10) / 10;
    return { total: carteira.length, porRisco, npsMedio, semResp };
  }, [empresas, avencas]);

  const opCarga = useMemo(() => {
    const demAtivas = demandas.filter((d) => !["concluida", "cancelada"].includes(d.status));
    const demPorResp = new Map<string | null, number>();
    for (const d of demAtivas) demPorResp.set(d.responsavel_id, (demPorResp.get(d.responsavel_id) ?? 0) + 1);
    const empComAvenca = new Set(avencas.map((a) => a.empresa_id));
    const empPorResp = new Map<string | null, number>();
    for (const e of empresas) {
      if (!empComAvenca.has(e.id)) continue;
      empPorResp.set(e.responsavel_pos_venda, (empPorResp.get(e.responsavel_pos_venda) ?? 0) + 1);
    }
    const todos = new Set<string | null>([...demPorResp.keys(), ...empPorResp.keys()]);
    return [...todos].map((uid) => ({
      user_id: uid,
      demandas: demPorResp.get(uid) ?? 0,
      empresas: empPorResp.get(uid) ?? 0,
    })).sort((a, b) => (b.demandas + b.empresas) - (a.demandas + a.empresas));
  }, [demandas, empresas, avencas]);

  const fin = useMemo(() => {
    if (!canSeeFinance) return null;
    const valPorAv = new Map(valores.map((v) => [v.avenca_id, Number(v.valor_mensal || 0)]));
    const ativas = avencas.filter((a) => a.status === "ativa");
    const mrr = ativas.reduce((s, a) => s + (valPorAv.get(a.id) ?? 0), 0);
    const mrrNovo = avencas
      .filter((a) => a.status === "ativa" && a.created_at >= ini)
      .reduce((s, a) => s + (valPorAv.get(a.id) ?? 0), 0);
    const mrrPerdido = avencas
      .filter((a) => a.status !== "ativa" && a.updated_at >= ini)
      .reduce((s, a) => s + (valPorAv.get(a.id) ?? 0), 0);
    const ticket = ativas.length === 0 ? 0 : mrr / ativas.length;
    const pipeline = propostas
      .filter((p) => p.status === "rascunho" || p.status === "enviada")
      .reduce((s, p) => s + Number(p.valor_sugerido || 0), 0);
    return { mrr, mrrNovo, mrrPerdido, ticket, pipeline };
  }, [canSeeFinance, valores, avencas, propostas, ini]);

  const nomeMembro = (uid: string | null) => {
    if (!uid) return "Sem responsável";
    return members.find((m) => m.user_id === uid)?.nome || "Membro";
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          icon={Building2}
          title="Painel Empresarial"
          subtitle="Visão do squad de Consultoria Empresarial — operacional e financeiro."
          breadcrumb={[{ label: "Empresarial" }, { label: "Painel" }]}
        />

        {loading && (
          <Card className="p-6 text-center text-muted-foreground">Carregando…</Card>
        )}

        {/* CONTRATOS */}
        <section>
          <h2 className="font-serif text-xl text-primary mb-3 flex items-center gap-2">
            <Briefcase className="w-5 h-5" /> Contratos
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi label="Ativos" value={opAvencas.ativas} tone="ok" />
            <Kpi label="Suspensos" value={opAvencas.suspensas} tone="warn" />
            <Kpi label="Encerrados" value={opAvencas.encerradas} tone="muted" />
            <Kpi label="Novos no mês" value={opAvencas.novasMes} tone="ok" icon={<TrendingUp className="w-4 h-4" />} />
            <Kpi label="Encerrados no mês" value={opAvencas.encerradasMes} tone="bad" icon={<TrendingDown className="w-4 h-4" />} />
          </div>
        </section>

        {/* DEMANDAS */}
        <section>
          <h2 className="font-serif text-xl text-primary mb-3 flex items-center gap-2">
            <Inbox className="w-5 h-5" /> Demandas
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Abertas" value={opDemandas.abertas} tone="ok" />
            <Kpi label="Em análise" value={opDemandas.emAnalise} tone="ok" />
            <Kpi label="Aguardando empresa" value={opDemandas.aguardando} tone="warn" />
            <Kpi label="Concluídas no mês" value={opDemandas.concluidasMes} tone="ok" icon={<CheckCircle2 className="w-4 h-4" />} />
            <Kpi
              label="% no prazo"
              value={opDemandas.pctPrazo == null ? "—" : `${opDemandas.pctPrazo}%`}
              tone={opDemandas.pctPrazo != null && opDemandas.pctPrazo < 80 ? "bad" : "ok"}
            />
            <Kpi label="Atrasadas" value={opDemandas.atrasadas} tone="bad" icon={<AlertTriangle className="w-4 h-4" />} />
            <Kpi
              label="Tempo médio (dias)"
              value={opDemandas.tmedio == null ? "—" : opDemandas.tmedio}
              tone="muted"
              icon={<Clock className="w-4 h-4" />}
            />
          </div>
          <Card className="mt-3 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Backlog por responsável</div>
            {opDemandas.backlog.size === 0 ? (
              <div className="text-sm text-muted-foreground">Sem demandas em aberto.</div>
            ) : (
              <ul className="space-y-1 text-sm">
                {[...opDemandas.backlog.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([uid, n]) => (
                    <li key={uid ?? "_none"} className="flex justify-between">
                      <span>{nomeMembro(uid)}</span>
                      <span className="tabular-nums font-medium">{n}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </section>

        {/* PROPOSTAS */}
        <section>
          <h2 className="font-serif text-xl text-primary mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Propostas (no mês)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Enviadas" value={opPropostas.enviadas} tone="ok" />
            <Kpi label="Aceitas" value={opPropostas.aceitas} tone="ok" />
            <Kpi label="Recusadas" value={opPropostas.recusadas} tone="bad" />
            <Kpi
              label="Conversão (aceitas / decididas)"
              value={opPropostas.taxa == null ? "—" : `${opPropostas.taxa}%`}
              tone="muted"
            />
          </div>
        </section>

        {/* CARTEIRA */}
        <section>
          <h2 className="font-serif text-xl text-primary mb-3 flex items-center gap-2">
            <Users className="w-5 h-5" /> Carteira
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Empresas com contrato" value={opCarteira.total} tone="ok" />
            <Kpi
              label="NPS médio"
              value={opCarteira.npsMedio == null ? "—" : opCarteira.npsMedio}
              tone="muted"
            />
            <Kpi label="Sem responsável" value={opCarteira.semResp} tone={opCarteira.semResp > 0 ? "warn" : "ok"} />
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Por risco</div>
              <div className="text-sm mt-1 space-y-0.5">
                <div><span className="text-red-700">Alto:</span> {opCarteira.porRisco.alto}</div>
                <div><span className="text-amber-700">Médio:</span> {opCarteira.porRisco.medio}</div>
                <div><span className="text-emerald-700">Baixo:</span> {opCarteira.porRisco.baixo}</div>
              </div>
            </Card>
          </div>
          <div className="mt-3">
            <Link to="/consultoria/carteira" className="text-sm text-primary underline">Abrir Carteira de Empresas →</Link>
          </div>
        </section>

        {/* CARGA POR PESSOA */}
        <section>
          <h2 className="font-serif text-xl text-primary mb-3 flex items-center gap-2">
            <Users className="w-5 h-5" /> Carga por pessoa
          </h2>
          <Card className="p-4">
            {opCarga.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem atribuições ainda.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="text-left py-1">Responsável</th><th className="text-right">Demandas abertas</th><th className="text-right">Empresas</th></tr>
                </thead>
                <tbody>
                  {opCarga.map((r) => (
                    <tr key={r.user_id ?? "_none"} className="border-t border-border/60">
                      <td className="py-1.5">{nomeMembro(r.user_id)}</td>
                      <td className="text-right tabular-nums">{r.demandas}</td>
                      <td className="text-right tabular-nums">{r.empresas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </section>

        {/* FINANCEIRO (RESTRITO) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl text-accent flex items-center gap-2">
              <Lock className="w-5 h-5" /> Financeiro (restrito)
            </h2>
            <StatusBadge tone="gold" label="Admin / Coordenador" className="uppercase tracking-wider" />
          </div>
          {!canSeeFinance ? (
            <Card className="p-6 border-accent/20 bg-accent/5">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Lock className="w-5 h-5" />
                <div>
                  <div className="font-medium text-foreground">Conteúdo restrito</div>
                  <div className="text-sm">Apenas administradores e coordenadores visualizam MRR, ticket médio e pipeline financeiro.</div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label="Receita recorrente (MRR)" value={fmtMoeda(fin!.mrr)} tone="accent" />
              <Kpi label="MRR novo no mês" value={fmtMoeda(fin!.mrrNovo)} tone="ok" icon={<TrendingUp className="w-4 h-4" />} />
              <Kpi label="MRR perdido no mês" value={fmtMoeda(fin!.mrrPerdido)} tone="bad" icon={<TrendingDown className="w-4 h-4" />} />
              <Kpi label="Ticket médio" value={fmtMoeda(Math.round(fin!.ticket))} tone="muted" />
              <Kpi label="Pipeline de propostas" value={fmtMoeda(fin!.pipeline)} tone="muted" />
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function Kpi({
  label, value, tone = "ok", icon,
}: { label: string; value: string | number; tone?: "ok" | "warn" | "bad" | "muted" | "accent"; icon?: React.ReactNode }) {
  const mapped =
    tone === "accent" ? "gold" :
    tone === "bad"    ? "danger" :
    tone === "warn"   ? "warning" :
    tone === "muted"  ? "neutral" :
    "success";
  return (
    <KpiCard
      label={label}
      value={value}
      tone={mapped as any}
      emphasizeValue={tone === "accent"}
      // ícone legado vinha como ReactNode; KpiCard espera LucideIcon, então renderizamos manualmente
      footer={icon ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{icon}</span> : undefined}
    />
  );
}
