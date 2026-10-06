import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign } from "lucide-react";

interface SalarioEntry {
  id: string;
  valor: number;
  data_vigencia: string;
  motivo: string | null;
}

interface SalarioTimelineProps {
  salarios: SalarioEntry[];
}

export function SalarioTimeline({ salarios }: SalarioTimelineProps) {
  if (salarios.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro salarial.</p>;
  }

  return (
    <div className="relative pl-6 space-y-6">
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
      {salarios.map((s) => (
        <div key={s.id} className="relative">
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
            <DollarSign className="w-3 h-3 text-primary" />
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">
                R$ {Number(s.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(s.data_vigencia), "dd MMM yyyy", { locale: ptBR })}
              </span>
            </div>
            {s.motivo && <p className="text-xs text-muted-foreground mt-1">{s.motivo}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
