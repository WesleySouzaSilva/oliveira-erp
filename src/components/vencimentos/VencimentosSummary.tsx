import { isOverdue } from "@/components/vencimentos/lib/helpers";
import type { Contrato } from "@/hooks/useVencimentosData";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleAlert, Files } from "lucide-react";

interface VencimentosSummaryProps {
  filtered: Contrato[];
  contratos: Contrato[];
  showResolvidos: boolean;
  setShowResolvidos: (v: boolean) => void;
}

export function VencimentosSummary({ filtered, contratos, showResolvidos, setShowResolvidos }: VencimentosSummaryProps) {
  const atrasados = filtered.filter((c) => c.status_prazo === "Em atraso" || isOverdue(c.vencimento_proxima_parcela)).length;
  const emDia = filtered.filter((c) => c.status_prazo === "Em dia").length;
  const resolvidos = contratos.filter((c) => c.resolvido).length;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card" aria-label="Resumo dos contratos">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-serif text-sm font-bold text-foreground">Visão da carteira</h2>
        <p className="text-[11px] text-muted-foreground">Situação dos filtros atuais</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
        <div className="p-3.5">
          <div className="flex items-center gap-2 text-muted-foreground"><Files className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold uppercase">Contratos</span></div>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{filtered.length}</p>
        </div>
        <div className="p-3.5">
          <div className="flex items-center gap-2 text-destructive"><CircleAlert className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold uppercase">Em atraso</span></div>
          <p className="mt-1 font-mono text-2xl font-bold text-destructive">{atrasados}</p>
        </div>
        <div className="p-3.5">
          <div className="flex items-center gap-2 text-success"><CheckCircle2 className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold uppercase">Em dia</span></div>
          <p className="mt-1 font-mono text-2xl font-bold text-success">{emDia}</p>
        </div>
      </div>
      <div className="border-t border-border bg-secondary/30 p-3">
        <Button variant="outline" size="sm" className="w-full justify-between text-xs" onClick={() => setShowResolvidos(!showResolvidos)}>
          <span>{showResolvidos ? "Ocultar resolvidos" : "Mostrar resolvidos"}</span>
          <span className="font-mono text-muted-foreground">{resolvidos}</span>
        </Button>
      </div>
    </section>
  );
}