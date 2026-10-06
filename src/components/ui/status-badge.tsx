import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge semântica unificada. Use `tone` para escolher o significado, ou
 * `status` para mapear automaticamente um status conhecido do app.
 * Visual neutro, compatível com a marca (verde / âmbar / cream).
 */
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none whitespace-nowrap transition-colors",
  {
    variants: {
      tone: {
        success:
          "bg-success/10 text-success border-success/25",
        warning:
          "bg-warning/15 text-[hsl(var(--warning-foreground))] border-warning/40",
        danger:
          "bg-destructive/10 text-destructive border-destructive/25",
        info:
          "bg-info/10 text-info border-info/25",
        neutral:
          "bg-muted text-muted-foreground border-border",
        gold:
          "bg-accent/15 text-accent border-accent/30",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5",
        md: "text-xs px-2.5 py-0.5",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "gold";

/**
 * Presets de status comuns no app. A chave é normalizada (lowercase,
 * sem acento, espaços/hífens viram `_`). Cada entrada define tom e
 * rótulo padrão. Mantém EXATAMENTE o significado original — só unifica
 * o visual.
 */
const PRESETS: Record<string, { tone: StatusTone; label: string }> = {
  // contratos / empresas
  ativo:           { tone: "success", label: "Ativo" },
  ativa:           { tone: "success", label: "Ativa" },
  inativo:         { tone: "neutral", label: "Inativo" },
  inativa:         { tone: "neutral", label: "Inativa" },
  suspenso:        { tone: "warning", label: "Suspenso" },
  suspensa:        { tone: "warning", label: "Suspensa" },
  encerrado:       { tone: "neutral", label: "Encerrado" },
  encerrada:       { tone: "neutral", label: "Encerrada" },
  cancelado:       { tone: "neutral", label: "Cancelado" },
  cancelada:       { tone: "neutral", label: "Cancelada" },

  // adimplência / financeiro
  adimplente:      { tone: "success", label: "Adimplente" },
  inadimplente:    { tone: "danger",  label: "Inadimplente" },
  atrasado:        { tone: "danger",  label: "Atrasado" },
  atrasada:        { tone: "danger",  label: "Atrasada" },
  pago:            { tone: "success", label: "Pago" },
  paga:            { tone: "success", label: "Paga" },
  pendente:        { tone: "warning", label: "Pendente" },
  vencido:         { tone: "danger",  label: "Vencido" },
  vencida:         { tone: "danger",  label: "Vencida" },

  // demandas / propostas / tickets
  aberta:          { tone: "info",    label: "Aberta" },
  aberto:          { tone: "info",    label: "Aberto" },
  em_analise:      { tone: "info",    label: "Em análise" },
  em_andamento:    { tone: "info",    label: "Em andamento" },
  andamento:       { tone: "info",    label: "Em andamento" },
  aguardando:      { tone: "warning", label: "Aguardando" },
  aguardando_cliente: { tone: "warning", label: "Aguardando cliente" },
  aguardando_banco:   { tone: "warning", label: "Aguardando banco" },
  concluida:       { tone: "success", label: "Concluída" },
  concluido:       { tone: "success", label: "Concluído" },
  finalizada:      { tone: "success", label: "Finalizada" },
  finalizado:      { tone: "success", label: "Finalizado" },
  enviada:         { tone: "info",    label: "Enviada" },
  enviado:         { tone: "info",    label: "Enviado" },
  aceita:          { tone: "success", label: "Aceita" },
  aceito:          { tone: "success", label: "Aceito" },
  rejeitada:       { tone: "danger",  label: "Rejeitada" },
  rejeitado:       { tone: "danger",  label: "Rejeitado" },
  recusada:        { tone: "danger",  label: "Recusada" },
  recusado:        { tone: "danger",  label: "Recusado" },
  rascunho:        { tone: "neutral", label: "Rascunho" },

  // prioridades
  baixa:           { tone: "neutral", label: "Baixa" },
  media:           { tone: "info",    label: "Média" },
  alta:            { tone: "warning", label: "Alta" },
  urgente:         { tone: "danger",  label: "Urgente" },
  critica:         { tone: "danger",  label: "Crítica" },

  // risco
  risco_baixo:     { tone: "success", label: "Risco baixo" },
  risco_medio:     { tone: "warning", label: "Risco médio" },
  risco_alto:      { tone: "danger",  label: "Risco alto" },
};

function normalize(s: string): string {
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function resolveStatusPreset(status: string): { tone: StatusTone; label: string } {
  const key = normalize(status);
  return PRESETS[key] ?? { tone: "neutral", label: status };
}

export interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
    VariantProps<typeof statusBadgeVariants> {
  /** Mapeia automaticamente um status conhecido (ex.: "ativo", "em_analise"). */
  status?: string;
  /** Sobrescreve o tom (útil quando `status` não cobre). */
  tone?: StatusTone;
  /** Rótulo customizado; quando ausente, usa o preset de `status` ou o próprio `status`. */
  label?: React.ReactNode;
  /** Ícone opcional à esquerda. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function StatusBadge({
  status,
  tone,
  size,
  label,
  icon,
  className,
  children,
  ...rest
}: StatusBadgeProps) {
  const preset = status ? resolveStatusPreset(status) : undefined;
  const finalTone: StatusTone = tone ?? preset?.tone ?? "neutral";
  const finalLabel = children ?? label ?? preset?.label ?? status ?? "";

  return (
    <span
      className={cn(statusBadgeVariants({ tone: finalTone, size }), className)}
      {...rest}
    >
      {icon && <span className="shrink-0 [&_svg]:w-3 [&_svg]:h-3">{icon}</span>}
      {finalLabel}
    </span>
  );
}

export { statusBadgeVariants };