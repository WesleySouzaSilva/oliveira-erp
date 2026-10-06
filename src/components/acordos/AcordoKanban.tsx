import { useState, useMemo, useRef, useCallback } from "react";
import { AcordoTarefa } from "@/hooks/useAcordos";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, RefreshCw, Calendar, AlertTriangle,
  Phone, Mail, GripVertical,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";

const KANBAN_COLUMNS = [
  { key: "pendente", label: "Pendente", color: "bg-blue-500", bgClass: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" },
  { key: "em_andamento", label: "Em Andamento", color: "bg-yellow-500", bgClass: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800" },
  { key: "aguardando_resposta", label: "Aguardando", color: "bg-purple-500", bgClass: "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800" },
  { key: "concluida", label: "Concluída", color: "bg-green-500", bgClass: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" },
];

const PRIORIDADE_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-800 border-red-200",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
  baixa: "bg-gray-100 text-gray-600 border-gray-200",
};

interface AcordoKanbanProps {
  tarefas: AcordoTarefa[];
  members: any[];
  busca: string;
  onConcluir: (t: AcordoTarefa) => void;
  onMoveStatus: (id: string, newStatus: string) => void;
  onWhatsApp: (t: AcordoTarefa) => void;
  onEmail: (t: AcordoTarefa) => void;
}

export function AcordoKanban({
  tarefas, members, busca, onConcluir, onMoveStatus, onWhatsApp, onEmail,
}: AcordoKanbanProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragGhostRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() =>
    tarefas.filter(t =>
      !busca || t.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      t.nome_cliente?.toLowerCase().includes(busca.toLowerCase())
    ), [tarefas, busca]);

  const columns = useMemo(() =>
    KANBAN_COLUMNS.map(col => ({
      ...col,
      items: filtered.filter(t => {
        if (col.key === "concluida") return t.concluida;
        if (t.concluida) return false;
        return (t.status || "pendente") === col.key;
      }),
    })), [filtered]);

  const handleDragStart = useCallback((e: React.DragEvent, tarefa: AcordoTarefa) => {
    setDraggedId(tarefa.id);
    e.dataTransfer.effectAllowed = "move";
    if (dragGhostRef.current) {
      dragGhostRef.current.textContent = tarefa.titulo;
      e.dataTransfer.setDragImage(dragGhostRef.current, 60, 20);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverCol(null);
    }
  }, []);

  const handleDrop = useCallback((colKey: string) => {
    if (draggedId) {
      const tarefa = tarefas.find(t => t.id === draggedId);
      if (tarefa) {
        const currentStatus = tarefa.concluida ? "concluida" : (tarefa.status || "pendente");
        if (currentStatus !== colKey) {
          if (colKey === "concluida") {
            onConcluir(tarefa);
          } else {
            onMoveStatus(draggedId, colKey);
          }
        }
      }
    }
    setDraggedId(null);
    setDragOverCol(null);
  }, [draggedId, tarefas, onMoveStatus, onConcluir]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverCol(null);
  }, []);

  return (
    <>
      {/* Hidden drag ghost */}
      <div
        ref={dragGhostRef}
        className="fixed -top-[9999px] bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg max-w-[200px] truncate"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
        {columns.map(col => {
          const isOver = dragOverCol === col.key;
          return (
            <div
              key={col.key}
              className={`flex flex-col rounded-xl border-2 p-3 lg:p-4 min-h-[350px] transition-all duration-200 ${col.bgClass} ${
                isOver
                  ? "ring-2 ring-primary/40 border-primary/30 scale-[1.01] shadow-lg"
                  : ""
              }`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/30">
                <div className={`w-3 h-3 rounded-full ${col.color}`} />
                <h3 className="text-xs font-bold text-foreground tracking-wide">{col.label}</h3>
                <Badge variant="secondary" className="text-[10px] ml-auto h-5 w-5 flex items-center justify-center rounded-full p-0">
                  {col.items.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2">
                {col.items.map(tarefa => {
                  const vencida = isPast(new Date(tarefa.data_vencimento)) && !isToday(new Date(tarefa.data_vencimento));
                  const resp = members.find(m => m.user_id === tarefa.responsavel_id);
                  const isDragging = draggedId === tarefa.id;

                  return (
                    <div
                      key={tarefa.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, tarefa)}
                      onDragEnd={handleDragEnd}
                      className={`bg-background rounded-lg border border-border p-3 transition-all duration-150 select-none ${
                        isDragging
                          ? "opacity-30 scale-95 rotate-1"
                          : "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
                      } ${vencida && !tarefa.concluida ? "border-destructive/40" : ""} ${tarefa.concluida ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-0.5 hover:text-muted-foreground transition-colors" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-semibold leading-tight truncate flex-1">{tarefa.titulo}</h4>
                            {tarefa.recorrente && <RefreshCw className="w-3 h-3 shrink-0 text-muted-foreground" />}
                          </div>
                          {tarefa.nome_cliente && (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{tarefa.nome_cliente}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Badge variant="outline" className={`text-[10px] py-0 ${PRIORIDADE_COLORS[tarefa.prioridade] || ""}`}>
                          {tarefa.prioridade}
                        </Badge>
                        <span className={`text-[10px] flex items-center gap-0.5 ${vencida ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {vencida ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                          {format(new Date(tarefa.data_vencimento), "dd/MM")}
                        </span>
                      </div>

                      {resp && <p className="text-[10px] text-muted-foreground/70 mb-2">{resp.nome || "Membro"}</p>}

                      {/* Action buttons */}
                      {!tarefa.concluida && (
                        <div className="flex items-center gap-1 pt-2 border-t border-border/40">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onWhatsApp(tarefa); }} title="WhatsApp">
                            <Phone className="w-3 h-3 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onEmail(tarefa); }} title="Email">
                            <Mail className="w-3 h-3 text-blue-600" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto" onClick={(e) => { e.stopPropagation(); onConcluir(tarefa); }} title="Concluir">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Drop zone when empty */}
                {col.items.length === 0 && isOver && (
                  <div className="h-20 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center animate-pulse">
                    <span className="text-xs text-primary/50">Soltar aqui</span>
                  </div>
                )}
                {col.items.length === 0 && !isOver && (
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground/40">Nenhuma tarefa</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
