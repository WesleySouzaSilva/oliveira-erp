import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface MetaCardProps {
  id: string;
  titulo: string;
  descricao?: string | null;
  prazo?: string | null;
  progresso: number;
  status: string;
  onEdit: (id: string) => void;
}

export function MetaCard({ id, titulo, descricao, prazo, progresso, status, onEdit }: MetaCardProps) {
  const statusVariant = status === "concluida" ? "default" : status === "cancelada" ? "destructive" : "secondary";
  const statusLabel = status === "concluida" ? "Concluída" : status === "cancelada" ? "Cancelada" : "Ativa";

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{titulo}</h4>
          {descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{descricao}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={statusVariant} className="text-[10px]">{statusLabel}</Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(id)} aria-label="Editar meta">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-medium">{progresso}%</span>
        </div>
        <Progress value={progresso} className="h-2" />
      </div>
      {prazo && (
        <p className="text-xs text-muted-foreground">
          Prazo: {format(new Date(prazo), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      )}
    </div>
  );
}
