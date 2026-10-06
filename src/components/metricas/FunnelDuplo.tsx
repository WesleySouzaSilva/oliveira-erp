import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { fmt } from "@/hooks/useMetricasCalc";

interface FunnelStage {
  label: string;
  value: number;
}

interface Props {
  pago: FunnelStage[];
  organico: FunnelStage[];
}

function StageBar({ stage, max, color, prev }: { stage: FunnelStage; max: number; color: string; prev?: number }) {
  const widthPct = max ? (stage.value / max) * 100 : 0;
  const pctTopo = max ? (stage.value / max) * 100 : 0;
  const pctPrev = prev ? (stage.value / prev) * 100 : null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{stage.label}</span>
        <span className="text-muted-foreground">{fmt.num(stage.value)}</span>
      </div>
      <div className="h-8 rounded-md bg-muted overflow-hidden relative">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.max(widthPct, 2)}%` }} />
        <div className="absolute inset-0 flex items-center px-2 text-[10px] text-foreground/70 gap-2">
          <span>{pctTopo.toFixed(1)}% topo</span>
          {pctPrev != null && <span>· {pctPrev.toFixed(1)}% etapa</span>}
        </div>
      </div>
    </div>
  );
}

export function FunnelDuplo({ pago, organico }: Props) {
  const maxP = pago[0]?.value || 1;
  const maxO = organico[0]?.value || 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Funil de Conversão</CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Conversões estimadas com base na proporção pago/orgânico de cada dia.
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Pago (Meta Ads)</p>
          {pago.map((s, i) => (
            <StageBar key={s.label} stage={s} max={maxP} color="bg-primary" prev={i > 0 ? pago[i - 1].value : undefined} />
          ))}
        </div>
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">Orgânico</p>
          {organico.map((s, i) => (
            <StageBar key={s.label} stage={s} max={maxO} color="bg-accent" prev={i > 0 ? organico[i - 1].value : undefined} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}