import { useEffect, useState } from "react";

export type PinnedItem = {
  type: "cliente" | "processo" | "laudo";
  id: string;
  title: string;
  path: string;
};

const KEY = "oliveira:pinned-items";
const MAX = 5;

function read(): PinnedItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function write(list: PinnedItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event("pinned-items-changed"));
  } catch { /* ignore */ }
}

export function getPinnedItems(): PinnedItem[] { return read(); }

export function isPinned(type: PinnedItem["type"], id: string): boolean {
  return read().some((p) => p.type === type && p.id === id);
}

export function togglePin(item: PinnedItem): boolean {
  const list = read();
  const idx = list.findIndex((p) => p.type === item.type && p.id === item.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(list);
    return false;
  }
  if (list.length >= MAX) list.pop();
  list.unshift(item);
  write(list);
  return true;
}

export function usePinnedItems(): PinnedItem[] {
  const [items, setItems] = useState<PinnedItem[]>(read);
  useEffect(() => {
    const handler = () => setItems(read());
    window.addEventListener("pinned-items-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("pinned-items-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return items;
}