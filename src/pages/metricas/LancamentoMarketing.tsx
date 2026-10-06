import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/CurrencyInput";
import { NichoPills } from "@/components/metricas/NichoPills";
import { useLancamento, useLancamentosPeriodo, registrarTentativaDataFutura } from "@/hooks/useMetricas";
import { calc, fmt, type Nicho } from "@/hooks/useMetricasCalc";
import { toast } from "sonner";
import { Loader2, AlertTriangle, RefreshCw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function NumInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <Input
      type="number"
      min={0}
      value={value || ""}
      placeholder={placeholder || "0"}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
    />
  );
}

function FieldRow({ label, children, calcLabel }: { label: string; children: React.ReactNode; calcLabel?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        {calcLabel && <span className="text-[11px] text-muted-foreground">{calcLabel}</span>}
      </div>
      {children}
    </div>
  );
}

export default function MetricasLancamentoMarketing() {
  const [params] = useSearchParams();
  const [data, setData] = useState(params.get("data") || todayYMD());
  const [nicho, setNicho] = useState<Nicho>((params.get("nicho") as Nicho) || "agro");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Resumo Meta Ads por período (não grava — só visualização)
  const [periodoDias, setPeriodoDias] = useState<number>(30);
  const [periodoLoading, setPeriodoLoading] = useState(false);
  const [periodoAgg, setPeriodoAgg] = useState<{
    investimento: number; impressoes: number; alcance: number; cliques: number; leads: number;
    since: string; until: string;
  } | null>(null);

  // Marketing usa SEMPRE row sem closer/sdr (numeros agregados do nicho/dia)
  const { lancamento, setLancamento, existing, loading, save } = useLancamento(data, nicho, null, null);

  const inicio7 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  }, []);
  const { rows: recentes } = useLancamentosPeriodo(inicio7, todayYMD(), [nicho]);
  const pendencias = useMemo(() => {
    const dias: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const ymd = d.toISOString().slice(0, 10);
      if (!recentes.some((r) => r.data === ymd && !(r as any).closer_id && !(r as any).sdr_id)) dias.push(ymd);
    }
    return dias;
  }, [recentes]);

  const set = (k: keyof typeof lancamento, v: any) => setLancamento({ ...lancamento, [k]: v });

  const handleSave = async () => {
    setSaving(true);
    try {
      await save();
      toast.success("Marketing salvo com sucesso");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncMeta = async () => {
    setSyncing(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: { action: "sync_date", data, trigger_tipo: "manual" },
      });
      if (error) throw error;
      if (res && (res as any).ok === false) throw new Error((res as any).error);
      const resultados = ((res as any)?.resultados ?? []) as Array<{ nicho: string; ok: boolean; metrics?: any; erro?: string }>;
      const doNicho = resultados.filter((r) => r.nicho === nicho);
      if (doNicho.length === 0) {
        toast.warning("Nenhuma conta Meta configurada para este nicho. Configure em Integração Meta Ads.");
      } else {
        const erros = doNicho.filter((r) => !r.ok);
        if (erros.length) toast.error(erros.map((e) => e.erro).join(" · "));
        const agg = doNicho.reduce(
          (a, r) => {
            if (!r.ok || !r.metrics) return a;
            a.investimento += r.metrics.investimento || 0;
            a.impressoes += r.metrics.impressoes || 0;
            a.alcance += r.metrics.alcance || 0;
            a.cliques += r.metrics.cliques || 0;
            a.leads += r.metrics.leads || 0;
            return a;
          },
          { investimento: 0, impressoes: 0, alcance: 0, cliques: 0, leads: 0 }
        );
        setLancamento({
          ...lancamento,
          investimento: agg.investimento,
          impressoes: agg.impressoes,
          alcance: agg.alcance,
          cliques: agg.cliques,
          leads_pagos: agg.leads,
        });
        toast.success(
          `Meta sincronizada: ${fmt.brl(agg.investimento)} · ${agg.leads} leads · ${agg.cliques} cliques`
        );
      }
    } catch (e: any) {
      toast.error(e.message || "Falha ao sincronizar com Meta");
    } finally {
      setSyncing(false);
    }
  };

  const carregarPeriodo = async (dias: number) => {
    setPeriodoDias(dias);
    setPeriodoLoading(true);
    try {
      const until = todayYMD();
      // dias === 0 → "todo o período": pede ao backend para descobrir a data
      // de criação real da conta Meta (evita estourar limite da Graph API)
      const since =
        dias === 0
          ? "auto"
          : new Date(Date.now() - (dias - 1) * 86400000).toISOString().slice(0, 10);

      // Cache localStorage por (nicho, dias, until). Dados históricos não mudam,
      // então reaproveitamos por até 6h (e sempre quando a janela ainda inclui hoje).
      const cacheKey = `meta-agg:${nicho}:${dias}:${until}`;
      const cached = (() => {
        try {
          const raw = localStorage.getItem(cacheKey);
          if (!raw) return null;
          const obj = JSON.parse(raw);
          if (Date.now() - obj.savedAt > 6 * 3600 * 1000) return null;
          return obj.payload;
        } catch { return null; }
      })();
      if (cached) {
        setPeriodoAgg(cached);
        setPeriodoLoading(false);
        return;
      }

      const { data: res, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: { action: "aggregate_insights", since, until, nicho },
      });
      if (error) throw error;
      if (res && (res as any).ok === false) throw new Error((res as any).error);
      const total = (res as any)?.total ?? { investimento: 0, impressoes: 0, alcance: 0, cliques: 0, leads: 0 };
      // o backend pode resolver since="auto" → usar o since retornado
      const sinceResolved = (res as any)?.since || since;
      const payload = { ...total, since: sinceResolved, until };
      setPeriodoAgg(payload);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), payload }));
      } catch { /* quota cheia, ignora */ }
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar período");
      setPeriodoAgg(null);
    } finally {
      setPeriodoLoading(false);
    }
  };

  // Carrega automaticamente ao trocar de nicho (com debounce simples)
  useEffect(() => {
    const t = setTimeout(() => carregarPeriodo(periodoDias), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicho]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Lançamento — Marketing</h1>
              <p className="text-sm text-muted-foreground">
                Números de tráfego (pago e orgânico) por nicho e por dia.
              </p>
            </div>
            <Badge variant={existing ? "secondary" : "default"} className="text-xs">
              {existing ? "Editando lançamento existente" : "Novo lançamento"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={data}
                max={todayYMD()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v > todayYMD()) {
                    toast.error("Não é permitido lançar números para datas futuras.");
                    registrarTentativaDataFutura(v, "marketing", "lancamento-marketing");
                    return;
                  }
                  setData(v);
                }}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nicho</Label>
              <NichoPills value={nicho} onChange={setNicho} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncMeta}
              disabled={syncing}
              className="gap-2"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Puxar do Meta Ads
            </Button>
          </div>

          {pendencias.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">Pendências:</span> faltam lançamentos de marketing em{" "}
                {pendencias.map((d) => fmt.data(d)).join(", ")}
              </div>
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Resumo Meta Ads — período ({nicho})
              </CardTitle>
              <div className="flex items-center gap-1 flex-wrap">
                {[7, 30, 60, 90].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={periodoDias === d ? "default" : "outline"}
                    onClick={() => carregarPeriodo(d)}
                    disabled={periodoLoading}
                    className="h-8 px-3 text-xs"
                  >
                    {d}d
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={periodoDias === 0 ? "default" : "outline"}
                  onClick={() => carregarPeriodo(0)}
                  disabled={periodoLoading}
                  className="h-8 px-3 text-xs"
                >
                  Todo o período
                </Button>
                <Button size="sm" variant="ghost" onClick={() => carregarPeriodo(periodoDias)} disabled={periodoLoading} className="h-8 w-8 p-0">
                  {periodoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            {periodoAgg && (
              <p className="text-[11px] text-muted-foreground">
                {fmt.data(periodoAgg.since)} → {fmt.data(periodoAgg.until)}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {periodoLoading && !periodoAgg ? (
              <div className="py-6 flex items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando da Meta...
              </div>
            ) : periodoAgg ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-[11px] text-muted-foreground">Investimento</div>
                  <div className="text-lg font-semibold">{fmt.brl(periodoAgg.investimento)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[11px] text-muted-foreground">Leads</div>
                  <div className="text-lg font-semibold">{periodoAgg.leads.toLocaleString("pt-BR")}</div>
                  <div className="text-[10px] text-muted-foreground">
                    CPL {fmt.brl(calc.cpl(periodoAgg.investimento, periodoAgg.leads))}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[11px] text-muted-foreground">Cliques</div>
                  <div className="text-lg font-semibold">{periodoAgg.cliques.toLocaleString("pt-BR")}</div>
                  <div className="text-[10px] text-muted-foreground">
                    CPC {fmt.brl(calc.cpc(periodoAgg.investimento, periodoAgg.cliques))}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[11px] text-muted-foreground">Impressões</div>
                  <div className="text-lg font-semibold">{periodoAgg.impressoes.toLocaleString("pt-BR")}</div>
                  <div className="text-[10px] text-muted-foreground">
                    CPM {fmt.brl(calc.cpm(periodoAgg.investimento, periodoAgg.impressoes))}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[11px] text-muted-foreground">Alcance</div>
                  <div className="text-lg font-semibold">{periodoAgg.alcance.toLocaleString("pt-BR")}</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma conta Meta configurada para este nicho.</p>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Leads Tráfego Pago (Meta Ads)
                  <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                    <Zap className="w-3 h-3" /> Auto Meta
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Use o botão "Puxar do Meta Ads" para preencher automaticamente. Você ainda pode editar caso precise ajustar.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldRow label="Investimento do dia">
                  <CurrencyInput value={lancamento.investimento} onChange={(v) => set("investimento", v || 0)} />
                </FieldRow>
                <FieldRow label="Impressões" calcLabel={`CPM ${fmt.brl(calc.cpm(lancamento.investimento, lancamento.impressoes))}`}>
                  <NumInput value={lancamento.impressoes} onChange={(v) => set("impressoes", v)} />
                </FieldRow>
                <FieldRow label="Alcance">
                  <NumInput value={lancamento.alcance} onChange={(v) => set("alcance", v)} />
                </FieldRow>
                <FieldRow
                  label="Cliques"
                  calcLabel={`CPC ${fmt.brl(calc.cpc(lancamento.investimento, lancamento.cliques))} · CTR ${fmt.pctFrac(calc.ctr(lancamento.cliques, lancamento.impressoes))}`}
                >
                  <NumInput value={lancamento.cliques} onChange={(v) => set("cliques", v)} />
                </FieldRow>
                <FieldRow label="Leads pagos" calcLabel={`CPL ${fmt.brl(calc.cpl(lancamento.investimento, lancamento.leads_pagos))}`}>
                  <NumInput value={lancamento.leads_pagos} onChange={(v) => set("leads_pagos", v)} />
                </FieldRow>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leads Tráfego Orgânico</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldRow label="Investimento do dia (impulsionamento/produção)">
                  <CurrencyInput
                    value={lancamento.investimento_organico}
                    onChange={(v) => set("investimento_organico", v || 0)}
                  />
                </FieldRow>
                <FieldRow label="Impressões" calcLabel={`CPM ${fmt.brl(calc.cpm(lancamento.investimento_organico, lancamento.impressoes_organico))}`}>
                  <NumInput value={lancamento.impressoes_organico} onChange={(v) => set("impressoes_organico", v)} />
                </FieldRow>
                <FieldRow label="Alcance">
                  <NumInput value={lancamento.alcance_organico} onChange={(v) => set("alcance_organico", v)} />
                </FieldRow>
                <FieldRow
                  label="Cliques"
                  calcLabel={`CPC ${fmt.brl(calc.cpc(lancamento.investimento_organico, lancamento.cliques_organico))} · CTR ${fmt.pctFrac(calc.ctr(lancamento.cliques_organico, lancamento.impressoes_organico))}`}
                >
                  <NumInput value={lancamento.cliques_organico} onChange={(v) => set("cliques_organico", v)} />
                </FieldRow>
                <FieldRow
                  label="Leads orgânicos (total do dia)"
                  calcLabel={`CPL ${fmt.brl(calc.cpl(lancamento.investimento_organico, lancamento.leads_organicos))} · detalhe em /metricas/organicos`}
                >
                  <NumInput value={lancamento.leads_organicos} onChange={(v) => set("leads_organicos", v)} />
                </FieldRow>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardContent className="p-4">
            <Label className="text-xs mb-1 block">Observações do dia (marketing)</Label>
            <Textarea
              rows={3}
              value={lancamento.observacoes || ""}
              onChange={(e) => set("observacoes", e.target.value || null)}
              placeholder="Campanhas ativas, eventos, anúncios pausados..."
            />
          </CardContent>
        </Card>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur py-3 border-t -mx-4 md:-mx-6 px-4 md:px-6">
          <Button size="lg" onClick={handleSave} disabled={saving} className="ml-auto block">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar marketing
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}