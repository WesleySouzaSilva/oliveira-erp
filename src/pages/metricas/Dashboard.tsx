import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Pencil, Download, Loader2, FilePlus2 } from "lucide-react";
import { MetricKpiCard } from "@/components/metricas/MetricKpiCard";
import { PageLoader } from "@/components/ui/loaders";
import { FunnelDuplo } from "@/components/metricas/FunnelDuplo";
import { NichoCard } from "@/components/metricas/NichoCard";
import { OrigemDonut } from "@/components/metricas/OrigemDonut";
import { NichoMultiPills } from "@/components/metricas/NichoPills";
import { TentativasDataFutura } from "@/components/metricas/TentativasDataFutura";
import { PeriodoChips, buildPeriodo, periodoAnterior, type PeriodoKey } from "@/components/metricas/PeriodoChips";
import {
  useLancamentosPeriodo,
  useOrganicosPeriodo,
  useMetas,
  useMetasIndividuais,
  type LancamentoDiario,
} from "@/hooks/useMetricas";
import { calc, fmt, NICHOS, MOTIVOS_PERDA, type Nicho } from "@/hooks/useMetricasCalc";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from "recharts";

function aggregate(rows: LancamentoDiario[]) {
  return rows.reduce(
    (acc, r) => {
      acc.investimento += Number(r.investimento || 0);
      acc.impressoes += r.impressoes || 0;
      acc.cliques += r.cliques || 0;
      acc.leads_pagos += r.leads_pagos || 0;
      acc.leads_organicos += r.leads_organicos || 0;
      acc.qualif += r.leads_qualificados_sdr || 0;
      acc.agendadas += r.reunioes_agendadas || 0;
      acc.realizadas += r.reunioes_realizadas || 0;
      acc.propostas += r.propostas_enviadas || 0;
      acc.contratos += r.contratos_fechados || 0;
      acc.receita += Number(r.receita_fechada || 0);
      acc.perdidos += r.contratos_perdidos || 0;
      return acc;
    },
    {
      investimento: 0, impressoes: 0, cliques: 0, leads_pagos: 0, leads_organicos: 0,
      qualif: 0, agendadas: 0, realizadas: 0, propostas: 0, contratos: 0, receita: 0, perdidos: 0,
    }
  );
}

function toCSV(rows: any[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(";"), ...rows.map((r) => headers.map((h) => `"${(r[h] ?? "").toString().replace(/"/g, '""')}"`).join(";"))];
  return lines.join("\n");
}

