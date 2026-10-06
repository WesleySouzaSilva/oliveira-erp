import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface PDICardProps {
  id: string;
  objetivo: string;
  competencia?: string | null;
  acao_pratica?: string | null;
  prazo?: string | null;
  status: string;
  evidencia_evolucao?: string | null;
  canEdit?: boolean;
  onEdit: (id: string) => void;
}

export function PDICard({ id, objetivo, competencia, acao_pratica, prazo, status, evidencia_evolucao, canEdit, onEdit }: PDICardProps) {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    em_andamento: { label: "Em Andamento", variant: "secondary" },
    concluido: { label: "Concluído", variant: "default" },
    cancelado: { label: "Cancelado", variant: "destructive" },
  };
  const st = statusMap[status] || statusMap.em_andamento;

  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{objetivo}</h4>
          {competencia && <p className="text-xs text-muted-foreground mt-0.5">Competência: {competencia}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
          {canEdit && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(id)} aria-label="Editar PDI">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      {acao_pratica && <p className="text-xs text-muted-foreground">{acao_pratica}</p>}
      {evidencia_evolucao && (
        <div className="bg-muted/50 rounded p-2">
          <p className="text-xs font-medium text-muted-foreground">Evidência</p>
          <p className="text-xs">{evidencia_evolucao}</p>
        </div>
      )}
      {prazo && (
        <p className="text-xs text-muted-foreground">
          Prazo: {format(new Date(prazo), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      )}
    </div>
  );
}
