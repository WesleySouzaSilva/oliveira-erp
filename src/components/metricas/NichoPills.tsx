import { NICHOS, type Nicho } from "@/hooks/useMetricasCalc";
import { cn } from "@/lib/utils";

interface Props {
  value: Nicho;
  onChange: (n: Nicho) => void;
}

const SHORT: Record<Nicho, string> = { agro: "Agro", empresarial: "Empresarial", bpc: "BPC", outros: "Outros" };

export function NichoPills({ value, onChange }: Props) {
  return (
    <div className="inline-flex flex-wrap gap-2 p-1 rounded-xl bg-muted">
      {NICHOS.map((n) => {
        const active = value === n.value;
        return (
          <button
            key={n.value}
            type="button"
            onClick={() => onChange(n.value)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            {SHORT[n.value]}
          </button>
        );
      })}
    </div>
  );
}

interface MultiProps {
  value: Nicho[];
  onChange: (n: Nicho[]) => void;
}

export function NichoMultiPills({ value, onChange }: MultiProps) {
  const toggle = (n: Nicho) => {
    if (value.includes(n)) onChange(value.filter((x) => x !== n));
    else onChange([...value, n]);
  };
  const allActive = value.length === 0 || value.length === NICHOS.length;
  return (
    <div className="inline-flex flex-wrap gap-2 p-1 rounded-xl bg-muted">
      <button
        type="button"
        onClick={() => onChange([])}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
          allActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Todos
      </button>
      {NICHOS.map((n) => {
        const active = value.includes(n.value);
        return (
          <button
            key={n.value}
            type="button"
            onClick={() => toggle(n.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              active && !allActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            {SHORT[n.value]}
          </button>
        );
      })}
    </div>
  );
}