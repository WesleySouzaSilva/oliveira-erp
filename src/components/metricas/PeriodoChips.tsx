import { cn } from "@/lib/utils";

export type PeriodoKey = "hoje" | "7d" | "30d" | "mes" | "mes_anterior" | "custom";

export interface Periodo {
  key: PeriodoKey;
  inicio: string; // YYYY-MM-DD
  fim: string;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function buildPeriodo(key: PeriodoKey, custom?: { inicio: string; fim: string }): Periodo {
  const today = new Date();
  const fim = ymd(today);
  if (key === "hoje") return { key, inicio: fim, fim };
  if (key === "7d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { key, inicio: ymd(d), fim };
  }
  if (key === "30d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return { key, inicio: ymd(d), fim };
  }
  if (key === "mes") {
    const i = new Date(today.getFullYear(), today.getMonth(), 1);
    return { key, inicio: ymd(i), fim };
  }
  if (key === "mes_anterior") {
    const i = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const f = new Date(today.getFullYear(), today.getMonth(), 0);
    return { key, inicio: ymd(i), fim: ymd(f) };
  }
  return { key: "custom", inicio: custom?.inicio || fim, fim: custom?.fim || fim };
}

export function periodoAnterior(p: Periodo): Periodo {
  const i = new Date(p.inicio + "T00:00:00");
  const f = new Date(p.fim + "T00:00:00");
  const dias = Math.round((f.getTime() - i.getTime()) / 86400000) + 1;
  const novoFim = new Date(i);
  novoFim.setDate(novoFim.getDate() - 1);
  const novoInicio = new Date(novoFim);
  novoInicio.setDate(novoInicio.getDate() - (dias - 1));
  return { key: "custom", inicio: ymd(novoInicio), fim: ymd(novoFim) };
}

const OPTIONS: { key: PeriodoKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "mes", label: "Este mês" },
  { key: "mes_anterior", label: "Mês passado" },
];

interface Props {
  value: PeriodoKey;
  onChange: (k: PeriodoKey) => void;
  custom?: Periodo;
  onCustomChange?: (p: { inicio: string; fim: string }) => void;
}

export function PeriodoChips({ value, onChange, custom, onCustomChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-muted">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              value === opt.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange("custom")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
            value === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Personalizado
        </button>
      </div>
      {value === "custom" && onCustomChange && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={custom?.inicio || ""}
            onChange={(e) => onCustomChange({ inicio: e.target.value, fim: custom?.fim || e.target.value })}
            className="h-8 px-2 rounded-md border border-input bg-background text-xs"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={custom?.fim || ""}
            onChange={(e) => onCustomChange({ inicio: custom?.inicio || e.target.value, fim: e.target.value })}
            className="h-8 px-2 rounded-md border border-input bg-background text-xs"
          />
        </div>
      )}
    </div>
  );
}