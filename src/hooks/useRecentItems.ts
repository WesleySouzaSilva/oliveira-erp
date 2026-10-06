import { useEffect } from "react";

export type RecentItemType = "cliente" | "processo" | "laudo";

export interface RecentItem {
  type: RecentItemType;
  id: string;
  title: string;
  subtitle?: string;
  path: string;
  visitedAt: number;
}

const KEY = "oliveira:recent-items";
const MAX = 10;

function read(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: RecentItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    window.dispatchEvent(new Event("recent-items-changed"));
  } catch {
    /* ignore quota */
  }
}

export function pushRecentItem(item: Omit<RecentItem, "visitedAt">) {
  if (!item.title || !item.path) return;
  const list = read().filter((it) => !(it.type === item.type && it.id === item.id));
  list.unshift({ ...item, visitedAt: Date.now() });
  write(list);
}

export function getRecentItems(): RecentItem[] {
  return read();
}

export function clearRecentItems() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("recent-items-changed"));
  } catch {
    /* ignore */
  }
}

/**
 * Hook para registrar uma visita assim que a página monta.
 * Use em telas de detalhe (cliente, processo, laudo).
 */
export function useTrackRecentItem(item: Omit<RecentItem, "visitedAt"> | null | undefined) {
  useEffect(() => {
    if (!item || !item.id || !item.title) return;
    pushRecentItem(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.type, item?.id, item?.title]);
}