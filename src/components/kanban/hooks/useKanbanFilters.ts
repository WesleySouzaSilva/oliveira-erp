import { useEffect, useState, useCallback, useRef } from "react";
import type { KanbanCardData, KanbanColumnView, Etiqueta } from "../lib/types";

export type DeadlineFilter = "todos" | "vencendo" | "vencido" | "sem_prazo";

export interface KanbanFiltersState {
  search: string;
  memberIds: Set<string>;
  etiquetaIds: Set<string>;
  deadline: DeadlineFilter;
  hiddenColumns: Set<string>;
}

const initialState: KanbanFiltersState = {
  search: "",
  memberIds: new Set(),
  etiquetaIds: new Set(),
  deadline: "todos",
  hiddenColumns: new Set(),
};

const LS_PREFIX = "oa.kanban.filters.v1.";

function loadFromLS(orgId: string | null): KanbanFiltersState {
  if (!orgId || typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + orgId);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      memberIds: new Set<string>(Array.isArray(parsed.memberIds) ? parsed.memberIds : []),
      etiquetaIds: new Set<string>(Array.isArray(parsed.etiquetaIds) ? parsed.etiquetaIds : []),
      deadline: ["todos", "vencendo", "vencido", "sem_prazo"].includes(parsed.deadline)
        ? parsed.deadline
        : "todos",
      hiddenColumns: new Set<string>(Array.isArray(parsed.hiddenColumns) ? parsed.hiddenColumns : []),
    };
  } catch {
    return initialState;
  }
}

function saveToLS(orgId: string | null, state: KanbanFiltersState) {
  if (!orgId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LS_PREFIX + orgId,
      JSON.stringify({
        search: state.search,
        memberIds: Array.from(state.memberIds),
        etiquetaIds: Array.from(state.etiquetaIds),
        deadline: state.deadline,
        hiddenColumns: Array.from(state.hiddenColumns),
      }),
    );
  } catch {
    /* quota or privacy mode — ignore */
  }
}

export function useKanbanFilters(orgId: string | null) {
  const [state, setState] = useState<KanbanFiltersState>(() => loadFromLS(orgId));
  const loadedOrgRef = useRef<string | null>(orgId);

  // Rehydrate quando orgId é resolvido tardiamente
  useEffect(() => {
    if (orgId && loadedOrgRef.current !== orgId) {
      loadedOrgRef.current = orgId;
      setState(loadFromLS(orgId));
    }
  }, [orgId]);

  // Persiste em LS sempre que mudar (debounce leve via microtask)
  useEffect(() => {
    saveToLS(orgId, state);
  }, [orgId, state]);

  const setSearch = useCallback((v: string) => setState((s) => ({ ...s, search: v })), []);
  const toggleMember = useCallback((id: string) =>
    setState((s) => {
      const n = new Set(s.memberIds);
      n.has(id) ? n.delete(id) : n.add(id);
      return { ...s, memberIds: n };
    }), []);
  const toggleEtiqueta = useCallback((id: string) =>
    setState((s) => {
      const n = new Set(s.etiquetaIds);
      n.has(id) ? n.delete(id) : n.add(id);
      return { ...s, etiquetaIds: n };
    }), []);
  const setDeadline = useCallback((d: DeadlineFilter) =>
    setState((s) => ({ ...s, deadline: d })), []);
  const toggleColumn = useCallback((id: string) =>
    setState((s) => {
      const n = new Set(s.hiddenColumns);
      n.has(id) ? n.delete(id) : n.add(id);
      return { ...s, hiddenColumns: n };
    }), []);
  const reset = useCallback(() => setState(initialState), []);

  const activeCount =
    (state.search ? 1 : 0) +
    state.memberIds.size +
    state.etiquetaIds.size +
    (state.deadline !== "todos" ? 1 : 0) +
    state.hiddenColumns.size;

  return { state, setSearch, toggleMember, toggleEtiqueta, setDeadline, toggleColumn, reset, activeCount };
}

function matchesDeadline(card: KanbanCardData, d: DeadlineFilter): boolean {
  if (d === "todos") return true;
  if (d === "sem_prazo") return card.prazoRestante == null;
  if (card.prazoRestante == null) return false;
  if (d === "vencido") return card.prazoRestante <= 0;
  if (d === "vencendo") return card.prazoRestante > 0 && card.prazoRestante <= 3;
  return true;
}

export function applyFilters(
  board: KanbanColumnView[],
  state: KanbanFiltersState,
  ctx: {
    etiquetasByCard?: Map<string, Etiqueta[]>;
    membrosByCard?: Map<string, Array<{ user_id: string; nome: string | null }>>;
  },
): { columns: KanbanColumnView[]; totalMatched: number } {
  const q = state.search.trim().toLowerCase();
  let matched = 0;
  const cols = board
    .filter((col) => !state.hiddenColumns.has(col.id))
    .map((col) => {
      const filtered = col.cards.filter((card) => {
        if (q) {
          const hay = `${card.produtor} ${card.banco}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (state.memberIds.size > 0) {
          const ms = ctx.membrosByCard?.get(card.id) ?? [];
          if (!ms.some((m) => state.memberIds.has(m.user_id))) return false;
        }
        if (state.etiquetaIds.size > 0) {
          const ets = ctx.etiquetasByCard?.get(card.id) ?? [];
          if (!ets.some((e) => state.etiquetaIds.has(e.id))) return false;
        }
        if (!matchesDeadline(card, state.deadline)) return false;
        return true;
      });
      matched += filtered.length;
      return { ...col, cards: filtered };
    });
  return { columns: cols, totalMatched: matched };
}