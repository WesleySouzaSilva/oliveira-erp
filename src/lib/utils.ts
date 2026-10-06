import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string as dd/MM/yyyy without timezone shifting.
 * Accepts ISO dates (YYYY-MM-DD) or full ISO timestamps.
 * For YYYY-MM-DD inputs, parses as a local date so the displayed day matches the stored day.
 */
export function formatDateBR(date: string | null | undefined): string {
  if (!date) return "—";
  const datePart = String(date).split("T")[0];
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) {
    // Fallback for non-ISO inputs
    const dt = new Date(date);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("pt-BR");
  }
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/**
 * Format CPF (xxx.xxx.xxx-xx) or CNPJ (xx.xxx.xxx/xxxx-xx) progressively.
 * Strips non-digits and applies the mask based on length.
 */
export function formatCpfCnpj(value: string): string {
  const digits = (value || "").replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/**
 * Normaliza texto para busca: minúsculas, sem acentos e sem pontuação.
 * Usado para que "João da Silva", "joao da silva" e "joao-da-silva" sejam equivalentes.
 */
export function normalizeSearch(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
