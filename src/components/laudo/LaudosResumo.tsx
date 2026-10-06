import { FileText, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

export interface ResumoEtapa {
  key: string;
  etapa: number;
  label: string;
  count: number;
  dot: string;
}

interface Props {
  total: number;
  emAndamento: number;
  finalizados: number;
  parados: number;
  etapas: ResumoEtapa[];
  filtroAtivo: string;
  somenteParados: boolean;
  onFiltrar: (status: string) => void;
  onToggleParados: () => void;
  variant?: "grid" | "rail";
  showDetails?: boolean;
}

function Kpi({
  label,
  value,
  icon: Icon,
  active,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: any;
  active: boolean;
  tone: "neutral" | "info" | "success" | "accent" | "danger";
  onClick: () => void;
}) {
  const tones = {
    neutral: "text-muted-foreground bg-secondary",
    info: "text-info bg-info/15",
    success: "text-success bg-success/15",
    accent: "text-accent bg-accent/15",
    danger: "text-destructive bg-destructive/15",
  }[tone];

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border bg-card p-3.5 transition-all hover:shadow-card-hover hover:-translate-y-0.5 ${
        active ? "border-accent ring-1 ring-accent/40" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tones}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground truncate">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums mt-2">{value}</p>
    </button>
  );
}

export function LaudosResumo({
  total,
  emAndamento,
  finalizados,
  parados,
  etapas,
  filtroAtivo,
  somenteParados,
  onFiltrar,
  onToggleParados,
  variant = "grid",
  showDetails = true,
}: Props) {
  const maxEtapa = Math.max(1, ...etapas.map((e) => e.count));
  const rail = variant === "rail";

  return (
    <div className={rail ? "space-y-3" : "mb-5 space-y-3"}>
      <div className={rail ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 lg:grid-cols-4 gap-3"}>
        <Kpi label="Acervo" value={total} icon={FileText} tone="neutral" active={filtroAtivo === "todos" && !somenteParados} onClick={() => onFiltrar("todos")} />
        <Kpi label="Em andamento" value={emAndamento} icon={Clock} tone="info" active={filtroAtivo === "andamento"} onClick={() => onFiltrar("andamento")} />
        <Kpi label="Laudo pronto" value={finalizados} icon={CheckCircle2} tone="success" active={filtroAtivo === "finalizado"} onClick={() => onFiltrar("finalizado")} />
        <Kpi label="Parados +14d" value={parados} icon={AlertTriangle} tone="danger" active={somenteParados} onClick={onToggleParados} />
      </div>

      {showDetails && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-3">Distribuição por etapa</p>
          <div className="space-y-2">
            {etapas.map((e) => (
              <button
                key={e.key}
                onClick={() => onFiltrar(e.key)}
                className={`w-full flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors ${
                  filtroAtivo === e.key ? "bg-secondary" : "hover:bg-secondary/60"
                }`}
              >
                <span className="text-[11px] text-muted-foreground w-36 text-left truncate">
                  {e.etapa}. {e.label}
                </span>
                <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <span className={`block h-full rounded-full ${e.dot}`} style={{ width: `${(e.count / maxEtapa) * 100}%` }} />
                </span>
                <span className="text-xs font-semibold text-foreground tabular-nums w-8 text-right">{e.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}