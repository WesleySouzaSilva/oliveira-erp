import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus2, RefreshCw, ShieldAlert, TrendingUp, Eye, MousePointerClick, Users, DollarSign } from "lucide-react";
import { PeriodoChips, buildPeriodo, type PeriodoKey } from "@/components/metricas/PeriodoChips";
import { NichoMultiPills } from "@/components/metricas/NichoPills";
import { MetricasSkeleton } from "@/components/metricas/MetricasSkeleton";
import { useLancamentosPeriodo } from "@/hooks/useMetricas";
import { useRecorteEquipe, SEM_LIDERADOS_MSG } from "@/hooks/useSubordinados";
import { calc, fmt, type Nicho } from "@/hooks/useMetricasCalc";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend } from "recharts";

/**
 * Overview de Marketing — foco puramente em mídia paga (Meta Ads).
 * Mostra investimento, impressões, alcance, frequência, cliques, CTR, CPC, CPM, CPL e leads pagos.
 * Dados orgânicos exibidos em bloco separado abaixo (somente referência).
 */
export default function OverviewMarketing() {
  const navigate = useNavigate();
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>("30d");
  const [custom, setCustom] = useState<{ inicio: string; fim: string } | undefined>();
  const [nichos, setNichos] = useState<Nicho[]>([]);
  const periodo = useMemo(() => buildPeriodo(periodoKey, custom), [periodoKey, custom]);
  // Coordenador: só vê lançamentos dos liderados diretos (filtro de tela; RLS inalterado).
  const recorte = useRecorteEquipe();
  const { rows: rowsAll, loading, refetch } = useLancamentosPeriodo(periodo.inicio, periodo.fim, nichos);
  const rows = rowsAll.filter((r: any) => (r?.user_id === undefined ? true : recorte.permite(r.user_id)));

  const meta = useMemo(() => {
    const t = rows.reduce(
      (acc, r: any) => {
        acc.invest += Number(r.investimento || 0);
        acc.impr += r.impressoes || 0;
        acc.alcance += r.alcance || 0;
        acc.cliques += r.cliques || 0;
        acc.leadsPagos += r.leads_pagos || 0;
        return acc;
      },
      { invest: 0, impr: 0, alcance: 0, cliques: 0, leadsPagos: 0 },
    );
    return t;
  }, [rows]);

  const organico = useMemo(() => {
    return rows.reduce(
      (acc, r: any) => {
        acc.invest += Number(r.investimento_organico || 0);
        acc.impr += r.impressoes_organico || 0;
        acc.alcance += r.alcance_organico || 0;
        acc.cliques += r.cliques_organico || 0;
        acc.leadsOrg += r.leads_organicos || 0;
        return acc;
      },
      { invest: 0, impr: 0, alcance: 0, cliques: 0, leadsOrg: 0 },
    );
  }, [rows]);

  const ctr = calc.ctr(meta.cliques, meta.impr);
  const cpc = calc.cpc(meta.invest, meta.cliques);
  const cpm = calc.cpm(meta.invest, meta.impr);
  const cpl = calc.cpl(meta.invest, meta.leadsPagos);
  const frequencia = meta.alcance ? meta.impr / meta.alcance : null;
  const taxaConv = meta.cliques ? (meta.leadsPagos / meta.cliques) : null;

  const porDia = useMemo(() => {
    const map = new Map<string, { data: string; invest: number; impr: number; cliques: number; leads: number }>();
    rows.forEach((r: any) => {
      const cur = map.get(r.data) || { data: r.data, invest: 0, impr: 0, cliques: 0, leads: 0 };
      cur.invest += Number(r.investimento || 0);
      cur.impr += r.impressoes || 0;
      cur.cliques += r.cliques || 0;
      cur.leads += r.leads_pagos || 0;
      map.set(r.data, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data));
  }, [rows]);

  const porNicho = useMemo(() => {
    const map = new Map<string, { nicho: string; invest: number; cliques: number; leads: number; impr: number }>();
    rows.forEach((r: any) => {
      const cur = map.get(r.nicho) || { nicho: r.nicho, invest: 0, cliques: 0, leads: 0, impr: 0 };
      cur.invest += Number(r.investimento || 0);
      cur.cliques += r.cliques || 0;
      cur.leads += r.leads_pagos || 0;
      cur.impr += r.impressoes || 0;
      map.set(r.nicho, cur);
    });
    return Array.from(map.values()).map((n) => ({
      ...n,
      cpl: n.leads ? n.invest / n.leads : 0,
      ctr: n.impr ? (n.cliques / n.impr) * 100 : 0,
    }));
  }, [rows]);

  const sem = !loading && meta.invest === 0 && meta.impr === 0 && meta.cliques === 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70 mb-1">Mídia paga</p>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              Marketing — Meta Ads
            </h1>
            <p className="text-sm text-muted-foreground">Dados puros do Meta: alcance, frequência, cliques, CTR, CPC, CPM, CPL.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
            <Button size="sm" onClick={() => navigate("/metricas/marketing")}>
              <FilePlus2 className="w-4 h-4 mr-2" /> Novo lançamento
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <PeriodoChips value={periodoKey} onChange={setPeriodoKey} custom={periodo} onCustomChange={setCustom} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Nichos:</span>
              <NichoMultiPills value={nichos} onChange={setNichos} />
            </div>
          </CardContent>
        </Card>

        {recorte.semLiderados && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground mb-6">
            {SEM_LIDERADOS_MSG}
          </div>
        )}

        {loading ? (
          <MetricasSkeleton />
        ) : sem ? (
          <Card>
            <CardContent className="py-16 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum dado de Meta Ads no período.</p>
              <Button onClick={() => navigate("/metricas/marketing")}>
                <FilePlus2 className="w-4 h-4 mr-2" /> Lançar agora
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Bloco 1 — Investimento e alcance */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Investimento & alcance</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi icon={<DollarSign className="w-4 h-4" />} label="Investimento" value={fmt.brl(meta.invest)} />
                <Kpi icon={<Eye className="w-4 h-4" />} label="Impressões" value={fmt.num(meta.impr)} />
                <Kpi icon={<Users className="w-4 h-4" />} label="Alcance" value={fmt.num(meta.alcance)} />
                <Kpi label="Frequência" value={frequencia == null ? "—" : `${frequencia.toFixed(2)}x`} sub="Impressões / alcance" />
              </div>
            </div>

            {/* Bloco 2 — Engajamento */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Engajamento</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi icon={<MousePointerClick className="w-4 h-4" />} label="Cliques" value={fmt.num(meta.cliques)} />
                <Kpi label="CTR" value={ctr == null ? "—" : `${(ctr * 100).toFixed(2)}%`} sub="Cliques / impressões" />
                <Kpi label="CPC" value={cpc == null ? "—" : fmt.brl(cpc)} sub="Custo por clique" />
                <Kpi label="CPM" value={cpm == null ? "—" : fmt.brl(cpm)} sub="Custo por mil impressões" />
              </div>
            </div>

            {/* Bloco 3 — Conversão para lead */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Conversão em lead</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Leads pagos" value={fmt.num(meta.leadsPagos)} />
                <Kpi label="CPL" value={cpl == null ? "—" : fmt.brl(cpl)} sub="Custo por lead pago" />
                <Kpi label="Taxa clique→lead" value={taxaConv == null ? "—" : `${(taxaConv * 100).toFixed(2)}%`} />
                <Kpi label="% Pagos no total" value={`${calc.proporcaoPago(meta.leadsPagos, organico.leadsOrg) == null ? "—" : ((calc.proporcaoPago(meta.leadsPagos, organico.leadsOrg) as number) * 100).toFixed(1) + "%"}`} sub={`vs ${fmt.num(organico.leadsOrg)} orgânicos`} />
              </div>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Evolução diária — Investimento vs Leads pagos</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={porDia}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="data" tickFormatter={(v) => v.slice(5)} fontSize={11} />
                    <YAxis yAxisId="left" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" fontSize={11} />
                    <ReTooltip />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="invest" name="Investimento (R$)" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" />
                    <Area yAxisId="right" type="monotone" dataKey="leads" name="Leads pagos" stroke="hsl(var(--accent))" fill="hsl(var(--accent)/0.2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Performance por nicho</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porNicho}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="nicho" fontSize={11} />
                    <YAxis fontSize={11} />
                    <ReTooltip />
                    <Legend />
                    <Bar dataKey="invest" name="Investimento" fill="hsl(var(--primary))" />
                    <Bar dataKey="leads" name="Leads pagos" fill="hsl(var(--accent))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Orgânico em referência separada */}
            {(organico.impr > 0 || organico.leadsOrg > 0) && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base">Tráfego orgânico (referência)</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Kpi label="Impressões orgânicas" value={fmt.num(organico.impr)} />
                  <Kpi label="Alcance orgânico" value={fmt.num(organico.alcance)} />
                  <Kpi label="Cliques orgânicos" value={fmt.num(organico.cliques)} />
                  <Kpi label="Leads orgânicos" value={fmt.num(organico.leadsOrg)} />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Kpi({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <p className="text-xs">{label}</p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}