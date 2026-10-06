import { motion } from "framer-motion";
import { GripVertical, Building2, MessageSquare, Paperclip } from "lucide-react";
import type { KanbanCardData, Etiqueta } from "./lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Props {
  card: KanbanCardData;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, card: KanbanCardData) => void;
  onClick: (card: KanbanCardData, e: React.MouseEvent) => void;
  etiquetas?: Etiqueta[];
  membros?: Array<{ user_id: string; nome: string | null }>;
  counts?: { comentarios: number; anexos: number };
}

function initials(nome: string | null | undefined): string {
  if (!nome) return "?";
  return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function KanbanCard({ card, isDragging, onDragStart, onClick, etiquetas, membros, counts }: Props) {
  return (
    <motion.div
      layout
      data-card-id={card.id}
      draggable
      onDragStart={(e: any) => onDragStart(e, card)}
      onClick={(e) => onClick(card, e)}
      className={`bg-background rounded-lg border border-border p-3 shadow-sm transition-all duration-150 select-none ${
        isDragging
          ? "opacity-30 scale-95 rotate-1"
          : "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
      }`}
    >
      {etiquetas && etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {etiquetas.map((et) => (
            <span
              key={et.id}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border leading-tight ${et.cor}`}
              title={et.nome}
            >
              {et.nome}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 mb-2">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-0.5 hover:text-muted-foreground transition-colors" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{card.produtor}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{card.banco}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {card.valor && (
          <span className="text-[11px] text-muted-foreground font-medium">
            R$ {card.valor.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          {membros && membros.length > 0 && (
            <div className="flex -space-x-1.5 mr-1">
              {membros.slice(0, 3).map((m) => (
                <Avatar key={m.user_id} className="w-5 h-5 ring-2 ring-background" title={m.nome ?? ""}>
                  <AvatarFallback className="text-[9px] bg-primary/15 text-primary font-semibold">
                    {initials(m.nome)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {membros.length > 3 && (
                <span className="text-[9px] bg-muted text-muted-foreground w-5 h-5 rounded-full ring-2 ring-background flex items-center justify-center font-semibold">
                  +{membros.length - 3}
                </span>
              )}
            </div>
          )}
          {card.prazoRestante != null && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                card.prazoRestante <= 0
                  ? "bg-destructive/10 text-destructive"
                  : card.prazoRestante <= 3
                  ? "bg-accent/10 text-accent"
                  : "bg-success/10 text-success"
              }`}
            >
              {card.prazoRestante <= 0 ? "Vencido" : `${card.prazoRestante}d`}
            </span>
          )}
          {counts && counts.comentarios > 0 && (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5" title="Comentários">
              <MessageSquare className="w-3 h-3" />
              {counts.comentarios}
            </span>
          )}
          {counts && counts.anexos > 0 && (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5" title="Anexos">
              <Paperclip className="w-3 h-3" />
              {counts.anexos}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/50">{card.diasNaFase}d</span>
        </div>
      </div>
    </motion.div>
  );
}