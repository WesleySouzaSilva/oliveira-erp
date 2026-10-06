import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Maximize2, X, Settings2 } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import { CardDetailDialog } from "./CardDetailDialog";
import { ColumnSettingsDialog } from "./ColumnSettingsDialog";
import { BoardFiltersBar } from "./BoardFiltersBar";
import { useKanbanFilters, applyFilters } from "./hooks/useKanbanFilters";
import { useNavigate } from "react-router-dom";
import {
  useKanbanCards,
  useKanbanColumns,
  useMoveCard,
  useOrgId,
  useColumnMutations,
} from "./hooks/useKanbanData";
import {
  useEtiquetas,
  useAllCardEtiquetas,
  useAllCardMembros,
} from "./hooks/useEtiquetasMembros";
import { useAllCardCounts } from "./hooks/useCardSocial";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { buildBoardView, computeFractionalOrder } from "./lib/columnResolver";
import type { KanbanCardData, KanbanColumnView, Etiqueta } from "./lib/types";

export function KanbanBoard() {
  const navigate = useNavigate();
  const orgId = useOrgId();
  const colsQuery = useKanbanColumns(orgId);
  const cardsQuery = useKanbanCards();
  const move = useMoveCard();
  const colMut = useColumnMutations(orgId);
  const etiquetasQ = useEtiquetas(orgId);
  const cardEtiquetasQ = useAllCardEtiquetas(orgId);
  const cardMembrosQ = useAllCardMembros(orgId);
  const cardCountsQ = useAllCardCounts(orgId);
  const { members } = useOrgMembers();
  const filters = useKanbanFilters(orgId);
  const searchRef = useRef<HTMLInputElement>(null);

  const [draggedCard, setDraggedCard] = useState<KanbanCardData | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ colId: string; index: number } | null>(null);
  const dragGhostRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [openCard, setOpenCard] = useState<KanbanCardData | null>(null);
  const [openSettings, setOpenSettings] = useState(false);
  const [optimistic, setOptimistic] = useState<Map<string, { colId: string; ordem: number }>>(
    new Map(),
  );

  const columns = colsQuery.data ?? [];
  const cards = cardsQuery.data ?? [];

  // Aplica patches otimistas no array de cards antes de calcular a board
  const cardsWithOptimistic = useMemo(() => {
    if (optimistic.size === 0) return cards;
    return cards.map((c) => {
      const o = optimistic.get(c.id);
      if (!o) return c;
      return { ...c, kanbanColunaId: o.colId, kanbanOrdem: o.ordem };
    });
  }, [cards, optimistic]);

  const board: KanbanColumnView[] = useMemo(
    () => buildBoardView(cardsWithOptimistic, columns),
    [cardsWithOptimistic, columns],
  );

  const etiquetasByCard = useMemo(() => {
    const cat = new Map<string, Etiqueta>((etiquetasQ.data ?? []).map((e) => [e.id, e]));
    const result = new Map<string, Etiqueta[]>();
    cardEtiquetasQ.data?.forEach((ids, processoId) => {
      result.set(
        processoId,
        ids.map((id) => cat.get(id)).filter((e): e is Etiqueta => !!e),
      );
    });
    return result;
  }, [etiquetasQ.data, cardEtiquetasQ.data]);

  const membrosByCard = useMemo(() => {
    const cat = new Map<string, { user_id: string; nome: string | null }>(
      members.map((m) => [m.user_id, { user_id: m.user_id, nome: m.nome }]),
    );
    const result = new Map<string, Array<{ user_id: string; nome: string | null }>>();
    cardMembrosQ.data?.forEach((ids, processoId) => {
      result.set(
        processoId,
        ids
          .map((id) => cat.get(id))
          .filter((m): m is { user_id: string; nome: string | null } => !!m),
      );
    });
    return result;
  }, [members, cardMembrosQ.data]);

  const totalCases = cards.length;

  const filteredBoard = useMemo(
    () => applyFilters(board, filters.state, { etiquetasByCard, membrosByCard }),
    [board, filters.state, etiquetasByCard, membrosByCard],
  );

  // Totais por coluna ANTES dos filtros (para mostrar "X de Y" no header)
  const totalsByColumn = useMemo(() => {
    const m = new Map<string, number>();
    for (const col of board) m.set(col.id, col.cards.length);
    return m;
  }, [board]);

  // Atalhos de teclado: "/" foca busca, "Esc" sai do fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && fullscreen && !isTyping) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const loading = colsQuery.isLoading || cardsQuery.isLoading;

  const handleDragStart = useCallback((e: React.DragEvent, card: KanbanCardData) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = "move";
    if (dragGhostRef.current) {
      dragGhostRef.current.textContent = card.produtor;
      e.dataTransfer.setDragImage(dragGhostRef.current, 60, 20);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
    const colEl = e.currentTarget as HTMLElement;
    const cardEls = colEl.querySelectorAll("[data-card-id]");
    let insertIndex = 0;
    cardEls.forEach((cardEl, i) => {
      const rect = cardEl.getBoundingClientRect();
      if (e.clientY > rect.top + rect.height / 2) insertIndex = i + 1;
    });
    setDropIndicator({ colId, index: insertIndex });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const rel = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(rel)) {
      setDragOverCol(null);
      setDropIndicator(null);
    }
  }, []);

  const handleDrop = useCallback(
    async (targetColId: string) => {
      if (!draggedCard) return;
      const targetCol = board.find((c) => c.id === targetColId);
      if (!targetCol) {
        setDraggedCard(null);
        setDragOverCol(null);
        setDropIndicator(null);
        return;
      }

      // Calcula nova ordem fracionária
      const idx = dropIndicator?.colId === targetColId ? dropIndicator.index : targetCol.cards.length;
      const filteredCards = targetCol.cards.filter((c) => c.id !== draggedCard.id);
      const prev = filteredCards[idx - 1]?.kanbanOrdem ?? null;
      const next = filteredCards[idx]?.kanbanOrdem ?? null;
      const novaOrdem = computeFractionalOrder(prev, next);

      // Optimistic local
      setOptimistic((m) => {
        const n = new Map(m);
        n.set(draggedCard.id, { colId: targetColId, ordem: novaOrdem });
        return n;
      });
      setDraggedCard(null);
      setDragOverCol(null);
      setDropIndicator(null);

      try {
        await move.mutateAsync({
          cardId: draggedCard.id,
          kanbanColunaId: targetColId,
          legacyFase: targetCol.legacy_fase,
          kanbanOrdem: novaOrdem,
        });
      } finally {
        // Limpa patch otimista para esse card após invalidação
        setOptimistic((m) => {
          const n = new Map(m);
          n.delete(draggedCard.id);
          return n;
        });
      }
    },
    [draggedCard, dropIndicator, board, move],
  );

  const handleCardClick = useCallback(
    (card: KanbanCardData, e: React.MouseEvent) => {
      // Shift+click → atalho histórico para abrir a página completa
      if (e.shiftKey) {
        navigate(`/processos/${card.id}`);
        return;
      }
      setOpenCard(card);
    },
    [navigate],
  );

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-card p-6">
        <div className="text-center py-8 text-sm text-muted-foreground">
          Carregando pipeline...
        </div>
      </div>
    );
  }

  if (totalCases === 0) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          Pipeline de Casos
        </h2>
        <div className="text-center py-6 text-sm text-muted-foreground">
          Nenhum processo ativo. Crie um processo para visualizar o pipeline.
        </div>
      </div>
    );
  }

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-card p-5 lg:p-6 overflow-hidden flex flex-col"
    : "bg-card rounded-xl border border-border shadow-card p-5 lg:p-6";

  return (
    <div className={containerClass}>
      <div
        ref={dragGhostRef}
        className="fixed -top-[9999px] bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg"
      />

      <div className="flex items-center justify-between mb-5 shrink-0 gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          Pipeline de Casos
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            {totalCases} caso{totalCases !== 1 ? "s" : ""}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Arraste para mover · clique para detalhar · Shift+clique abre o processo
          </p>
          <button
            onClick={() => setOpenSettings(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md hover:bg-muted transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" /> Colunas
          </button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 px-2.5 py-1 rounded-md hover:bg-primary/10 transition-colors"
          >
            {fullscreen ? (
              <>
                <X className="w-3.5 h-3.5" /> Fechar
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" /> Tela cheia
              </>
            )}
          </button>
        </div>
      </div>

      <BoardFiltersBar
        ref={searchRef}
        state={filters.state}
        activeCount={filters.activeCount}
        members={members}
        etiquetas={etiquetasQ.data ?? []}
        columns={columns}
        orgId={orgId}
        onSearch={filters.setSearch}
        onToggleMember={filters.toggleMember}
        onToggleEtiqueta={filters.toggleEtiqueta}
        onSetDeadline={filters.setDeadline}
        onToggleColumn={filters.toggleColumn}
        onReset={filters.reset}
        totalMatched={filteredBoard.totalMatched}
        totalCards={totalCases}
      />

      <div
        className={`flex gap-4 overflow-x-auto overflow-y-hidden pb-3 -mx-1 px-1 ${
          fullscreen ? "flex-1" : "max-h-[640px]"
        }`}
        style={{ scrollbarWidth: "thin" }}
      >
        {filteredBoard.columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            totalCount={totalsByColumn.get(col.id)}
            isOver={dragOverCol === col.id}
            dropIndicator={dropIndicator}
            draggedCardId={draggedCard?.id ?? null}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onCardDragStart={handleDragStart}
            onCardClick={handleCardClick}
            onRename={() => setOpenSettings(true)}
            onArchive={() => colMut.archive.mutate(col.id)}
            etiquetasByCard={etiquetasByCard}
            membrosByCard={membrosByCard}
            countsByCard={cardCountsQ.data}
          />
        ))}
      </div>

      <CardDetailDialog
        card={openCard}
        orgId={orgId}
        open={!!openCard}
        onOpenChange={(v) => !v && setOpenCard(null)}
      />

      <ColumnSettingsDialog
        open={openSettings}
        onOpenChange={setOpenSettings}
        columns={columns}
        orgId={orgId}
      />
    </div>
  );
}