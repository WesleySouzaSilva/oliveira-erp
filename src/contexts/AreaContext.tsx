import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Area = "agro" | "empresarial" | "demandas-gerais" | "previdenciario";
const AREA_LS_KEY = "oliveira:sidebar-area";

interface AreaContextValue {
  area: Area;
  setArea: (a: Area) => void;
}

const AreaContext = createContext<AreaContextValue | undefined>(undefined);

function readInitial(): Area {
  try {
    const raw = localStorage.getItem(AREA_LS_KEY);
    if (raw === "agro" || raw === "empresarial" || raw === "demandas-gerais" || raw === "previdenciario") return raw;
  } catch { /* ignore */ }
  return "agro";
}

/**
 * Provider compartilhado da ÁREA selecionada (Agro / Empresarial).
 * Persiste em localStorage (`oliveira:sidebar-area`) e mantém estado reativo
 * para qualquer componente — sidebar, home, etc.
 */
export function AreaProvider({ children }: { children: ReactNode }) {
  const [area, setAreaState] = useState<Area>(readInitial);

  useEffect(() => {
    try { localStorage.setItem(AREA_LS_KEY, area); } catch { /* ignore */ }
    // Accent do squad ativo — pinta filete da sidebar, nome do squad e item ativo.
    try {
      document.documentElement.style.setProperty("--area-accent", `var(--area-${area})`);
    } catch { /* ignore */ }
  }, [area]);

  // Sincroniza entre abas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === AREA_LS_KEY &&
        (e.newValue === "agro" || e.newValue === "empresarial" || e.newValue === "demandas-gerais" || e.newValue === "previdenciario")
      ) {
        setAreaState(e.newValue as Area);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AreaContext.Provider value={{ area, setArea: setAreaState }}>
      {children}
    </AreaContext.Provider>
  );
}

export function useArea(): AreaContextValue {
  const ctx = useContext(AreaContext);
  if (!ctx) {
    // Fallback defensivo — não derruba a app se algum componente for usado fora do provider.
    return { area: readInitial(), setArea: () => { /* noop */ } };
  }
  return ctx;
}
