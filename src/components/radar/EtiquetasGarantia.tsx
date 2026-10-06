import { etiquetaDestacada, etiquetasOperacao } from "@/lib/garantias";
import { cn } from "@/lib/utils";

/** Etiquetas curtas da operação: AF, HIP, PEN, AVAL, REC… */
export function EtiquetasGarantia({
  tipos,
  temAvalista,
  className,
}: {
  tipos?: string[];
  temAvalista?: boolean;
  className?: string;
}) {
  const etiquetas = etiquetasOperacao(tipos || [], !!temAvalista);
  if (!etiquetas.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {etiquetas.map((e) => (
        <span
          key={e}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
            etiquetaDestacada(e)
              ? "bg-destructive/10 text-destructive border border-destructive/30"
              : "bg-muted text-muted-foreground border border-border",
          )}
        >
          {e}
        </span>
      ))}
    </span>
  );
}
