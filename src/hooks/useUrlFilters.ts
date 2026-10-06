import { useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * useUrlFilters — sincroniza um objeto de filtros com a query string.
 *
 * API:
 *   const [filters, setFilters] = useUrlFilters({ q: "", status: "todos" });
 *   setFilters({ q: "abc" })                 // patch parcial
 *   setFilters((prev) => ({ ...prev, ... })) // updater
 *
 * - Hidrata do URL na primeira renderização; cai no default se ausente.
 * - Usa `replace` (não empilha histórico a cada digitada).
 * - Params iguais ao default são REMOVIDOS da URL (mantém limpa).
 * - Serialização só de strings (converte números/booleans p/ string).
 * - Preserva outros params que não pertencem ao conjunto de filtros.
 */
export function useUrlFilters<T extends Record<string, string>>(
  defaults: T,
): [T, (patch: Partial<T> | ((prev: T) => Partial<T>)) => void] {
  const [params, setParams] = useSearchParams();
  const defaultsRef = useRef(defaults);

  const filters = useMemo(() => {
    const out = { ...defaultsRef.current } as T;
    for (const key of Object.keys(defaultsRef.current) as (keyof T)[]) {
      const v = params.get(key as string);
      if (v !== null) (out as any)[key] = v;
    }
    return out;
  }, [params]);

  const setFilters = useCallback(
    (patch: Partial<T> | ((prev: T) => Partial<T>)) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const currentSnapshot = { ...defaultsRef.current } as T;
          for (const key of Object.keys(defaultsRef.current) as (keyof T)[]) {
            const v = prev.get(key as string);
            if (v !== null) (currentSnapshot as any)[key] = v;
          }
          const resolved =
            typeof patch === "function" ? patch(currentSnapshot) : patch;
          for (const [k, v] of Object.entries(resolved)) {
            const def = (defaultsRef.current as any)[k];
            const val = v == null ? "" : String(v);
            if (val === "" || val === String(def ?? "")) next.delete(k);
            else next.set(k, val);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [filters, setFilters];
}
