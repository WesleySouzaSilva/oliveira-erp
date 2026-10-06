import { lerTudo } from "@/lib/lerTudo";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Crown, TrendingUp, TrendingDown, Wallet, AlertTriangle, CheckCircle2, Clock,
  Building2, Tractor, Users, Scale, ScrollText, Handshake, Inbox, FileText,
  Briefcase, ArrowRight, Plug, ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";

type Lanc = { id: string; tipo: "receita" | "despesa"; valor: number; data: string; setor: string };
type Cob = { id: string; valor: number; status: string | null; tipo: string | null; vencimento: string | null; pago_em: string | null };
type Avenca = { id: string; empresa_id: string; status: string; created_at: string; updated_at: string };
type Valor = { avenca_id: string; valor_mensal: number };
type Empresa = { id: string; status: string; risco: string | null; nps: number | null; responsavel_pos_venda: string | null };
type Demanda = { id: string; status: string; prazo: string | null; created_at: string; concluida_em: string | null; responsavel_id: string | null };
type DemExt = { id: string; status: string; prazo: string | null; responsavel_id: string | null };
type Proposta = { id: string; status: string; valor_sugerido: number | null; created_at: string };
type Processo = { id: string; fase_atual: string | null; responsavel_juridico_id: string | null; user_id: string | null };
type Cliente = { id: string; risco: string | null; responsavel_pos_venda: string | null };
type Venc = { id: string; vencimento_proxima_parcela: string | null; resolvido: boolean | null };
type Laudo = { id: string; status: string | null; created_at: string };
type Acordo = { id: string; status: string; concluida: boolean | null; responsavel_id: string | null; created_at: string };
type EmpAcordo = { id: string; status: string; valor_acordo: number | null; created_at: string };
type ContratoFechado = { id: string; nicho: string | null; valor_total: number | null; data_venda: string | null };

type PeriodoKey = "mes" | "90d" | "ano";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const isoDate = (d: Date) => d.toISOString();

function rangeFor(p: PeriodoKey): { inicio: Date; fim: Date; label: string } {
  const fim = new Date();
  const inicio = new Date();
  if (p === "mes") { inicio.setDate(1); inicio.setHours(0, 0, 0, 0); return { inicio, fim, label: "Mês atual" }; }
  if (p === "90d") { inicio.setDate(inicio.getDate() - 89); inicio.setHours(0, 0, 0, 0); return { inicio, fim, label: "Últimos 90 dias" }; }
  inicio.setMonth(0, 1); inicio.setHours(0, 0, 0, 0);
  return { inicio, fim, label: "Ano corrente" };
}

