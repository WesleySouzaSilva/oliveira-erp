import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, AlertTriangle, GripVertical, ChevronDown, ChevronRight, User,
} from "lucide-react";
import { PRIORIDADE_STYLE } from "@/components/consultoria/NovaDemandaDialog";

export interface DemandaCard {
  id: string;
  assunto: string;
  area: string | null;
  prioridade: string;
  status: string;
  responsavel_id: string | null;
  prazo: string | null;
  empresa_id: string;
  empresa: { razao_social: string; nome_fantasia: string | null } | null;
}

/**
 * Colunas principais do fluxo. "cancelada" NÃO entra como coluna fixa:
 * fica numa faixa recolhível abaixo do board (não mistura no fluxo).
 */
const COLUMNS = [
  { key: "aberta",              label: "Aberta",              dot: "bg-primary",          bg: "bg-primary/5 border-primary/20" },
  { key: "em_analise",          label: "Em análise",          dot: "bg-blue-500",         bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" },
  { key: "aguardando_empresa",  label: "Aguardando empresa",  dot: "bg-yellow-500",       bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800" },
  { key: "concluida",           label: "Concluída",           dot: "bg-emerald-500",      bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" },
] as const;

interface Props {
  demandas: DemandaCard[];
  members: { user_id: string; nome: string | null }[];
  onMoveStatus: (id: string, newStatus: string) => Promise<void> | void;
}

export function DemandaKanban({ demandas, members, onMoveStatus }: Props) {
  const navigate = useNavigate();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const dragGhostRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () =>
      COLUMNS.map((col) => ({
        ...col,
        items: demandas.filter((d) => d.status === col.key),
      })),
    [demandas],
  );

  const canceladas = useMemo(() => demandas.filter((d) => d.status === "cancelada"), [demandas]);

  const nomeResp = (uid: string | null) => {
    if (!uid) return null;
    const m = members.find((x) => x.user_id === uid);
    return m?.nome || uid.slice(0, 8);
  };

  const handleDragStart = useCallback((e: React.DragEvent, d: DemandaCard) => {
    setDraggedId(d.id);
    e.dataTransfer.effectAllowed = "move";
    if (dragGhostRef.current) {
      dragGhostRef.current.textContent = d.assunto;
      e.dataTransfer.setDragImage(dragGhostRef.current, 60, 20);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const rel = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(rel)) setDragOverCol(null);
  }, []);

  const handleDrop = useCallback(
    async (colKey: string) => {
      const id = draggedId;
      setDraggedId(null);
      setDragOverCol(null);
      if (!id) return;
      const d = demandas.find((x) => x.id === id);
      if (!d || d.status === colKey) return;
      await onMoveStatus(id, colKey);
    },
    [draggedId, demandas, onMoveStatus],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverCol(null);
  }, []);

  return (
    <>
      <div
        ref={dragGhostRef}
        className="fixed -top-[9999px] bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg max-w-[220px] truncate"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const isOver = dragOverCol === col.key;
          return (
            <div
              key={col.key}
              className={`flex flex-col rounded-xl border-2 p-3 min-h-[400px] transition-all duration-200 ${col.bg} ${
                isOver ? "ring-2 ring-primary/40 border-primary/30 scale-[1.005] shadow-lg" : ""
              }`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(col.key)}
            >
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/30">
                <div className={`w-3 h-3 rounded-full ${col.dot}`} />
                <h3 className="text-xs font-bold tracking-wide text-foreground font-serif">{col.label}</h3>
                <Badge variant="secondary" className="text-[10px] ml-auto h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full">
                  {col.items.length}
                </Badge>
              </div>

              <div className="flex-1 space-y-2">
                {col.items.map((d) => (
                  <DemandaCardItem
                    key={d.id}
                    d={d}
                    isDragging={draggedId === d.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onOpen={() => navigate(`/consultoria/demandas/${d.id}`)}
                    respLabel={nomeResp(d.responsavel_id)}
                  />
                ))}

                {col.items.length === 0 && isOver && (
                  <div className="h-20 border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center animate-pulse">
                    <span className="text-xs text-primary/60">Soltar aqui</span>
                  </div>
                )}
                {col.items.length === 0 && !isOver && (
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-[11px] text-muted-foreground/50">Sem demandas</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canceladas.length > 0 && (
        <div className="mt-4 border border-border rounded-xl bg-muted/20">
          <button
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition"
            onClick={() => setShowCancelled((v) => !v)}
            type="button"
          >
            {showCancelled ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span className="font-semibold">Canceladas</span>
            <Badge variant="secondary" className="text-[10px] ml-1">{canceladas.length}</Badge>
            <span className="ml-auto text-[11px]">Arraste para reabrir em outra coluna</span>
          </button>
          {showCancelled && (
            <div
              className={`p-3 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-2 ${
                dragOverCol === "cancelada" ? "ring-2 ring-primary/30 rounded-b-xl" : ""
              }`}
              onDragOver={(e) => handleDragOver(e, "cancelada")}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop("cancelada")}
            >
              {canceladas.map((d) => (
                <DemandaCardItem
                  key={d.id}
                  d={d}
                  isDragging={draggedId === d.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onOpen={() => navigate(`/consultoria/demandas/${d.id}`)}
                  respLabel={nomeResp(d.responsavel_id)}
                  dimmed
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function DemandaCardItem({
  d, isDragging, onDragStart, onDragEnd, onOpen, respLabel, dimmed,
}: {
  d: DemandaCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, d: DemandaCard) => void;
  onDragEnd: () => void;
  onOpen: () => void;
  respLabel: string | null;
  dimmed?: boolean;
}) {
  const venc = d.prazo ? Math.floor((new Date(d.prazo).getTime() - Date.now()) / 86400000) : null;
  const overdue = venc !== null && venc < 0;
  const empresaNome = d.empresa?.nome_fantasia || d.empresa?.razao_social || "—";
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, d)}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`bg-background rounded-lg border p-3 transition-all duration-150 select-none ${
        isDragging
          ? "opacity-30 scale-95 rotate-1"
          : "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5"
      } ${overdue ? "border-destructive/50" : "border-border"} ${dimmed ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold leading-tight line-clamp-2">{d.assunto}</h4>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{empresaNome}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        <Badge className={`text-[10px] py-0 ${PRIORIDADE_STYLE[d.prioridade] || ""}`}>
          {d.prioridade}
        </Badge>
        {d.area && (
          <Badge variant="outline" className="text-[10px] py-0">
            {d.area}
          </Badge>
        )}
        {d.prazo && (
          <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {overdue ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
            {new Date(d.prazo).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      {respLabel && (
        <p className="text-[10px] text-muted-foreground/80 mt-2 flex items-center gap-1">
          <User className="w-3 h-3" /> {respLabel}
        </p>
      )}
    </div>
  );
}