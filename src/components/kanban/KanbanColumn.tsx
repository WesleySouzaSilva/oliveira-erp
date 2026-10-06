import { MoreVertical, Archive, Pencil } from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { KanbanCardData, KanbanColumnView, Etiqueta } from "./lib/types";

interface Props {
  column: KanbanColumnView;
  totalCount?: number;
  isOver: boolean;
  dropIndicator: { colId: string; index: number } | null;
  draggedCardId: string | null;
  onDragOver: (e: React.DragEvent, colId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (colId: string) => void;
  onCardDragStart: (e: React.DragEvent, card: KanbanCardData) => void;
  onCardClick: (card: KanbanCardData, e: React.MouseEvent) => void;
  onRename: () => void;
  onArchive: () => void;
  etiquetasByCard?: Map<string, Etiqueta[]>;
  membrosByCard?: Map<string, Array<{ user_id: string; nome: string | null }>>;
  countsByCard?: Map<string, { comentarios: number; anexos: number }>;
}

export function KanbanColumn({
  column,
  totalCount,
  isOver,
  dropIndicator,
  draggedCardId,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardClick,
  onRename,
  onArchive,
  etiquetasByCard,
  membrosByCard,
  countsByCard,
}: Props) {
  return (
    <div
      className={`shrink-0 w-[300px] flex flex-col rounded-xl border-2 p-3 transition-all duration-200 ${column.cor} ${
        isOver ? "ring-2 ring-primary/40 border-primary/30 scale-[1.01] shadow-lg" : "border-transparent"
      }`}
      onDragOver={(e) => onDragOver(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(column.id)}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/30 shrink-0">
        <span className="text-sm font-bold text-foreground tracking-wide truncate">{column.titulo}</span>
        <span
          className="ml-auto text-[10px] bg-background/80 text-muted-foreground px-1.5 h-5 min-w-5 flex items-center justify-center rounded-full font-semibold"
          title={
            totalCount != null && totalCount !== column.cards.length
              ? `${column.cards.length} de ${totalCount} (filtrado)`
              : undefined
          }
        >
          {totalCount != null && totalCount !== column.cards.length
            ? `${column.cards.length}/${totalCount}`
            : column.cards.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="text-muted-foreground/60 hover:text-foreground p-0.5 rounded hover:bg-background/60"
              aria-label="Opções da coluna"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Renomear / recolorir
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive} className="text-destructive">
              <Archive className="w-3.5 h-3.5 mr-2" /> Arquivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-[120px]">
        {column.cards.map((card, idx) => {
          const showBefore =
            dropIndicator?.colId === column.id && dropIndicator.index === idx && isOver;
          const showAfter =
            dropIndicator?.colId === column.id &&
            dropIndicator.index === idx + 1 &&
            idx === column.cards.length - 1 &&
            isOver;
          return (
            <div key={card.id}>
              {showBefore && (
                <div className="h-1 bg-primary/50 rounded-full mb-2 transition-all animate-pulse" />
              )}
              <KanbanCard
                card={card}
                isDragging={draggedCardId === card.id}
                onDragStart={onCardDragStart}
                onClick={onCardClick}
                etiquetas={etiquetasByCard?.get(card.id)}
                membros={membrosByCard?.get(card.id)}
                counts={countsByCard?.get(card.id)}
              />
              {showAfter && (
                <div className="h-1 bg-primary/50 rounded-full mt-2 transition-all animate-pulse" />
              )}
            </div>
          );
        })}

        {column.cards.length === 0 && isOver && (
          <div className="h-16 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center animate-pulse">
            <span className="text-xs text-primary/50">Soltar aqui</span>
          </div>
        )}
        {column.cards.length === 0 && !isOver && (
          <div className="h-16 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/40">Nenhum caso</span>
          </div>
        )}
      </div>
    </div>
  );
}