export default function DashboardMaster() {
  const [periodo, setPeriodo] = useState<PeriodoKey>("mes");
  const { members } = useOrgMembers();
  const [loading, setLoading] = useState(true);

  // Financeiro
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [cobs, setCobs] = useState<Cob[]>([]);
  const [avencas, setAvencas] = useState<Avenca[]>([]);
  const [valores, setValores] = useState<Valor[]>([]);
  const [asaasConfig, setAsaasConfig] = useState<"ok" | "vazio" | "desconhecido">("desconhecido");

  // Empresarial
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [demExt, setDemExt] = useState<DemExt[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [empAcordos, setEmpAcordos] = useState<EmpAcordo[]>([]);

  // Agro
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vencs, setVencs] = useState<Venc[]>([]);
  const [laudos, setLaudos] = useState<Laudo[]>([]);
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [contratosFechados, setContratosFechados] = useState<ContratoFechado[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const q = supabase as any;
      const [
        rLanc, rCob, rAv, rVal,
        rEmp, rDem, rDx, rProp, rEA,
        rProc, rCli, rVen, rLau, rAc, rCF,
      ] = await Promise.all([
        q.from("financeiro_lancamentos").select("id,tipo,valor,data,setor").is("deleted_at", null).limit(5000),
        q.from("financeiro_cobrancas").select("id,valor,status,tipo,vencimento,pago_em").limit(5000),
        q.from("avencas").select("id,empresa_id,status,created_at,updated_at").is("deleted_at", null),
        q.from("avenca_valores").select("avenca_id,valor_mensal"),
        q.from("empresas_consultoria").select("id,status,risco,nps,responsavel_pos_venda").is("deleted_at", null),
        q.from("consultoria_demandas").select("id,status,prazo,created_at,concluida_em,responsavel_id").is("deleted_at", null),
        q.from("empresa_demandas_externas").select("id,status,prazo,responsavel_id").is("deleted_at", null),
        q.from("consultoria_propostas").select("id,status,valor_sugerido,created_at").is("deleted_at", null),
        q.from("empresa_acordos").select("id,status,valor_acordo,created_at").is("deleted_at", null),
        lerTudo(() => q.from("processos").select("id,fase_atual,responsavel_juridico_id,user_id")),
        lerTudo(() => q.from("clientes").select("id,risco,responsavel_pos_venda").is("deleted_at", null)),
        lerTudo(() => q.from("contratos_vencimentos").select("id,vencimento_proxima_parcela,resolvido").is("deleted_at", null)),
        q.from("laudos").select("id,status,created_at").is("deleted_at", null).limit(5000),
        q.from("acordos_tarefas").select("id,status,concluida,responsavel_id,created_at").limit(5000),
        q.from("mkt_contratos_fechados").select("id,nicho,valor_total,data_venda").limit(5000),
      ]);
      if (cancel) return;

      setLancs(((rLanc.data as any[]) || []).map((l) => ({ ...l, valor: Number(l.valor || 0) })));
      const cobRows = ((rCob.data as any[]) || []).map((c) => ({ ...c, valor: Number(c.valor || 0) }));
      setCobs(cobRows);
      // Sem linhas AGUARDANDO configuração; podemos ter erro de permissão (não-CEO) — ignoramos aqui pq rota é CEO.
      if (rCob.error) setAsaasConfig("desconhecido");
      else setAsaasConfig(cobRows.length === 0 ? "vazio" : "ok");

      setAvencas((rAv.data as any[]) || []);
      setValores(((rVal.data as any[]) || []).map((v) => ({ ...v, valor_mensal: Number(v.valor_mensal || 0) })));
      setEmpresas((rEmp.data as any[]) || []);
      setDemandas((rDem.data as any[]) || []);
      setDemExt((rDx.data as any[]) || []);
      setPropostas(((rProp.data as any[]) || []).map((p) => ({ ...p, valor_sugerido: p.valor_sugerido == null ? null : Number(p.valor_sugerido) })));
      setEmpAcordos(((rEA.data as any[]) || []).map((a) => ({ ...a, valor_acordo: a.valor_acordo == null ? null : Number(a.valor_acordo) })));
      setProcessos((rProc.data as any[]) || []);
      setClientes((rCli.data as any[]) || []);
      setVencs((rVen.data as any[]) || []);
      setLaudos((rLau.data as any[]) || []);
      setAcordos((rAc.data as any[]) || []);
      setContratosFechados(((rCF.data as any[]) || []).map((c) => ({ ...c, valor_total: c.valor_total == null ? null : Number(c.valor_total) })));

      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const rng = rangeFor(periodo);
  const iniIso = isoDate(rng.inicio);
  const hoje = new Date();
  const hojeIso = hoje.toISOString().slice(0, 10);

  // ------- Financeiro
  const fin = useMemo(() => {
    const valPorAv = new Map(valores.map((v) => [v.avenca_id, v.valor_mensal]));
    const ativas = avencas.filter((a) => a.status === "ativa");
    const mrr = ativas.reduce((s, a) => s + (valPorAv.get(a.id) ?? 0), 0);

    const mesLanc = lancs.filter((l) => new Date(l.data) >= rng.inicio);
    const receitaMes = mesLanc.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
    const despesaMes = mesLanc.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
    const saldoMes = receitaMes - despesaMes;

    const isPago = (s: string | null) => s === "RECEIVED" || s === "CONFIRMED";
    const recebido = cobs.filter((c) => isPago(c.status) && c.pago_em && new Date(c.pago_em) >= rng.inicio).reduce((s, c) => s + c.valor, 0);
    const aReceber = cobs.filter((c) => c.status === "PENDING" && c.vencimento && new Date(c.vencimento) >= hoje).reduce((s, c) => s + c.valor, 0);
    const overdue = cobs.filter((c) => c.status === "OVERDUE");
    const inadValor = overdue.reduce((s, c) => s + c.valor, 0);
    const inadQtd = overdue.length;

    const porSetor = (setor: string) => {
      const rows = mesLanc.filter((l) => l.setor === setor);
      const r = rows.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
      const d = rows.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
      return { receita: r, despesa: d, saldo: r - d };
    };

    return {
      mrr, receitaMes, despesaMes, saldoMes,
      recebido, aReceber, inadValor, inadQtd,
      geral: porSetor("geral"), agro: porSetor("agro"), empresarial: porSetor("empresarial"),
    };
  }, [valores, avencas, lancs, cobs, rng.inicio, hoje]);

  // ------- Empresarial
  const emp = useMemo(() => {
    const ativos = avencas.filter((a) => a.status === "ativa").length;
    const suspensos = avencas.filter((a) => a.status === "suspensa").length;
    const encerrados = avencas.filter((a) => a.status === "encerrada").length;

    const demativas = demandas.filter((d) => !["concluida", "cancelada"].includes(d.status));
    const concluidasP = demandas.filter((d) => d.status === "concluida" && d.concluida_em && d.concluida_em >= iniIso);
    const atrasadas = demativas.filter((d) => d.prazo && d.prazo < hojeIso).length
      + concluidasP.filter((d) => d.prazo && d.concluida_em && d.concluida_em.slice(0, 10) > d.prazo).length;
    const consideradas = demativas.length + concluidasP.length;
    const pctPrazo = consideradas === 0 ? null : Math.round(((consideradas - atrasadas) / consideradas) * 100);

    const propsPeriodo = propostas.filter((p) => p.created_at >= iniIso);
    const enviadas = propsPeriodo.length;
    const aceitas = propsPeriodo.filter((p) => p.status === "aceita").length;
    const recusadas = propsPeriodo.filter((p) => p.status === "recusada").length;
    const conv = (aceitas + recusadas) === 0 ? null : Math.round((aceitas / (aceitas + recusadas)) * 100);
    const pipelineValor = propostas
      .filter((p) => p.status === "rascunho" || p.status === "enviada")
      .reduce((s, p) => s + Number(p.valor_sugerido || 0), 0);

    const empComAvenca = new Set(avencas.filter((a) => a.status === "ativa").map((a) => a.empresa_id));
    const carteira = empresas.filter((e) => empComAvenca.has(e.id));
    let npsSoma = 0, npsCount = 0;
    for (const e of carteira) { if (e.nps != null) { npsSoma += e.nps; npsCount++; } }
    const npsMedio = npsCount === 0 ? null : Math.round((npsSoma / npsCount) * 10) / 10;

    return {
      ativos, suspensos, encerrados,
      demAbertas: demativas.length, pctPrazo, atrasadasQtd: atrasadas,
      demExtAbertas: demExt.filter((d) => !["concluida", "cancelada", "arquivada"].includes(d.status)).length,
      acordosAbertos: empAcordos.filter((a) => a.status !== "encerrado" && a.status !== "cancelado").length,
      propostas: { enviadas, aceitas, recusadas, conv, pipelineValor },
      carteiraQtd: carteira.length, npsMedio,
    };
  }, [avencas, demandas, demExt, empAcordos, propostas, empresas, iniIso, hojeIso]);

  // ------- Agro
  const agro = useMemo(() => {
    const ativos = processos.filter((p) => p.fase_atual && p.fase_atual !== "encerrado" && p.fase_atual !== "concluido");
    const porFase = new Map<string, number>();
    for (const p of ativos) porFase.set(p.fase_atual!, (porFase.get(p.fase_atual!) ?? 0) + 1);

    const abertos = vencs.filter((v) => !v.resolvido);
    const atrasados = abertos.filter((v) => v.vencimento_proxima_parcela && v.vencimento_proxima_parcela < hojeIso).length;
    const em15 = abertos.filter((v) => {
      if (!v.vencimento_proxima_parcela) return false;
      const dias = Math.round((new Date(v.vencimento_proxima_parcela).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return dias >= 0 && dias <= 15;
    }).length;

    const laudosPeriodo = laudos.filter((l) => l.created_at >= iniIso).length;
    const laudosAssinados = laudos.filter((l) => l.status === "assinado" || l.status === "concluido").length;

    const acordosAbertos = acordos.filter((a) => !a.concluida && a.status !== "cancelado").length;
    const acordosFechadosP = acordos.filter((a) => a.concluida && a.created_at >= iniIso).length;

    const porRisco = { alto: 0, medio: 0, baixo: 0 };
    let semResp = 0;
    for (const c of clientes) {
      if (c.risco === "alto" || c.risco === "medio" || c.risco === "baixo") porRisco[c.risco]++;
      if (!c.responsavel_pos_venda) semResp++;
    }

    // Comercial (contratos fechados no período)
    const cfPeriodo = contratosFechados.filter((c) => c.data_venda && c.data_venda >= rng.inicio.toISOString().slice(0, 10));
    const cfValor = cfPeriodo.reduce((s, c) => s + Number(c.valor_total || 0), 0);

    return {
      ativos: ativos.length, porFase,
      vencAbertos: abertos.length, vencAtrasados: atrasados, vencEm15: em15,
      clientesTotal: clientes.length, porRisco, semResp,
      laudosPeriodo, laudosAssinados,
      acordosAbertos, acordosFechadosP,
      cfQtd: cfPeriodo.length, cfValor,
    };
  }, [processos, vencs, laudos, acordos, clientes, contratosFechados, iniIso, hoje, hojeIso, rng.inicio]);

  // ------- Equipe
  const equipe = useMemo(() => {
    const map = new Map<string, { demandas: number; empresas: number; processos: number; onboardings: number }>();
    const get = (uid: string) => {
      if (!map.has(uid)) map.set(uid, { demandas: 0, empresas: 0, processos: 0, onboardings: 0 });
      return map.get(uid)!;
    };
    const semRespDem = demandas.filter((d) => !["concluida", "cancelada"].includes(d.status) && !d.responsavel_id).length;
    const semRespDx = demExt.filter((d) => !["concluida", "cancelada", "arquivada"].includes(d.status) && !d.responsavel_id).length;
    const semRespProc = processos.filter((p) => !p.responsavel_juridico_id).length;
    for (const d of demandas.filter((x) => !["concluida", "cancelada"].includes(x.status) && x.responsavel_id)) {
      get(d.responsavel_id!).demandas++;
    }
    const empComAvenca = new Set(avencas.filter((a) => a.status === "ativa").map((a) => a.empresa_id));
    for (const e of empresas) if (empComAvenca.has(e.id) && e.responsavel_pos_venda) get(e.responsavel_pos_venda).empresas++;
    for (const p of processos) if (p.responsavel_juridico_id) get(p.responsavel_juridico_id).processos++;

    const linhas = [...map.entries()].map(([uid, v]) => ({
      uid, ...v, total: v.demandas + v.empresas + v.processos + v.onboardings,
    })).sort((a, b) => b.total - a.total);

    const totalCarga = linhas.reduce((s, l) => s + l.total, 0);
    const media = linhas.length === 0 ? 0 : totalCarga / linhas.length;
    const sobrecarregados = linhas.filter((l) => l.total > media * 1.6 && l.total >= 5).map((l) => l.uid);

    return { linhas, semRespDem, semRespDx, semRespProc, sobrecarregados };
  }, [demandas, demExt, processos, empresas, avencas]);

  const nome = (uid: string | null) => {
    if (!uid) return "Sem responsável";
    return members.find((m) => m.user_id === uid)?.nome || "Membro";
  };

  const numClientesAgro = clientes.length;
  const numEmpresas = empresas.length;

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-8 max-w-7xl">
        <PageHeader
          icon={Crown}
          title="Dashboard MASTER"
          subtitle="Visão de comando — consolida financeiro, produção, equipe e pipeline. Restrito ao CEO."
          breadcrumb={[{ label: "Master" }, { label: "Comando" }]}
          actions={
            <div className="inline-flex rounded-lg border bg-muted p-1">
              {(["mes", "90d", "ano"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${periodo === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {p === "mes" ? "Mês" : p === "90d" ? "90 dias" : "Ano"}
                </button>
              ))}
            </div>
          }
        />

        {loading && <Card className="p-6 text-center text-muted-foreground">Carregando visão consolidada…</Card>}

        {/* VISÃO DO ESCRITÓRIO */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl text-accent flex items-center gap-2">
            <Crown className="w-5 h-5" /> Visão do escritório
          </h2>
          <KpiGrid cols={4}>
            <KpiCard label="Receita recorrente (MRR)" value={fmtBRL(fin.mrr)} icon={Wallet} tone="gold" emphasizeValue />
            <KpiCard
              label="Recebido no período"
              value={asaasConfig === "vazio" ? "aguardando configuração" : fmtBRL(fin.recebido)}
              icon={CheckCircle2}
              tone={asaasConfig === "vazio" ? "neutral" : "success"}
              hint={asaasConfig === "vazio" ? "Configure a integração Asaas para começar a sincronizar." : rng.label}
            />
            <KpiCard
              label="A receber"
              value={asaasConfig === "vazio" ? "—" : fmtBRL(fin.aReceber)}
              icon={Clock}
              tone={asaasConfig === "vazio" ? "neutral" : "warning"}
              hint={asaasConfig === "vazio" ? "Sem dados do Asaas ainda." : undefined}
            />
            <KpiCard
              label="Inadimplência"
              value={asaasConfig === "vazio" ? "—" : fmtBRL(fin.inadValor)}
              icon={AlertTriangle}
              tone={asaasConfig === "vazio" ? "neutral" : "danger"}
              emphasizeValue
              hint={asaasConfig === "vazio" ? "Sem dados do Asaas ainda." : `${fin.inadQtd} cobranças vencidas`}
            />
            <KpiCard label="Saldo do período (lançamentos)" value={fmtBRL(fin.saldoMes)} tone={fin.saldoMes >= 0 ? "success" : "danger"} emphasizeValue />
            <KpiCard label="Clientes Agro" value={numClientesAgro} icon={Users} />
            <KpiCard label="Empresas Consultoria" value={numEmpresas} icon={Building2} />
            <KpiCard label="Processos ativos + demandas abertas" value={agro.ativos + emp.demAbertas + emp.demExtAbertas} icon={Briefcase} />
          </KpiGrid>
        </section>

        {/* PRODUÇÃO POR ÁREA */}
        <section className="grid gap-4 lg:grid-cols-2">
          {/* AGRO */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg text-primary flex items-center gap-2">
                <Tractor className="w-5 h-5" /> Agro
              </h3>
              <Link to="/juridico/overview" className="text-xs text-primary underline">Overview jurídico →</Link>
            </div>
            <KpiGrid cols={2}>
              <KpiCard label="Processos ativos" value={agro.ativos} icon={Scale} />
              <KpiCard
                label="Vencimentos críticos"
                value={`${agro.vencEm15} em 15d`}
                hint={`${agro.vencAtrasados} atrasados · ${agro.vencAbertos} abertos`}
                tone={agro.vencAtrasados > 0 ? "danger" : agro.vencEm15 > 0 ? "warning" : "success"}
                icon={Clock}
              />
              <KpiCard label="Laudos no período" value={agro.laudosPeriodo} icon={ScrollText} hint={`${agro.laudosAssinados} assinados no total`} />
              <KpiCard label="Acordos abertos" value={agro.acordosAbertos} icon={Handshake} hint={`${agro.acordosFechadosP} fechados no período`} />
            </KpiGrid>
            <Card className="p-3 bg-muted/30 border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Processos por fase</div>
              {agro.porFase.size === 0 ? (
                <div className="text-xs text-muted-foreground">Sem processos ativos.</div>
              ) : (
                <div className="flex flex-wrap gap-2 text-xs">
                  {[...agro.porFase.entries()].map(([f, n]) => (
                    <StatusBadge key={f} tone="info" label={`${f}: ${n}`} />
                  ))}
                </div>
              )}
            </Card>
            <Card className="p-3 bg-muted/30 border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Carteira de clientes ({agro.clientesTotal})</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-red-700">Alto:</span> {agro.porRisco.alto}</div>
                <div><span className="text-amber-700">Médio:</span> {agro.porRisco.medio}</div>
                <div><span className="text-emerald-700">Baixo:</span> {agro.porRisco.baixo}</div>
              </div>
              {agro.semResp > 0 && (
                <div className="mt-2 text-xs text-warning-foreground">
                  <AlertTriangle className="inline w-3 h-3 mr-1" />{agro.semResp} sem responsável de pós-venda
                </div>
              )}
            </Card>
            <div className="flex gap-3 text-xs">
              <Link to="/pos-venda/carteira" className="text-primary underline">Carteira →</Link>
              <Link to="/vencimentos" className="text-primary underline">Vencimentos →</Link>
              <Link to="/acordos" className="text-primary underline">Acordos →</Link>
            </div>
          </Card>

          {/* EMPRESARIAL */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg text-primary flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Empresarial
              </h3>
              <Link to="/consultoria/empresas" className="text-xs text-primary underline">Empresas →</Link>
            </div>
            <KpiGrid cols={2}>
              <KpiCard label="Contratos ativos" value={emp.ativos} icon={Briefcase} tone="success" hint={`${emp.suspensos} susp · ${emp.encerrados} enc`} />
              <KpiCard
                label="Demandas abertas"
                value={emp.demAbertas}
                icon={Inbox}
                tone={emp.atrasadasQtd > 0 ? "warning" : "neutral"}
                hint={emp.pctPrazo == null ? "SLA sem dados" : `${emp.pctPrazo}% no prazo · ${emp.atrasadasQtd} atrasadas`}
              />
              <KpiCard label="Demandas externas / acordos" value={`${emp.demExtAbertas} / ${emp.acordosAbertos}`} icon={ShieldAlert} />
              <KpiCard label="Carteira (empresas com contrato)" value={emp.carteiraQtd} icon={Users} hint={emp.npsMedio == null ? "NPS sem dados" : `NPS médio ${emp.npsMedio}`} />
            </KpiGrid>
            <Card className="p-3 bg-muted/30 border-border/50 text-xs space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Propostas no período</div>
              <div className="flex justify-between"><span>Enviadas</span><span className="font-medium">{emp.propostas.enviadas}</span></div>
              <div className="flex justify-between"><span>Aceitas / Recusadas</span><span className="font-medium">{emp.propostas.aceitas} / {emp.propostas.recusadas}</span></div>
              <div className="flex justify-between"><span>Conversão</span><span className="font-medium">{emp.propostas.conv == null ? "—" : `${emp.propostas.conv}%`}</span></div>
              <div className="flex justify-between"><span>Valor em pipeline</span><span className="font-medium">{fmtBRL(emp.propostas.pipelineValor)}</span></div>
            </Card>
            <div className="flex gap-3 text-xs">
              <Link to="/consultoria/demandas" className="text-primary underline">Demandas →</Link>
              <Link to="/consultoria/carteira" className="text-primary underline">Carteira →</Link>
              <Link to="/consultoria/propostas" className="text-primary underline">Propostas →</Link>
            </div>
          </Card>
        </section>

        {/* FINANCEIRO */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl text-accent flex items-center gap-2">
              <Wallet className="w-5 h-5" /> Financeiro
            </h2>
            <Link to="/financeiro" className="text-xs text-primary underline flex items-center gap-1">
              Ver módulo <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <KpiGrid cols={4}>
            <KpiCard label="MRR (contratos ativos)" value={fmtBRL(fin.mrr)} tone="gold" emphasizeValue />
            <KpiCard label="Receitas do período" value={fmtBRL(fin.receitaMes)} icon={TrendingUp} tone="success" />
            <KpiCard label="Despesas do período" value={fmtBRL(fin.despesaMes)} icon={TrendingDown} tone="danger" />
            <KpiCard label="Saldo" value={fmtBRL(fin.saldoMes)} tone={fin.saldoMes >= 0 ? "success" : "danger"} emphasizeValue />
          </KpiGrid>
          <div className="grid gap-3 md:grid-cols-3">
            {(["geral", "agro", "empresarial"] as const).map((setor) => {
              const s = fin[setor];
              return (
                <Card key={setor} className="p-4 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Setor {setor}</div>
                  <div className="text-sm flex justify-between"><span>Receitas</span><span className="font-medium text-success">{fmtBRL(s.receita)}</span></div>
                  <div className="text-sm flex justify-between"><span>Despesas</span><span className="font-medium text-destructive">{fmtBRL(s.despesa)}</span></div>
                  <div className="text-sm flex justify-between border-t pt-1"><span>Saldo</span><span className={`font-semibold ${s.saldo >= 0 ? "text-success" : "text-destructive"}`}>{fmtBRL(s.saldo)}</span></div>
                </Card>
              );
            })}
          </div>
          {asaasConfig === "vazio" && (
            <Card className="p-4 border-dashed border-warning/40 bg-warning/5 flex items-center gap-3">
              <Plug className="w-4 h-4 text-warning-foreground" />
              <div className="text-xs">
                <div className="font-medium">Cobranças Asaas — aguardando configuração</div>
                <div className="text-muted-foreground">Configure <code>ASAAS_API_KEY</code> em Project Settings → Secrets e rode a primeira sincronização na tela do Financeiro.</div>
              </div>
              <Button size="sm" variant="outline" asChild className="ml-auto">
                <Link to="/financeiro">Abrir Financeiro</Link>
              </Button>
            </Card>
          )}
        </section>

        {/* EQUIPE */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl text-primary flex items-center gap-2">
            <Users className="w-5 h-5" /> Equipe — carga e produção
          </h2>
          <Card className="p-4">
            {equipe.linhas.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem atribuições registradas.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="text-left py-1">Membro</th><th className="text-right">Demandas</th><th className="text-right">Empresas</th><th className="text-right">Processos</th><th className="text-right">Total</th></tr>
                </thead>
                <tbody>
                  {equipe.linhas.map((r) => (
                    <tr key={r.uid} className="border-t border-border/60">
                      <td className="py-1.5 flex items-center gap-2">
                        {nome(r.uid)}
                        {equipe.sobrecarregados.includes(r.uid) && <StatusBadge tone="warning" label="sobrecarregado" />}
                      </td>
                      <td className="text-right tabular-nums">{r.demandas}</td>
                      <td className="text-right tabular-nums">{r.empresas}</td>
                      <td className="text-right tabular-nums">{r.processos}</td>
                      <td className="text-right tabular-nums font-semibold">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {(equipe.semRespDem + equipe.semRespDx + equipe.semRespProc) > 0 && (
            <Card className="p-3 bg-warning/5 border-warning/30 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning-foreground" />
              Sem responsável: {equipe.semRespDem} demandas · {equipe.semRespDx} demandas externas · {equipe.semRespProc} processos.
            </Card>
          )}
        </section>

        {/* PIPELINE / FUNIL */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl text-primary flex items-center gap-2">
            <FileText className="w-5 h-5" /> Pipeline / funil
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4 space-y-2">
              <div className="text-sm font-medium">Consultoria Empresarial</div>
              <div className="text-xs text-muted-foreground">Propostas no período: {rng.label}</div>
              <div className="flex justify-between text-sm"><span>Enviadas</span><span className="font-medium">{emp.propostas.enviadas}</span></div>
              <div className="flex justify-between text-sm"><span>Aceitas</span><span className="font-medium text-success">{emp.propostas.aceitas}</span></div>
              <div className="flex justify-between text-sm"><span>Recusadas</span><span className="font-medium text-destructive">{emp.propostas.recusadas}</span></div>
              <div className="flex justify-between text-sm border-t pt-1"><span>Conversão</span><span className="font-semibold">{emp.propostas.conv == null ? "—" : `${emp.propostas.conv}%`}</span></div>
              <div className="flex justify-between text-sm"><span>Valor em pipeline</span><span className="font-medium">{fmtBRL(emp.propostas.pipelineValor)}</span></div>
            </Card>
            <Card className="p-4 space-y-2">
              <div className="text-sm font-medium">Comercial Agro</div>
              <div className="text-xs text-muted-foreground">Contratos fechados no período: {rng.label}</div>
              {agro.cfQtd === 0 ? (
                <div className="text-xs text-muted-foreground italic">Sem contratos fechados registrados no período.</div>
              ) : (
                <>
                  <div className="flex justify-between text-sm"><span>Contratos</span><span className="font-medium">{agro.cfQtd}</span></div>
                  <div className="flex justify-between text-sm"><span>Valor total</span><span className="font-semibold">{fmtBRL(agro.cfValor)}</span></div>
                </>
              )}
              <div className="pt-1"><Link to="/metricas/contratos-fechados" className="text-xs text-primary underline">Abrir contratos fechados →</Link></div>
            </Card>
          </div>
        </section>

        <Card className="p-3 text-[11px] text-muted-foreground text-center">
          Dashboard MASTER agrega dados já existentes — nenhuma regra de negócio nova.
          Onde a fonte ainda não tem dados, mostramos "aguardando configuração" ou "sem dados".
        </Card>
      </div>
    </AppLayout>
  );
}