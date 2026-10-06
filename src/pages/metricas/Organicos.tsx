import { InlineLoader } from "@/components/ui/loaders";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NichoPills } from "@/components/metricas/NichoPills";
import { useOrganicosDia, useLancamento } from "@/hooks/useMetricas";
import { ORIGENS_ORGANICAS, type Nicho, fmt } from "@/hooks/useMetricasCalc";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

interface Linha {
  origem_tipo: string;
  quantidade: number;
  indicado_por: string;
  observacoes: string;
  dirty: boolean;
}

export default function MetricasOrganicos() {
  const [data, setData] = useState(todayYMD());
  const [nicho, setNicho] = useState<Nicho>("agro");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [saving, setSaving] = useState(false);

  const { rows, loading, saveOrigem } = useOrganicosDia(data, nicho);
  const { lancamento } = useLancamento(data, nicho);

  useEffect(() => {
    setLinhas(
      ORIGENS_ORGANICAS.map((o) => {
        const r = rows.find((x) => x.origem_tipo === o.value);
        return {
          origem_tipo: o.value,
          quantidade: r?.quantidade || 0,
          indicado_por: r?.indicado_por || "",
          observacoes: r?.observacoes || "",
          dirty: false,
        };
      })
    );
  }, [rows]);

  const total = useMemo(() => linhas.reduce((s, l) => s + (l.quantidade || 0), 0), [linhas]);
  const diff = total - (lancamento.leads_organicos || 0);

  const update = (i: number, patch: Partial<Linha>) => {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch, dirty: true } : l)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const l of linhas) {
        if (!l.dirty) continue;
        await saveOrigem(
          l.origem_tipo,
          l.quantidade || 0,
          l.indicado_por || null,
          l.observacoes || null
        );
      }
      toast.success("Origens salvas com sucesso");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Leads Orgânicos por Origem</h1>
          <p className="text-sm text-muted-foreground">Detalhe a origem dos leads orgânicos do dia.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nicho</Label>
            <NichoPills value={nicho} onChange={setNicho} />
          </div>
        </div>

        {!loading && lancamento.leads_organicos > 0 && (
          <div
            className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${
              diff === 0
                ? "bg-primary/5 border-primary/30 text-primary"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            {diff === 0 ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div>
              Soma das origens: <strong>{fmt.num(total)}</strong> · Leads orgânicos no lançamento:{" "}
              <strong>{fmt.num(lancamento.leads_organicos)}</strong>
              {diff !== 0 && (
                <span className="ml-1">
                  · Diferença: <strong>{diff > 0 ? "+" : ""}{diff}</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <InlineLoader />
        ) : (
          <div className="space-y-3">
            {linhas.map((l, i) => {
              const meta = ORIGENS_ORGANICAS.find((o) => o.value === l.origem_tipo)!;
              return (
                <Card key={l.origem_tipo}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{meta.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Quantidade</Label>
                      <Input
                        type="number"
                        min={0}
                        value={l.quantidade || ""}
                        placeholder="0"
                        onChange={(e) => update(i, { quantidade: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    {l.origem_tipo === "indicacao" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Indicado por</Label>
                        <Input
                          value={l.indicado_por}
                          onChange={(e) => update(i, { indicado_por: e.target.value })}
                          placeholder="Nome de quem indicou"
                        />
                      </div>
                    )}
                    <div className={`space-y-1 ${l.origem_tipo === "indicacao" ? "" : "md:col-span-2"}`}>
                      <Label className="text-xs">Observações</Label>
                      <Textarea
                        rows={1}
                        value={l.observacoes}
                        onChange={(e) => update(i, { observacoes: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="sticky bottom-0 bg-background/95 backdrop-blur py-3 border-t flex justify-end">
          <Button size="lg" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar origens
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}