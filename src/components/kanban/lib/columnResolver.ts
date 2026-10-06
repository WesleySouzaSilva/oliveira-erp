import type { KanbanColumnDef, KanbanColumnView, KanbanCardData } from "./types";

/**
 * Resolve a coluna do Kanban para um card.
 * 1) Se kanban_coluna_id existe, usa.
 * 2) Senão, coluna com legacy_fase == faseAtual.
 * 3) Senão, primeira coluna sem legacy_fase (Onboarding) ou a primeira.
 */
export function resolveColumnId(
  card: Pick<KanbanCardData, "kanbanColunaId" | "faseAtual">,
  columns: KanbanColumnDef[],
): string | null {
  if (card.kanbanColunaId && columns.some((c) => c.id === card.kanbanColunaId)) {
    return card.kanbanColunaId;
  }
  const byLegacy = columns.find((c) => c.legacy_fase === card.faseAtual);
  if (byLegacy) return byLegacy.id;
  const fallback = columns.find((c) => c.legacy_fase == null) ?? columns[0];
  return fallback?.id ?? null;
}

export function buildBoardView(
  cards: KanbanCardData[],
  columns: KanbanColumnDef[],
): KanbanColumnView[] {
  const active = columns.filter((c) => !c.arquivada).sort((a, b) => a.ordem - b.ordem);
  const byCol = new Map<string, KanbanCardData[]>(active.map((c) => [c.id, []]));
  cards.forEach((card) => {
    const colId = resolveColumnId(card, active);
    if (colId && byCol.has(colId)) byCol.get(colId)!.push(card);
  });
  for (const arr of byCol.values()) {
    arr.sort((a, b) => {
      const ao = a.kanbanOrdem ?? Number.MAX_SAFE_INTEGER;
      const bo = b.kanbanOrdem ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return 0;
    });
  }
  return active.map((c) => ({ ...c, cards: byCol.get(c.id) ?? [] }));
}

/**
 * Fractional ranking: gera um número entre os vizinhos (ou nas pontas).
 */
export function computeFractionalOrder(
  prev: number | null | undefined,
  next: number | null | undefined,
): number {
  const p = prev ?? null;
  const n = next ?? null;
  if (p == null && n == null) return 1000;
  if (p == null && n != null) return n - 1;
  if (p != null && n == null) return p + 1;
  return ((p as number) + (n as number)) / 2;
}