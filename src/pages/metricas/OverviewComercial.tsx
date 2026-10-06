import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FilePlus2, RefreshCw, ShieldAlert, Briefcase, CheckCircle2, XCircle, Trophy, Target, AlertTriangle, ShieldCheck, Eye, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { PeriodoChips, buildPeriodo, type PeriodoKey } from "@/components/metricas/PeriodoChips";
import { NichoMultiPills } from "@/components/metricas/NichoPills";
import { MetricasSkeleton } from "@/components/metricas/MetricasSkeleton";
import { useMetricasAgregado } from "@/hooks/useMetricasAgregado";
import { calc, fmt, type Nicho } from "@/hooks/useMetricasCalc";
import { useMetasIndividuais } from "@/hooks/useMetricas";
import { useContratosFechados } from "@/hooks/useContratosFechados";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useRecorteEquipe, SEM_LIDERADOS_MSG } from "@/hooks/useSubordinados";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

/**
 * Overview Comercial — foco em taxas de conversão do funil.
 * Destaque: % qualificação, % desqualificação, % comparecimento, % proposta, % fechamento.
 */
export default function OverviewComercial() {
  const navigate = useNavigate();
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>("30d");
  const [custom, setCustom] = useState<{ inicio: string; fim: string } | undefined>();
  const [nichos, setNichos] = useState<Nicho[]>([]);
  const periodo = useMemo(() => buildPeriodo(periodoKey, custom), [periodoKey, custom]);
  const { data, loading, refresh } = useMetricasAgregado(periodo.inicio, periodo.fim, nichos);

  // Metas do mês corrente — soma das metas individuais dos closers (visão de equipe)
  const now = new Date();
  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [ano, setAno] = useState<number>(now.getFullYear());
  // Coordenador: só vê os liderados diretos (filtro de tela; RLS inalterado).
  const recorte = useRecorteEquipe();
  const { rows: metasIndAll } = useMetasIndividuais(mes, ano);
  const metasInd = metasIndAll.filter((m: any) => recorte.permite(m.membro_user_id));
  // Fonte de verdade: contratos fechados (com data_pagamento = entrada confirmada)
  const { rows: contratosMesAll } = useContratosFechados({ mes, ano });
  const contratosMes = contratosMesAll.filter((c: any) => recorte.permite(c.closer_id));
  const { members } = useOrgMembers();
  const memberName = (uid: string) =>
    members.find((m) => m.user_id === uid)?.nome || uid.slice(0, 8);

  const realizadoCloser = useMemo(() => {
    const map = new Map<string, { valorTotal: number; entradaConfirmada: number; contratos: number }>();
    contratosMes.forEach((c: any) => {
      if (!c.closer_id) return;
      const cur = map.get(c.closer_id) || { valorTotal: 0, entradaConfirmada: 0, contratos: 0 };
      cur.valorTotal += Number(c.valor_total || 0);
      // Entrada só soma quando o pagamento foi confirmado
      if (c.data_pagamento) {
        cur.entradaConfirmada += Number(c.valor_entrada || 0);
      }
      cur.contratos += 1;
      map.set(c.closer_id, cur);
    });
    return map;
  }, [contratosMes]);

  const equipeMeta = useMemo(() => {
    const sumTotal = metasInd.reduce((s, m) => s + Number(m.meta_valor_total_contratos || 0), 0);
    const sumEntrada = metasInd.reduce((s, m) => {
      const tot = Number(m.meta_valor_total_contratos || 0);
      const pct = Number(m.pct_entrada || 0);
      return s + (tot * pct) / 100;
    }, 0);
    const sumContratos = metasInd.reduce((s, m) => s + (m.meta_contratos || 0), 0);
    const sumSupermeta = metasInd.reduce((s, m) => s + Number(m.meta_supermeta_valor_total || 0), 0);
    const realValorTotal = Array.from(realizadoCloser.values()).reduce((s, v) => s + v.valorTotal, 0);
    const realEntrada = Array.from(realizadoCloser.values()).reduce((s, v) => s + v.entradaConfirmada, 0);
    const realContratos = Array.from(realizadoCloser.values()).reduce((s, v) => s + v.contratos, 0);
    return { sumTotal, sumEntrada, sumContratos, sumSupermeta, realValorTotal, realEntrada, realContratos };
  }, [metasInd, realizadoCloser]);

  const rankingCloser = useMemo(() => {
    return metasInd
      .map((m) => {
        const real = realizadoCloser.get(m.membro_user_id) || { valorTotal: 0, entradaConfirmada: 0, contratos: 0 };
        const metaTotal = Number(m.meta_valor_total_contratos || 0);
        const metaEntrada = (metaTotal * Number(m.pct_entrada || 0)) / 100;
        const pctValor = metaTotal > 0 ? Math.min(100, Math.round((real.valorTotal / metaTotal) * 100)) : 0;
        const pctEntrada = metaEntrada > 0 ? Math.min(100, Math.round((real.entradaConfirmada / metaEntrada) * 100)) : 0;
        return {
          uid: m.membro_user_id,
          nome: memberName(m.membro_user_id),
          realValor: real.valorTotal,
          realEntrada: real.entradaConfirmada,
          realContratos: real.contratos,
          metaTotal,
          metaEntrada,
          metaContratos: m.meta_contratos || 0,
          pctValor,
          pctEntrada,
        };
      })
      .sort((a, b) => b.realValor - a.realValor);
  }, [metasInd, realizadoCloser, members]);

  // Verificação automática: soma das individuais x agregação por contratos
  const verificacao = useMemo(() => {
    const EPS = 0.01;
    const somaIndValor = rankingCloser.reduce((s, r) => s + r.realValor, 0);
    const somaIndEntrada = rankingCloser.reduce((s, r) => s + r.realEntrada, 0);
    const somaIndContratos = rankingCloser.reduce((s, r) => s + r.realContratos, 0);

    // Contratos atribuídos a closers sem meta cadastrada no mês
    const metaUids = new Set(metasInd.map((m) => m.membro_user_id));
    const semMeta = Array.from(realizadoCloser.entries())
      .filter(([uid]) => !metaUids.has(uid))
      .map(([uid, v]) => ({ uid, nome: memberName(uid), ...v }));
    const semMetaValor = semMeta.reduce((s, x) => s + x.valorTotal, 0);
    const semMetaContratos = semMeta.reduce((s, x) => s + x.contratos, 0);

    // Contratos sem closer atribuído
    const semCloser = contratosMes.filter((c: any) => !c.closer_id);
    const semCloserValor = semCloser.reduce((s: number, c: any) => s + Number(c.valor_total || 0), 0);

    // Diferença equipe (deve ser zero — quando há, indica closers sem meta)
    const diffValor = equipeMeta.realValorTotal - somaIndValor;
    const diffEntrada = equipeMeta.realEntrada - somaIndEntrada;
    const diffContratos = equipeMeta.realContratos - somaIndContratos;

    const issues: string[] = [];
    if (semMeta.length > 0) {
      issues.push(
        `${semMeta.length} closer(s) sem meta cadastrada no mês: ${semMeta.map((s) => s.nome).join(", ")} (${fmt.brl(semMetaValor)}, ${semMetaContratos} contrato(s))`,
      );
    }
    if (semCloser.length > 0) {
      issues.push(`${semCloser.length} contrato(s) sem closer atribuído (${fmt.brl(semCloserValor)})`);
    }
    if (Math.abs(diffValor) > EPS || Math.abs(diffEntrada) > EPS || diffContratos !== 0) {
      // Só aparece se for divergência além das já reportadas
      if (semMeta.length === 0 && semCloser.length === 0) {
        issues.push("Soma das individuais difere da equipe. Reabra a página para revalidar.");
      }
    }

    return {
      ok: issues.length === 0,
      issues,
      somaIndValor,
      somaIndEntrada,
      somaIndContratos,
      semMeta,
      semCloser: semCloser.length,
      semCloserValor,
    };
  }, [rankingCloser, metasInd, realizadoCloser, contratosMes, equipeMeta]);

  // Alerta automático (toast) quando há divergência no mês selecionado
  const lastAlertKey = useRef<string>("");
  useEffect(() => {
    if (metasInd.length === 0) return;
    const key = `${ano}-${mes}-${verificacao.ok ? "ok" : verificacao.issues.join("|")}`;
    if (key === lastAlertKey.current) return;
    lastAlertKey.current = key;
    if (!verificacao.ok) {
      const refMes = new Date(ano, mes - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });
      toast.warning(`Divergência nas metas — ${refMes}`, {
        description: verificacao.issues[0] + (verificacao.issues.length > 1 ? ` (+${verificacao.issues.length - 1})` : ""),
        duration: 6000,
      });
    }
  }, [verificacao, mes, ano, metasInd.length]);

  const pctEquipeValor = equipeMeta.sumTotal > 0
    ? Math.min(100, Math.round((equipeMeta.realValorTotal / equipeMeta.sumTotal) * 100))
    : 0;
  const pctEquipeEntrada = equipeMeta.sumEntrada > 0
    ? Math.min(100, Math.round((equipeMeta.realEntrada / equipeMeta.sumEntrada) * 100))
    : 0;
  const pctEquipeContratos = equipeMeta.sumContratos > 0
    ? Math.min(100, Math.round((equipeMeta.realContratos / equipeMeta.sumContratos) * 100))
    : 0;

  const t = data.totais;
  const totalLeads = t.leads_pagos + t.leads_organicos;
  const desqualificados = Math.max(0, totalLeads - t.leads_qualificados);
  const taxaQualif = calc.taxaQualificacao(t.leads_qualificados, t.leads_pagos, t.leads_organicos);
  const taxaDesqualif = totalLeads ? desqualificados / totalLeads : null;
  const taxaAgend = calc.taxaAgendamento(t.reunioes_agendadas, t.leads_qualificados);
  const taxaComp = calc.taxaComparecimento(t.reunioes_realizadas, t.reunioes_agendadas);
  const taxaProp = calc.taxaProposta(t.propostas_enviadas, t.reunioes_realizadas);
  const taxaFech = calc.taxaFechamento(t.contratos_fechados, t.propostas_enviadas);
  const taxaLead2Contrato = calc.taxaFechamentoTotal(t.contratos_fechados, t.leads_pagos, t.leads_organicos);
  const ticket = calc.ticketMedio(t.receita_fechada, t.contratos_fechados);

  const funil = [
    { etapa: "Leads", valor: totalLeads },
    { etapa: "Qualificados", valor: t.leads_qualificados },
    { etapa: "Agendadas", valor: t.reunioes_agendadas },
    { etapa: "Realizadas", valor: t.reunioes_realizadas },
    { etapa: "Propostas", valor: t.propostas_enviadas },
    { etapa: "Contratos", valor: t.contratos_fechados },
  ];

  const qualifSplit = [
    { name: "Qualificados", value: t.leads_qualificados },
    { name: "Desqualificados", value: desqualificados },
  ];
  const QUALIF_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground)/0.4)"];

  const sem = !loading && totalLeads === 0 && t.contratos_fechados === 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70 mb-1">Funil de vendas</p>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-primary" />
              Comercial — Conversão
            </h1>
            <p className="text-sm text-muted-foreground">Taxas de qualificação, desqualificação, comparecimento e fechamento.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/metricas/comercial/historico")}>
              Histórico
            </Button>
            <Button size="sm" onClick={() => navigate("/metricas/comercial")}>
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
              <p className="text-muted-foreground">Nenhum dado comercial no período.</p>
              <Button onClick={() => navigate("/metricas/comercial")}>
                <FilePlus2 className="w-4 h-4 mr-2" /> Lançar agora
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Bloco 1 — Qualificação */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Qualificação de leads</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Leads recebidos" value={fmt.num(totalLeads)} sub={`Pagos ${t.leads_pagos} · Orgânicos ${t.leads_organicos}`} />
                <Kpi
                  icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  label="% Qualificados"
                  value={fmt.pctFrac(taxaQualif)}
                  sub={`${fmt.num(t.leads_qualificados)} leads`}
                  tone="success"
                />
                <Kpi
                  icon={<XCircle className="w-4 h-4 text-rose-500" />}
                  label="% Desqualificados"
                  value={fmt.pctFrac(taxaDesqualif)}
                  sub={`${fmt.num(desqualificados)} leads`}
                  tone="danger"
                />
                <Kpi label="Conversão lead→contrato" value={fmt.pctFrac(taxaLead2Contrato)} sub="Da entrada ao fechamento" />
              </div>
            </div>

            {/* Bloco 2 — Taxas do funil */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Taxas do funil</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="% Agendamento" value={fmt.pctFrac(taxaAgend)} sub="Qualif. → Agendadas" />
                <Kpi label="% Comparecimento" value={fmt.pctFrac(taxaComp)} sub="Agendadas → Realizadas" />
                <Kpi label="% Proposta" value={fmt.pctFrac(taxaProp)} sub="Realizadas → Propostas" />
                <Kpi label="% Fechamento" value={fmt.pctFrac(taxaFech)} sub="Propostas → Contratos" tone="success" />
              </div>
            </div>

            {/* Bloco 3 — Resultado */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resultado</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Contratos" value={fmt.num(t.contratos_fechados)} sub={`Perdidos: ${t.contratos_perdidos}`} />
                <Kpi label="Receita" value={fmt.brl(t.receita_fechada)} tone="success" />
                <Kpi label="Ticket médio" value={ticket == null ? "—" : fmt.brl(ticket)} />
                <Kpi label="Propostas enviadas" value={fmt.num(t.propostas_enviadas)} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Funil comercial</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funil} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" fontSize={11} />
                      <YAxis dataKey="etapa" type="category" width={110} fontSize={11} />
                      <ReTooltip />
                      <Bar dataKey="valor" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Qualificados vs desqualificados</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={qualifSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                        {qualifSplit.map((_, i) => (
                          <Cell key={i} fill={QUALIF_COLORS[i]} />
                        ))}
                      </Pie>
                      <ReTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {data.motivos && data.motivos.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Motivos de perda</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.motivos} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" fontSize={11} />
                      <YAxis dataKey="motivo" type="category" width={140} fontSize={11} />
                      <ReTooltip />
                      <Bar dataKey="qtd" fill="hsl(var(--destructive))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {data.por_nicho && data.por_nicho.length > 0 && (
              <RankingPorNichoCard data={data.por_nicho} />
            )}

            <Card>
              <CardHeader><CardTitle className="text-base">Receita diária</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.por_dia}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="data" tickFormatter={(v) => v.slice(5)} fontSize={11} />
                    <YAxis fontSize={11} />
                    <ReTooltip formatter={(v: any) => fmt.brl(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {/* Metas do mês — soma individual e por closer */}
        {metasInd.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" /> Metas — equipe
                    {verificacao.ok ? (
                      <Badge variant="outline" className="ml-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 gap-1">
                        <ShieldCheck className="w-3 h-3" /> Consistente
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-1 border-amber-500/40 text-amber-700 dark:text-amber-400 gap-1">
                        <AlertTriangle className="w-3 h-3" /> Divergência ({verificacao.issues.length})
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Soma das metas individuais. Valor total acumula a cada contrato fechado; entrada só soma quando o pagamento é confirmado (data de pagamento preenchida).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={mes}
                    onChange={(e) => setMes(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {new Date(2000, m - 1, 1).toLocaleString("pt-BR", { month: "long" })}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                  >
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" onClick={() => navigate("/metricas/metas")}>
                    Gerenciar metas
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Verificação automática */}
              <div
                className={`rounded-lg border p-3 flex items-start gap-2 text-xs ${
                  verificacao.ok
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-300"
                }`}
              >
                {verificacao.ok ? (
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1">
                  {verificacao.ok ? (
                    <p>
                      Verificação OK — a soma das metas individuais bate exatamente com o agregado da equipe
                      ({fmt.brl(verificacao.somaIndValor)} · {verificacao.somaIndContratos} contrato(s) · entrada {fmt.brl(verificacao.somaIndEntrada)}).
                    </p>
                  ) : (
                    <>
                      <p className="font-semibold">Divergências detectadas neste mês:</p>
                      <ul className="list-disc ml-4 space-y-0.5">
                        {verificacao.issues.map((i, k) => (
                          <li key={k}>{i}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Valor total contratos</span>
                    <span className="font-medium">
                      {fmt.brl(equipeMeta.realValorTotal)} / {fmt.brl(equipeMeta.sumTotal)}
                    </span>
                  </div>
                  <Progress value={pctEquipeValor} className="h-2" />
                  <div className="text-[10px] text-muted-foreground text-right">{pctEquipeValor}%</div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Entrada confirmada</span>
                    <span className="font-medium">
                      {fmt.brl(equipeMeta.realEntrada)} / {fmt.brl(equipeMeta.sumEntrada)}
                    </span>
                  </div>
                  <Progress value={pctEquipeEntrada} className="h-2" />
                  <div className="text-[10px] text-muted-foreground text-right">{pctEquipeEntrada}%</div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Nº de contratos</span>
                    <span className="font-medium">
                      {equipeMeta.realContratos} / {equipeMeta.sumContratos}
                    </span>
                  </div>
                  <Progress value={pctEquipeContratos} className="h-2" />
                  <div className="text-[10px] text-muted-foreground text-right">{pctEquipeContratos}%</div>
                </div>
              </div>

              {rankingCloser.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ranking individual</p>
                  <div className="space-y-2">
                    {rankingCloser.map((c, i) => (
                      <div key={c.uid} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Trophy className={`w-4 h-4 shrink-0 ${i === 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                            <span className="font-medium truncate">{c.nome}</span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {c.realContratos} de {c.metaContratos} contratos
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Valor total</span>
                            <span>{fmt.brl(c.realValor)} / {fmt.brl(c.metaTotal)} · {c.pctValor}%</span>
                          </div>
                          <Progress value={c.pctValor} className="h-1.5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Entrada confirmada</span>
                            <span>{fmt.brl(c.realEntrada)} / {fmt.brl(c.metaEntrada)} · {c.pctEntrada}%</span>
                          </div>
                          <Progress value={c.pctEntrada} className="h-1.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function RankingPorNichoCard({ data }: { data: { nicho: string; receita: number; contratos: number }[] }) {
  const [apenasLider, setApenasLider] = useState(false);
  const sorted = useMemo(() => [...data].sort((a, b) => b.receita - a.receita), [data]);
  const lider = sorted[0];
  const exibir = apenasLider && lider ? [lider] : sorted;
  const totReceita = data.reduce((s, x) => s + x.receita, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" /> Ranking por nicho
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Qual segmento está vendendo mais no período (Agro, Empresarial, Bancário, Ações diversas).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Apenas líder</span>
            <Switch
              checked={apenasLider}
              onCheckedChange={setApenasLider}
              aria-label="Mostrar apenas o nicho líder"
            />
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Como o líder é definido"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs text-xs">
                  <p className="font-medium mb-1">Como o líder é definido</p>
                  <p className="text-muted-foreground">
                    O nicho líder é o que tem a maior <strong>receita confirmada</strong> no período selecionado (entradas confirmadas dos contratos fechados).
                  </p>
                  {lider ? (
                    <p className="mt-2">
                      Atual: <strong>{lider.nicho}</strong> — {fmt.brl(lider.receita)} ({lider.contratos} contrato{lider.contratos === 1 ? "" : "s"}).
                    </p>
                  ) : (
                    <p className="mt-2 text-muted-foreground">Sem receita registrada no período.</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={exibir} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" fontSize={11} tickFormatter={(v) => fmt.brl(Number(v))} />
              <YAxis dataKey="nicho" type="category" width={130} fontSize={11} />
              <ReTooltip formatter={(v: any) => fmt.brl(Number(v))} />
              <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={`grid gap-2 ${apenasLider ? "grid-cols-1 max-w-xs mx-auto" : "grid-cols-2 md:grid-cols-4"}`}>
          {exibir.map((n, i) => {
            const share = totReceita > 0 ? Math.round((n.receita / totReceita) * 100) : 0;
            return (
              <div
                key={n.nicho}
                className={`rounded-lg border p-2.5 ${
                  n.nicho === lider?.nicho ? "border-amber-500/40 bg-amber-500/5" : ""
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {n.nicho === lider?.nicho && <Trophy className="w-3 h-3 text-amber-500" />}
                  <span className="text-xs font-medium capitalize truncate">{n.nicho}</span>
                </div>
                <div className="text-sm font-bold">{fmt.brl(n.receita)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {n.contratos} contrato(s) · {share}% do total
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon?: React.ReactNode; tone?: "success" | "danger" }) {
  const valueClass =
    tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-rose-600" : "";
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <p className="text-xs">{label}</p>
        </div>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}