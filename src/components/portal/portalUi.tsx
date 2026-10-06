import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  CHAMADO_STATUS_LABEL,
  CHAMADO_TIPO_LABEL,
  faseLabel,
  type ChamadoStatus,
  type ChamadoTipo,
} from "@/hooks/usePortalCliente";

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

export function fmtData(iso: string | null | undefined, comHora = false): string {
  if (!iso) return "";
  const d = iso.length <= 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return comHora
    ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR");
}

export function fmtDataExtenso(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.length <= 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function fmtBRL(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

export function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  return fmtData(iso);
}

/* ------------------------------------------------------------------ */
/* Blocos de página                                                    */
/* ------------------------------------------------------------------ */

export function PortalPage({
  titulo,
  subtitulo,
  voltar,
  acoes,
  children,
  className,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  voltar?: { to: string; label?: string };
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-5", className)}>
      {voltar && (
        <Link
          to={voltar.to}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {voltar.label || "Voltar"}
        </Link>
      )}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {titulo}
          </h1>
          {subtitulo && <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitulo}</p>}
        </div>
        {acoes && <div className="flex flex-wrap gap-2 shrink-0">{acoes}</div>}
      </header>
      {children}
    </div>
  );
}

export function PortalCard({
  children,
  className,
  titulo,
  icone: Icone,
  acao,
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  titulo?: ReactNode;
  icone?: LucideIcon;
  acao?: ReactNode;
  padding?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(6,78,59,0.04),0_8px_24px_-16px_rgba(6,78,59,0.25)]",
        className,
      )}
    >
      {(titulo || acao) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {Icone && <Icone className="h-4 w-4 text-accent" />}
            {titulo}
          </h2>
          {acao}
        </div>
      )}
      <div className={cn(padding && "px-5 pb-5", (titulo || acao) && !padding && "pt-1")}>{children}</div>
    </section>
  );
}

export function PortalVazio({
  icone: Icone,
  titulo,
  texto,
  acao,
}: {
  icone: LucideIcon;
  titulo: string;
  texto?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icone className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {texto && <p className="text-xs text-muted-foreground max-w-sm">{texto}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

export function PortalCarregando() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-20 rounded-2xl bg-muted/70" />
      <div className="h-20 rounded-2xl bg-muted/70" />
      <div className="h-20 rounded-2xl bg-muted/50" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export function ChamadoStatusBadge({ status }: { status: ChamadoStatus }) {
  const tone =
    status === "resolvido" ? "success"
    : status === "aguardando_cliente" ? "warning"
    : status === "em_andamento" ? "info"
    : "gold";
  return <StatusBadge tone={tone}>{CHAMADO_STATUS_LABEL[status] || status}</StatusBadge>;
}

export function ChamadoTipoBadge({ tipo }: { tipo: ChamadoTipo }) {
  const tone = tipo === "banco" ? "warning" : tipo === "documento" ? "info" : "neutral";
  return (
    <StatusBadge tone={tone} size="sm">
      {CHAMADO_TIPO_LABEL[tipo] || tipo}
    </StatusBadge>
  );
}

export function FaseBadge({ fase }: { fase: string | number | null }) {
  const label = faseLabel(fase);
  if (!label) return <StatusBadge tone="neutral" size="sm">Sem fase definida</StatusBadge>;
  return <StatusBadge tone={String(fase) === "5" ? "success" : "gold"} size="sm">{label}</StatusBadge>;
}
