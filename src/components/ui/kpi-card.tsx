import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiSkeleton } from "@/components/ui/skeletons";

/**
 * Cartão de KPI padronizado: rótulo pequeno em CAIXA-ALTA, número grande
 * em serifa (Playfair), ícone opcional, tom semântico opcional.
 * Use o tom para indicadores especiais; o default é neutro para não poluir.
 */
const kpiCardVariants = cva(
  "relative rounded-xl border bg-card p-5 shadow-card hover:shadow-card-hover transition-shadow",
  {
    variants: {
      tone: {
        neutral: "border-border",
        success: "border-success/30",
        warning: "border-warning/40",
        danger:  "border-destructive/30",
        info:    "border-info/30",
        gold:    "border-accent/40",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const toneAccent: Record<NonNullable<KpiTone>, string> = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-[hsl(var(--warning-foreground))]",
  danger:  "text-destructive",
  info:    "text-info",
  gold:    "text-accent",
};

const toneIconBg: Record<NonNullable<KpiTone>, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-[hsl(var(--warning-foreground))]",
  danger:  "bg-destructive/10 text-destructive",
  info:    "bg-info/10 text-info",
  gold:    "bg-accent/15 text-accent",
};

type KpiTone = VariantProps<typeof kpiCardVariants>["tone"];

export interface KpiCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof kpiCardVariants> {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Conteúdo extra ao pé do card (ex.: tendência). */
  footer?: React.ReactNode;
  loading?: boolean;
  /** Realça o número com o tom semântico. Default: false (mantém foreground). */
  emphasizeValue?: boolean;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  footer,
  tone,
  loading,
  emphasizeValue,
  className,
  ...rest
}: KpiCardProps) {
  if (loading) {
    return (
      <div className={cn(kpiCardVariants({ tone }), "p-4", className)}>
        <KpiSkeleton count={1} className="grid-cols-1 md:grid-cols-1 gap-2" />
      </div>
    );
  }

  const accent = toneAccent[(tone ?? "neutral") as NonNullable<KpiTone>];
  const iconBg = toneIconBg[(tone ?? "neutral") as NonNullable<KpiTone>];

  return (
    <div className={cn(kpiCardVariants({ tone }), className)} {...rest}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 font-display text-3xl font-semibold leading-tight tracking-tight truncate",
              emphasizeValue ? accent : "text-foreground",
            )}
          >
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{hint}</p>
          )}
        </div>
        {Icon && (
          <div className={cn("shrink-0 w-9 h-9 rounded-lg flex items-center justify-center", iconBg)}>
            <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
          </div>
        )}
      </div>
      {footer && <div className="mt-3 pt-3 border-t border-border/50">{footer}</div>}
    </div>
  );
}

export interface KpiGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3 | 4;
}

export function KpiGrid({ cols = 4, className, children, ...rest }: KpiGridProps) {
  const colsClass =
    cols === 2 ? "grid-cols-1 sm:grid-cols-2" :
    cols === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={cn("grid gap-4", colsClass, className)} {...rest}>
      {children}
    </div>
  );
}

export { kpiCardVariants };