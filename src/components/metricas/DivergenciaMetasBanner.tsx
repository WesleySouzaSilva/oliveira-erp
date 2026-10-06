import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmt } from "@/hooks/useMetricasCalc";
import { toast } from "sonner";

interface Props {
  metasGlobais: any[]; // por nicho
  metasIndividuais: any[];
  onAjustarGlobal: (totais: { receita: number; contratos: number }) => Promise<void>;
  onRebalancearIndividuais: (diff: { receita: number; contratos: number }) => Promise<void>;
}

/**
 * Compara soma das metas individuais vs soma das metas globais (todos os nichos)
 * e oferece ações rápidas: ajustar global OU rebalancear individuais.
 */
export function DivergenciaMetasBanner({
  metasGlobais,
  metasIndividuais,
  onAjustarGlobal,
  onRebalancearIndividuais,
}: Props) {
  const [working, setWorking] = useState<"ajustar" | "rebalancear" | null>(null);

  const { totGlobalReceita, totGlobalContratos, totIndReceita, totIndContratos } = useMemo(() => {
    const totGlobalReceita = metasGlobais.reduce((s, m) => s + Number(m.meta_receita || 0), 0);
    const totGlobalContratos = metasGlobais.reduce((s, m) => s + (m.meta_contratos || 0), 0);
    const totIndReceita = metasIndividuais.reduce(
      (s, m) =>
        s +
        (Number(m.meta_receita) ||
          Number(m.meta_valor_total_contratos || 0) * (Number(m.pct_entrada || 30) / 100)),
      0,
    );
    const totIndContratos = metasIndividuais.reduce((s, m) => s + (m.meta_contratos || 0), 0);
    return { totGlobalReceita, totGlobalContratos, totIndReceita, totIndContratos };
  }, [metasGlobais, metasIndividuais]);

  const diffReceita = totIndReceita - totGlobalReceita;
  const diffContratos = totIndContratos - totGlobalContratos;
  const tol = 1; // tolerância de R$ 1 / 1 contrato
  const alinhado = Math.abs(diffReceita) <= tol && Math.abs(diffContratos) <= tol;

  if (metasIndividuais.length === 0 || metasGlobais.length === 0) return null;

  if (alinhado) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-success/30 bg-success/5 text-xs">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        <span className="text-foreground">
          Metas alinhadas: soma das individuais = meta global ({fmt.brl(totIndReceita)} ·{" "}
          {totIndContratos} contratos).
        </span>
      </div>
    );
  }

  const sugestao: "ajustar" | "rebalancear" =
    Math.abs(diffReceita) / Math.max(totGlobalReceita, 1) < 0.1 ? "ajustar" : "rebalancear";

  const ajustar = async () => {
    setWorking("ajustar");
    try {
      await onAjustarGlobal({ receita: totIndReceita, contratos: totIndContratos });
      toast.success("Meta global ajustada para a soma das individuais");
    } catch (e: any) {
      toast.error(e.message || "Erro ao ajustar global");
    } finally {
      setWorking(null);
    }
  };

  const rebalancear = async () => {
    setWorking("rebalancear");
    try {
      await onRebalancearIndividuais({ receita: -diffReceita, contratos: -diffContratos });
      toast.success("Diferença distribuída entre as metas individuais");
    } catch (e: any) {
      toast.error(e.message || "Erro ao redistribuir");
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-0.5 flex-1">
          <p className="font-medium text-foreground">
            Soma das metas individuais não bate com a meta global
          </p>
          <p className="text-muted-foreground">
            Receita — Global: <span className="font-medium">{fmt.brl(totGlobalReceita)}</span> · Soma
            individuais: <span className="font-medium">{fmt.brl(totIndReceita)}</span>{" "}
            <span className={diffReceita > 0 ? "text-success" : "text-destructive"}>
              ({diffReceita > 0 ? "+" : ""}
              {fmt.brl(diffReceita)})
            </span>
          </p>
          <p className="text-muted-foreground">
            Contratos — Global: <span className="font-medium">{totGlobalContratos}</span> · Soma
            individuais: <span className="font-medium">{totIndContratos}</span>{" "}
            <span className={diffContratos > 0 ? "text-success" : "text-destructive"}>
              ({diffContratos > 0 ? "+" : ""}
              {diffContratos})
            </span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={sugestao === "ajustar" ? "default" : "outline"}
          onClick={ajustar}
          disabled={!!working}
        >
          {working === "ajustar" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          Ajustar meta global ← soma individual
        </Button>
        <Button
          size="sm"
          variant={sugestao === "rebalancear" ? "default" : "outline"}
          onClick={rebalancear}
          disabled={!!working}
        >
          {working === "rebalancear" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          Distribuir diferença nas individuais
        </Button>
      </div>
    </div>
  );
}