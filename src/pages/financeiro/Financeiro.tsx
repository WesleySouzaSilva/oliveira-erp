import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock, TrendingUp, TrendingDown, Wallet, Building2, Plug, Banknote, Tractor, ArrowRight, RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";

type Lanc = { id: string; tipo: "receita"|"despesa"; valor: number; data: string; setor: string };
type Cob = { id: string; valor: number; status: string | null; tipo: string | null; vencimento: string | null; pago_em: string | null; sincronizado_em: string };

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function inicioMes() {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
}

export default function Financeiro() {
  const navigate = useNavigate();
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [mrr, setMrr] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState("geral");
  const [cobs, setCobs] = useState<Cob[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);

  const carregarCobrancas = async () => {
    const { data: cs } = await (supabase as any).from("financeiro_cobrancas")
      .select("id, valor, status, tipo, vencimento, pago_em, sincronizado_em")
      .order("sincronizado_em", { ascending: false })
      .limit(5000);
    const rows = ((cs as any[]) || []).map(c => ({ ...c, valor: Number(c.valor || 0) }));
    setCobs(rows);
    if (rows.length > 0) setUltimaSync(rows[0].sincronizado_em);
  };

  useEffect(() => {
    (async () => {
      const [{ data: ls }, { data: avs }, { data: vals }] = await Promise.all([
        (supabase as any).from("financeiro_lancamentos")
          .select("id, tipo, valor, data, setor")
          .is("deleted_at", null)
          .order("data", { ascending: false })
          .limit(2000),
        (supabase as any).from("avencas").select("id, status").eq("status","ativa").is("deleted_at", null),
        (supabase as any).from("avenca_valores").select("avenca_id, valor_mensal"),
      ]);
      setLancs(((ls as any[]) || []).map(l => ({ ...l, valor: Number(l.valor) })));
      const ativasIds = new Set(((avs as any[]) || []).map(a => a.id));
      const total = ((vals as any[]) || [])
        .filter(v => ativasIds.has(v.avenca_id))
        .reduce((s, v) => s + Number(v.valor_mensal || 0), 0);
      setMrr(total);
      await carregarCobrancas();
      setLoading(false);
    })();
  }, []);

  const sincronizarAsaas = async () => {
    setSyncing(true);
    try {
      const { data, error } = await (supabase as any).functions.invoke("asaas-sync", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Asaas sincronizado: ${data?.synced ?? 0} cobranças`);
      await carregarCobrancas();
    } catch (e: any) {
      const msg = e?.message || "Falha ao sincronizar";
      toast.error(msg.includes("ASAAS_API_KEY") ? "Configure ASAAS_API_KEY em Project Settings → Secrets" : msg);
    } finally {
      setSyncing(false);
    }
  };

  const asaasStats = (() => {
    const ini = inicioMes();
    const isPago = (s: string | null) => s === "RECEIVED" || s === "CONFIRMED";
    const recebidoMes = cobs
      .filter(c => isPago(c.status) && c.pago_em && new Date(c.pago_em) >= ini)
      .reduce((s, c) => s + c.valor, 0);
    const aReceber = cobs
      .filter(c => c.status === "PENDING" && c.vencimento && new Date(c.vencimento) >= new Date())
      .reduce((s, c) => s + c.valor, 0);
    const overdue = cobs.filter(c => c.status === "OVERDUE");
    const inadValor = overdue.reduce((s, c) => s + c.valor, 0);
    const inadQtd = overdue.length;
    const porTipo = cobs.reduce((acc: Record<string, number>, c) => {
      const k = c.tipo || "OUTRO";
      acc[k] = (acc[k] || 0) + c.valor; return acc;
    }, {});
    return { recebidoMes, aReceber, inadValor, inadQtd, porTipo };
  })();

  const filtra = (setor: "geral"|"agro"|"empresarial"|"todos") =>
    setor === "todos" ? lancs : lancs.filter(l => l.setor === setor);

  const stats = (rows: Lanc[]) => {
    const ini = inicioMes();
    const mes = rows.filter(r => new Date(r.data) >= ini);
    const receitas = rows.filter(r => r.tipo === "receita").reduce((s,r) => s + r.valor, 0);
    const despesas = rows.filter(r => r.tipo === "despesa").reduce((s,r) => s + r.valor, 0);
    const recebidoMes = mes.filter(r => r.tipo === "receita").reduce((s,r) => s + r.valor, 0);
    const despesasMes = mes.filter(r => r.tipo === "despesa").reduce((s,r) => s + r.valor, 0);
    return { receitas, despesas, saldo: receitas - despesas, recebidoMes, saldoMes: recebidoMes - despesasMes };
  };

  const Bloco = ({ setor }: { setor: "todos"|"geral"|"agro"|"empresarial" }) => {
    const s = stats(filtra(setor));
    return (
      <KpiGrid cols={4}>
        <KpiCard label="Recebido no mês" value={fmtBRL(s.recebidoMes)} icon={Wallet} tone="success" emphasizeValue />
        <KpiCard label="Total receitas"  value={fmtBRL(s.receitas)}    icon={TrendingUp} tone="success" />
        <KpiCard label="Total despesas"  value={fmtBRL(s.despesas)}    icon={TrendingDown} tone="danger" />
        <KpiCard label="Saldo do mês"    value={fmtBRL(s.saldoMes)}    tone={s.saldoMes >= 0 ? "success" : "danger"} emphasizeValue />
      </KpiGrid>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader
          icon={Lock}
          title="Financeiro — Visão geral"
          subtitle="Módulo restrito ao CEO. Nenhum outro membro vê este painel."
          breadcrumb={[{ label: "Financeiro" }, { label: "Visão geral" }]}
          actions={
            <Button variant="outline" onClick={() => navigate("/financeiro/lancamentos")}>
              Lançamentos manuais <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          }
        />

        <Card className="p-5 bg-accent/5 border-accent/30 flex items-center justify-between flex-wrap gap-3 shadow-card">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Receita recorrente (MRR) — contratos de consultoria ativos</div>
            <div className="font-display text-3xl font-semibold text-accent mt-2">{loading ? "…" : fmtBRL(mrr)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Soma dos valores mensais dos contratos de consultoria ativos da consultoria empresarial.</p>
          </div>
          <StatusBadge tone="info" label="Empresarial" />
        </Card>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="todos">Consolidado</TabsTrigger>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="agro">Agro</TabsTrigger>
            <TabsTrigger value="empresarial">Empresarial</TabsTrigger>
          </TabsList>
          {(["todos","geral","agro","empresarial"] as const).map(k => (
            <TabsContent key={k} value={k} className="mt-4">
              <Bloco setor={k} />
            </TabsContent>
          ))}
        </Tabs>

        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-lg font-serif font-semibold flex items-center gap-2">
              <Plug className="w-4 h-4 text-accent" /> Asaas — cobranças e recebíveis
            </h2>
            <div className="flex items-center gap-3">
              {ultimaSync && (
                <span className="text-[11px] text-muted-foreground">
                  Última sync: {new Date(ultimaSync).toLocaleString("pt-BR")}
                </span>
              )}
              <Button size="sm" onClick={sincronizarAsaas} disabled={syncing}>
                <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando…" : "Sincronizar Asaas"}
              </Button>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <KpiCard label="Recebido no mês" value={fmtBRL(asaasStats.recebidoMes)} icon={CheckCircle2} tone="success" emphasizeValue />
            <KpiCard label="A receber"       value={fmtBRL(asaasStats.aReceber)}    icon={Clock} tone="warning" />
            <KpiCard
              label="Inadimplência"
              value={fmtBRL(asaasStats.inadValor)}
              icon={AlertTriangle}
              tone="danger"
              emphasizeValue
              hint={`${asaasStats.inadQtd} cobranças vencidas`}
            />
            <Card className="p-5 rounded-xl shadow-card">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Por tipo</div>
              <div className="space-y-0.5">
                {Object.entries(asaasStats.porTipo).length === 0 && (
                  <div className="text-xs text-muted-foreground">Sem dados ainda.</div>
                )}
                {Object.entries(asaasStats.porTipo).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium">{fmtBRL(v)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <h2 className="text-lg font-serif font-semibold mb-3">A integrar</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <Card className="p-4 space-y-2 border-dashed">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Extrato bancário</span>
              </div>
              <p className="text-xs text-muted-foreground">Conciliação automática com a conta corrente. Chega na Fase C.</p>
              <Badge variant="outline" className="text-[10px]">A integrar</Badge>
            </Card>
            <Card className="p-4 space-y-2 border-dashed">
              <div className="flex items-center gap-2">
                <Tractor className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">ERP Agro</span>
              </div>
              <p className="text-xs text-muted-foreground">Custos por safra, insumos e produção. Chega na Fase C.</p>
              <Badge variant="outline" className="text-[10px]">A integrar</Badge>
            </Card>
          </div>
        </div>

        <Card className="p-4 text-xs text-muted-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4 text-accent" />
          Dados consolidados a partir dos lançamentos manuais e da receita recorrente (MRR) dos contratos de consultoria. As demais fontes virão nas próximas fases.
        </Card>
      </div>
    </AppLayout>
  );
}