export default function MetricasDashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>("30d");
  const [custom, setCustom] = useState<{ inicio: string; fim: string } | undefined>();
  const [nichos, setNichos] = useState<Nicho[]>([]);
  const [comparar, setComparar] = useState(true);

  const periodo = useMemo(() => buildPeriodo(periodoKey, custom), [periodoKey, custom]);
  const periodoAnt = useMemo(() => periodoAnterior(periodo), [periodo]);

  const { rows: lancs, loading: l1 } = useLancamentosPeriodo(periodo.inicio, periodo.fim, nichos);
  const { rows: lancsAnt } = useLancamentosPeriodo(periodoAnt.inicio, periodoAnt.fim, nichos);
  const { rows: organicos, loading: l2 } = useOrganicosPeriodo(periodo.inicio, periodo.fim, nichos);
  const { metas } = useMetas(now.getMonth() + 1, now.getFullYear());
  const { rows: metasInd } = useMetasIndividuais(now.getMonth() + 1, now.getFullYear());
  const { members } = useOrgMembers();
  const memberName = (uid: string) =>
    members.find((m) => m.user_id === uid)?.nome || uid.slice(0, 8);

  const agg = useMemo(() => aggregate(lancs), [lancs]);
  const aggAnt = useMemo(() => aggregate(lancsAnt), [lancsAnt]);

  // Totais de meta vs realizado (todos os nichos do mês corrente)
  const totalMetaReceita = useMemo(
    () => metas.reduce((s, m) => s + Number(m.meta_receita || 0), 0),
    [metas],
  );
  const totalMetaContratos = useMemo(
    () => metas.reduce((s, m) => s + (m.meta_contratos || 0), 0),
    [metas],
  );
  const pctReceita = totalMetaReceita ? Math.round((agg.receita / totalMetaReceita) * 100) : 0;
  const pctContratos = totalMetaContratos ? Math.round((agg.contratos / totalMetaContratos) * 100) : 0;

  // Ranking closers e SDRs no período
  const rankingCloser = useMemo(() => {
    const map = new Map<string, { receita: number; contratos: number }>();
    lancs.forEach((l: any) => {
      if (!l.closer_id) return;
      const cur = map.get(l.closer_id) || { receita: 0, contratos: 0 };
      cur.receita += Number(l.receita_fechada || 0);
      cur.contratos += l.contratos_fechados || 0;
      map.set(l.closer_id, cur);
    });
    return Array.from(map.entries())
      .map(([uid, v]) => {
        const meta = metasInd.find((m) => m.membro_user_id === uid);
        return {
          uid,
          nome: memberName(uid),
          ...v,
          metaReceita: Number(meta?.meta_receita || 0),
          metaContratos: meta?.meta_contratos || 0,
        };
      })
      .sort((a, b) => b.receita - a.receita);
  }, [lancs, metasInd, members]);

  const rankingSdr = useMemo(() => {
    const map = new Map<string, { qualif: number; agendadas: number }>();
    lancs.forEach((l: any) => {
      if (!l.sdr_id) return;
      const cur = map.get(l.sdr_id) || { qualif: 0, agendadas: 0 };
      cur.qualif += l.leads_qualificados_sdr || 0;
      cur.agendadas += l.reunioes_agendadas || 0;
      map.set(l.sdr_id, cur);
    });
    return Array.from(map.entries())
      .map(([uid, v]) => {
        const meta = metasInd.find((m) => m.membro_user_id === uid);
        return {
          uid,
          nome: memberName(uid),
          ...v,
          metaQualif: meta?.meta_leads_qualificados || 0,
        };
      })
      .sort((a, b) => b.qualif - a.qualif);
  }, [lancs, metasInd, members]);

  const totalLeads = agg.leads_pagos + agg.leads_organicos;
  const totalLeadsAnt = aggAnt.leads_pagos + aggAnt.leads_organicos;
  const roas = calc.roas(agg.receita, agg.investimento);

  // Funil duplo proporcional
  const propPago = calc.proporcaoPago(agg.leads_pagos, agg.leads_organicos) ?? 0;
  const buildFunil = (proporcao: number) => {
    const round = (n: number) => Math.round(n * proporcao);
    return [
      { label: "Leads", value: round(totalLeads) },
      { label: "Qualificados", value: round(agg.qualif) },
      { label: "Reuniões Agendadas", value: round(agg.agendadas) },
      { label: "Reuniões Realizadas", value: round(agg.realizadas) },
      { label: "Propostas", value: round(agg.propostas) },
      { label: "Contratos", value: round(agg.contratos) },
    ];
  };
  const funilPago = buildFunil(propPago);
  const funilOrg = buildFunil(1 - propPago);
  // Ajustar o primeiro stage com valores absolutos reais
  funilPago[0].value = agg.leads_pagos;
  funilOrg[0].value = agg.leads_organicos;

  // Por nicho
  const porNicho = useMemo(() => {
    return NICHOS.map((n) => {
      const ln = lancs.filter((r) => r.nicho === n.value);
      const a = aggregate(ln);
      const sparkline = ln
        .sort((x, y) => x.data.localeCompare(y.data))
        .map((r) => ({ data: r.data, receita: Number(r.receita_fechada || 0) }));
      const meta = metas.find((m) => m.nicho === n.value);
      return {
        nicho: n.value,
        agg: a,
        sparkline,
        meta: meta
          ? {
              investimento: Number(meta.meta_investimento || 0),
              leads: (meta.meta_leads_pagos || 0) + (meta.meta_leads_organicos || 0),
              contratos: meta.meta_contratos || 0,
              receita: Number(meta.meta_receita || 0),
            }
          : undefined,
      };
    });
  }, [lancs, metas]);

  // Origens orgânicas agregadas
  const origensAgg = useMemo(() => {
    const map = new Map<string, number>();
    organicos.forEach((o) => map.set(o.origem_tipo, (map.get(o.origem_tipo) || 0) + (o.quantidade || 0)));
    return Array.from(map.entries()).map(([origem_tipo, quantidade]) => ({ origem_tipo, quantidade }));
  }, [organicos]);

  // Ranking indicadores
  const ranking = useMemo(() => {
    const map = new Map<string, number>();
    organicos
      .filter((o) => o.origem_tipo === "indicacao" && o.indicado_por)
      .forEach((o) => map.set(o.indicado_por!, (map.get(o.indicado_por!) || 0) + (o.quantidade || 0)));
    const arr = Array.from(map.entries()).map(([nome, qtd]) => ({ nome, qtd }));
    const total = arr.reduce((s, r) => s + r.qtd, 0);
    return arr
      .sort((a, b) => b.qtd - a.qtd)
      .map((r) => ({ ...r, pct: total ? (r.qtd / total) * 100 : 0 }));
  }, [organicos]);

  // Série diária para gráficos
  const serieDiaria = useMemo(() => {
    const map = new Map<string, { data: string; pagos: number; organicos: number; receita: number; investimento: number }>();
    lancs.forEach((r) => {
      const prev = map.get(r.data) || { data: r.data, pagos: 0, organicos: 0, receita: 0, investimento: 0 };
      prev.pagos += r.leads_pagos || 0;
      prev.organicos += r.leads_organicos || 0;
      prev.receita += Number(r.receita_fechada || 0);
      prev.investimento += Number(r.investimento || 0);
      map.set(r.data, prev);
    });
    return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data));
  }, [lancs]);

  const serieAcumulada = useMemo(() => {
    let r = 0, i = 0;
    return serieDiaria.map((d) => {
      r += d.receita;
      i += d.investimento;
      return { data: d.data, receita: r, investimento: i };
    });
  }, [serieDiaria]);

  // Motivos de perda
  const motivosPerda = useMemo(() => {
    const map = new Map<string, number>();
    lancs.forEach((r) => {
      if (r.motivo_perda_principal && r.contratos_perdidos) {
        map.set(r.motivo_perda_principal, (map.get(r.motivo_perda_principal) || 0) + r.contratos_perdidos);
      }
    });
    const labels = Object.fromEntries(MOTIVOS_PERDA.map((m) => [m.value, m.label]));
    return Array.from(map.entries()).map(([k, v]) => ({ name: labels[k] || k, value: v }));
  }, [lancs]);

  // Funil por nicho (barras agrupadas)
  const funilPorNicho = porNicho.map((n) => ({
    nicho: n.nicho,
    leads: n.agg.leads_pagos + n.agg.leads_organicos,
    qualificados: n.agg.qualif,
    propostas: n.agg.propostas,
    contratos: n.agg.contratos,
  }));

  const exportCSV = () => {
    const rows = lancs.map((r) => ({
      Data: fmt.data(r.data),
      Nicho: r.nicho,
      Investimento: r.investimento,
      LeadsPagos: r.leads_pagos,
      LeadsOrganicos: r.leads_organicos,
      Qualificados: r.leads_qualificados_sdr,
      ReunioesRealizadas: r.reunioes_realizadas,
      Propostas: r.propostas_enviadas,
      Contratos: r.contratos_fechados,
      Receita: r.receita_fechada,
      CPL: calc.cpl(Number(r.investimento), r.leads_pagos) ?? "",
      ROAS: calc.roas(Number(r.receita_fechada), Number(r.investimento)) ?? "",
    }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metricas_${periodo.inicio}_${periodo.fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loading = l1 || l2;
  const empty = !loading && lancs.length === 0;

  // Sparklines por KPI (a partir da série diária)
  const sparkLeads = serieDiaria.map((d) => ({ v: d.pagos + d.organicos }));
  const sparkReceita = serieDiaria.map((d) => ({ v: d.receita }));
  const sparkInvest = serieDiaria.map((d) => ({ v: d.investimento }));
  const sparkContratos = serieDiaria.map((d) => ({ v: 0 })); // contratos não na serie
  // Reaproveita lancs para contratos diários
  const sparkContratosReal = (() => {
    const map = new Map<string, number>();
    lancs.forEach((r) => map.set(r.data, (map.get(r.data) || 0) + (r.contratos_fechados || 0)));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => ({ v }));
  })();
  const sparkRoas = serieAcumulada.map((d) => ({ v: d.investimento ? d.receita / d.investimento : 0 }));

  const roasBg: "gold" | "success" | "danger" | "default" = roas == null
    ? "default"
    : roas >= 3 ? "gold"
    : roas >= 1 ? "success"
    : "danger";

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70 mb-1">Painel executivo</p>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                Métricas — Marketing + Comercial
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Visão cruzada do funil completo por nicho.</p>
            </div>
            <Button onClick={() => navigate("/metricas/lancamento")}>
              <FilePlus2 className="w-4 h-4 mr-2" />
              Novo lançamento
            </Button>
          </div>

          <TentativasDataFutura days={30} />

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <PeriodoChips
                  value={periodoKey}
                  onChange={setPeriodoKey}
                  custom={periodo}
                  onCustomChange={setCustom}
                />
                <div className="flex items-center gap-2 ml-auto">
                  <Switch id="comp" checked={comparar} onCheckedChange={setComparar} />
                  <Label htmlFor="comp" className="text-xs cursor-pointer">
                    Comparar com período anterior
                  </Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Nichos:</span>
                <NichoMultiPills value={nichos} onChange={setNichos} />
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <PageLoader label="Calculando métricas..." />
          ) : empty ? (
            <Card>
              <CardContent className="py-16 text-center space-y-4">
                <p className="text-muted-foreground">Nenhum lançamento no período selecionado.</p>
                <Button onClick={() => navigate("/metricas/lancamento")}>
                  <FilePlus2 className="w-4 h-4 mr-2" />
                  Fazer primeiro lançamento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* SEÇÃO 1 — KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricKpiCard
                  label="Leads Totais"
                  value={fmt.num(totalLeads)}
                  split={{ pago: agg.leads_pagos, organico: agg.leads_organicos }}
                  variacao={comparar ? calc.variacaoPct(totalLeads, totalLeadsAnt) : undefined}
                  sparkline={sparkLeads}
                />
                <MetricKpiCard
                  label="Contratos"
                  value={fmt.num(agg.contratos)}
                  variacao={comparar ? calc.variacaoPct(agg.contratos, aggAnt.contratos) : undefined}
                  sparkline={sparkContratosReal}
                />
                <MetricKpiCard
                  label="Receita"
                  value={fmt.brl(agg.receita)}
                  variacao={comparar ? calc.variacaoPct(agg.receita, aggAnt.receita) : undefined}
                  sparkline={sparkReceita}
                  bgVariant="success"
                />
                <MetricKpiCard
                  label="Investimento Meta"
                  value={fmt.brl(agg.investimento)}
                  variacao={comparar ? calc.variacaoPct(agg.investimento, aggAnt.investimento) : undefined}
                  sparkline={sparkInvest}
                />
                <MetricKpiCard
                  label="ROAS Geral"
                  value={fmt.roas(roas)}
                  bgVariant={roasBg}
                  variacao={comparar ? calc.variacaoPct(roas ?? 0, calc.roas(aggAnt.receita, aggAnt.investimento) ?? 0) : undefined}
                  sparkline={sparkRoas}
                />
              </div>

              {/* SEÇÃO 1A — Conversões e Ticket Médio */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricKpiCard
                  label="Conversão Lead → Contrato"
                  value={fmt.pctFrac(calc.taxaFechamentoTotal(agg.contratos, agg.leads_pagos, agg.leads_organicos))}
                  variacao={comparar ? calc.variacaoPct(
                    (calc.taxaFechamentoTotal(agg.contratos, agg.leads_pagos, agg.leads_organicos) ?? 0) * 100,
                    (calc.taxaFechamentoTotal(aggAnt.contratos, aggAnt.leads_pagos, aggAnt.leads_organicos) ?? 0) * 100,
                  ) : undefined}
                  bgVariant="success"
                />
                <MetricKpiCard
                  label="Ticket Médio"
                  value={fmt.brl(calc.ticketMedio(agg.receita, agg.contratos))}
                  variacao={comparar ? calc.variacaoPct(
                    calc.ticketMedio(agg.receita, agg.contratos) ?? 0,
                    calc.ticketMedio(aggAnt.receita, aggAnt.contratos) ?? 0,
                  ) : undefined}
                  bgVariant="gold"
                />
                <MetricKpiCard
                  label="Taxa de Qualificação"
                  value={fmt.pctFrac(calc.taxaQualificacao(agg.qualif, agg.leads_pagos, agg.leads_organicos))}
                  variacao={comparar ? calc.variacaoPct(
                    (calc.taxaQualificacao(agg.qualif, agg.leads_pagos, agg.leads_organicos) ?? 0) * 100,
                    (calc.taxaQualificacao(aggAnt.qualif, aggAnt.leads_pagos, aggAnt.leads_organicos) ?? 0) * 100,
                  ) : undefined}
                />
                <MetricKpiCard
                  label="Taxa de Comparecimento"
                  value={fmt.pctFrac(calc.taxaComparecimento(agg.realizadas, agg.agendadas))}
                  variacao={comparar ? calc.variacaoPct(
                    (calc.taxaComparecimento(agg.realizadas, agg.agendadas) ?? 0) * 100,
                    (calc.taxaComparecimento(aggAnt.realizadas, aggAnt.agendadas) ?? 0) * 100,
                  ) : undefined}
                />
                <MetricKpiCard
                  label="Fechamento (Proposta → Contrato)"
                  value={fmt.pctFrac(calc.taxaFechamento(agg.contratos, agg.propostas))}
                  variacao={comparar ? calc.variacaoPct(
                    (calc.taxaFechamento(agg.contratos, agg.propostas) ?? 0) * 100,
                    (calc.taxaFechamento(aggAnt.contratos, aggAnt.propostas) ?? 0) * 100,
                  ) : undefined}
                />
                <MetricKpiCard
                  label="CPL (Custo por Lead)"
                  value={fmt.brl(calc.cpl(agg.investimento, agg.leads_pagos))}
                  variacao={comparar ? calc.variacaoPct(
                    calc.cpl(agg.investimento, agg.leads_pagos) ?? 0,
                    calc.cpl(aggAnt.investimento, aggAnt.leads_pagos) ?? 0,
                  ) : undefined}
                />
              </div>

              {/* SEÇÃO 1B — Metas do mês (total) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Meta de receita (mês)</p>
                    <p className="text-2xl font-bold">{fmt.brl(totalMetaReceita)}</p>
                    <p className="text-xs text-muted-foreground">
                      Vendido até agora: <span className="font-semibold text-foreground">{fmt.brl(agg.receita)}</span>
                    </p>
                    <div className="h-2 rounded-full bg-muted overflow-hidden mt-1">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, pctReceita)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{pctReceita}% atingido</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Meta de contratos (mês)</p>
                    <p className="text-2xl font-bold">{totalMetaContratos}</p>
                    <p className="text-xs text-muted-foreground">
                      Fechados: <span className="font-semibold text-foreground">{agg.contratos}</span>
                    </p>
                    <div className="h-2 rounded-full bg-muted overflow-hidden mt-1">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, pctContratos)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{pctContratos}% atingido</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Pessoas com meta</p>
                    <p className="text-2xl font-bold">{metasInd.length}</p>
                    <p className="text-xs text-muted-foreground">
                      Closers/SDRs com metas individuais ativas neste mês
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* SEÇÃO 1C — Ranking closers e SDRs */}
              <div className="grid md:grid-cols-2 gap-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ranking de Closers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rankingCloser.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhum lançamento vinculado a closer no período.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Closer</TableHead>
                            <TableHead className="text-right">Receita</TableHead>
                            <TableHead className="text-right">Contratos</TableHead>
                            <TableHead className="text-right">% Meta</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankingCloser.map((r, i) => {
                            const pct = r.metaReceita ? Math.round((r.receita / r.metaReceita) * 100) : 0;
                            return (
                              <TableRow key={r.uid}>
                                <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                                <TableCell className="font-medium">{r.nome}</TableCell>
                                <TableCell className="text-right">{fmt.brl(r.receita)}</TableCell>
                                <TableCell className="text-right">{r.contratos}</TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {r.metaReceita ? `${pct}%` : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ranking de SDRs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rankingSdr.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhum lançamento vinculado a SDR no período.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>SDR</TableHead>
                            <TableHead className="text-right">Qualificados</TableHead>
                            <TableHead className="text-right">Reuniões</TableHead>
                            <TableHead className="text-right">% Meta</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankingSdr.map((r, i) => {
                            const pct = r.metaQualif ? Math.round((r.qualif / r.metaQualif) * 100) : 0;
                            return (
                              <TableRow key={r.uid}>
                                <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                                <TableCell className="font-medium">{r.nome}</TableCell>
                                <TableCell className="text-right">{r.qualif}</TableCell>
                                <TableCell className="text-right">{r.agendadas}</TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {r.metaQualif ? `${pct}%` : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* SEÇÃO 2 — Funil duplo */}
              <FunnelDuplo pago={funilPago} organico={funilOrg} />

              {/* SEÇÃO 3 — Por nicho */}
              <div className="grid md:grid-cols-3 gap-3">
                {porNicho.map((n) => (
                  <NichoCard
                    key={n.nicho}
                    nicho={n.nicho}
                    leadsPagos={n.agg.leads_pagos}
                    leadsOrganicos={n.agg.leads_organicos}
                    contratos={n.agg.contratos}
                    receita={n.agg.receita}
                    investimento={n.agg.investimento}
                    sparkline={n.sparkline}
                    metas={n.meta}
                  />
                ))}
              </div>

              {/* SEÇÃO 4 + 5 — Origens + Indicadores */}
              <div className="grid md:grid-cols-2 gap-3">
                <OrigemDonut data={origensAgg} />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ranking de Indicadores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ranking.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Sem indicações no período.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Indicado por</TableHead>
                            <TableHead className="text-right">Leads</TableHead>
                            <TableHead className="text-right">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ranking.slice(0, 10).map((r) => (
                            <TableRow key={r.nome}>
                              <TableCell className="font-medium">{r.nome}</TableCell>
                              <TableCell className="text-right">{fmt.num(r.qtd)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{r.pct.toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* SEÇÃO 6 — Gráficos */}
              <div className="grid md:grid-cols-2 gap-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Leads diários</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={serieDiaria}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="data" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                        <YAxis fontSize={10} />
                        <ReTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="pagos" stroke="hsl(var(--primary))" name="Pagos" />
                        <Line type="monotone" dataKey="organicos" stroke="hsl(var(--accent))" name="Orgânicos" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Receita vs Investimento (acumulado)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={serieAcumulada}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="data" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                        <YAxis fontSize={10} />
                        <ReTooltip formatter={(v: any) => fmt.brl(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="receita" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" name="Receita" />
                        <Area type="monotone" dataKey="investimento" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.3)" name="Investimento" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Funil por nicho</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funilPorNicho}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="nicho" fontSize={10} />
                        <YAxis fontSize={10} />
                        <ReTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="leads" fill="hsl(var(--primary))" name="Leads" />
                        <Bar dataKey="qualificados" fill="hsl(var(--accent))" name="Qualif." />
                        <Bar dataKey="propostas" fill="hsl(var(--primary) / 0.6)" name="Propostas" />
                        <Bar dataKey="contratos" fill="hsl(var(--accent) / 0.6)" name="Contratos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Motivos de perda</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    {motivosPerda.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-12">Sem perdas registradas.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={motivosPerda} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} label>
                            {motivosPerda.map((_, i) => (
                              <Cell key={i} fill={`hsl(var(--primary) / ${1 - i * 0.12})`} />
                            ))}
                          </Pie>
                          <ReTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* SEÇÃO 7 — Tabela */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Detalhamento diário</CardTitle>
                  <Button size="sm" variant="outline" onClick={exportCSV}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Nicho</TableHead>
                        <TableHead className="text-right">Inv.</TableHead>
                        <TableHead className="text-right">L. Pago</TableHead>
                        <TableHead className="text-right">L. Org.</TableHead>
                        <TableHead className="text-right">Qualif.</TableHead>
                        <TableHead className="text-right">Reuniões</TableHead>
                        <TableHead className="text-right">Propostas</TableHead>
                        <TableHead className="text-right">Contratos</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">CPL</TableHead>
                        <TableHead className="text-right">ROAS</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lancs.map((r) => (
                        <TableRow key={r.id} className="hover:bg-muted/40">
                          <TableCell>{fmt.data(r.data)}</TableCell>
                          <TableCell className="capitalize">{r.nicho}</TableCell>
                          <TableCell className="text-right">{fmt.brl(Number(r.investimento))}</TableCell>
                          <TableCell className="text-right">{r.leads_pagos}</TableCell>
                          <TableCell className="text-right">{r.leads_organicos}</TableCell>
                          <TableCell className="text-right">{r.leads_qualificados_sdr}</TableCell>
                          <TableCell className="text-right">{r.reunioes_realizadas}</TableCell>
                          <TableCell className="text-right">{r.propostas_enviadas}</TableCell>
                          <TableCell className="text-right">{r.contratos_fechados}</TableCell>
                          <TableCell className="text-right">{fmt.brl(Number(r.receita_fechada))}</TableCell>
                          <TableCell className="text-right">{fmt.brl(calc.cpl(Number(r.investimento), r.leads_pagos))}</TableCell>
                          <TableCell className="text-right">{fmt.roas(calc.roas(Number(r.receita_fechada), Number(r.investimento)))}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => navigate(`/metricas/lancamento?data=${r.data}&nicho=${r.nicho}`)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}