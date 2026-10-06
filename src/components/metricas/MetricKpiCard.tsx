import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fmt } from "@/hooks/useMetricasCalc";
import { cn } from "@/lib/utils";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface Props {
  label: string;
  value: string;
  variacao?: number | "novo" | null;
  split?: { pago: number; organico: number };
  bgVariant?: "default" | "gold" | "danger" | "success";
  sparkline?: { v: number }[];
  hint?: string;
}

export function MetricKpiCard({ label, value, variacao, split, bgVariant = "default", sparkline, hint }: Props) {
  const variantClass = {
    default: "bg-gradient-to-br from-card to-card/60",
    gold: "bg-gradient-to-br from-accent/15 via-accent/5 to-transparent border-accent/40",
    danger: "bg-gradient-to-br from-destructive/15 via-destructive/5 to-transparent border-destructive/40",
    success: "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/40",
  }[bgVariant];

  const strokeColor =
    bgVariant === "gold" ? "hsl(var(--accent))"
    : bgVariant === "danger" ? "hsl(var(--destructive))"
    : "hsl(var(--primary))";

  const trendIcon = () => {
    if (variacao === "novo") return <span className="text-[10px] font-bold text-primary">NOVO</span>;
    if (variacao == null) return <Minus className="w-3 h-3" />;
    if (typeof variacao === "number" && variacao > 0) return <TrendingUp className="w-3 h-3 text-primary" />;
    if (typeof variacao === "number" && variacao < 0) return <TrendingDown className="w-3 h-3 text-destructive" />;
    return <Minus className="w-3 h-3" />;
  };

  const total = split ? split.pago + split.organico : 0;
  const pagoPct = total ? (split!.pago / total) * 100 : 0;

  return (
    <Card className={cn("relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200", variantClass)}>
      <CardContent className="p-4 space-y-2 relative z-10">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">{label}</p>
        <p className="text-3xl font-bold text-foreground tracking-tight tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        {split && (
          <div className="space-y-1">
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              <div className="bg-primary" style={{ width: `${pagoPct}%` }} />
              <div className="bg-accent" style={{ width: `${100 - pagoPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Pago: {fmt.num(split.pago)}</span>
              <span>Orgânico: {fmt.num(split.organico)}</span>
            </div>
          </div>
        )}
        {variacao !== undefined && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {trendIcon()}
            <span>{fmt.variacao(variacao ?? null)}</span>
            <span className="text-[10px]">vs período anterior</span>
          </div>
        )}
      </CardContent>
      {sparkline && sparkline.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 h-12 opacity-60 pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={strokeColor}
                strokeWidth={1.5}
                fill={`url(#spark-${label})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}