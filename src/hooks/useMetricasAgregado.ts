import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Nicho } from "./useMetricasCalc";

export interface AggTotais {
  investimento: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  leads_pagos: number;
  leads_organicos: number;
  leads_qualificados: number;
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  propostas_enviadas: number;
  contratos_fechados: number;
  contratos_perdidos: number;
  receita_fechada: number;
}

export interface AggPorNicho {
  nicho: string;
  investimento: number;
  leads: number;
  contratos: number;
  receita: number;
}

export interface AggPorDia {
  data: string;
  leads: number;
  investimento: number;
  receita: number;
}

export interface AggMotivo { motivo: string; qtd: number; }

export interface AggDashboard {
  totais: AggTotais;
  por_nicho: AggPorNicho[];
  por_dia: AggPorDia[];
  motivos: AggMotivo[];
}

const EMPTY: AggDashboard = {
  totais: {
    investimento: 0, impressoes: 0, alcance: 0, cliques: 0,
    leads_pagos: 0, leads_organicos: 0, leads_qualificados: 0,
    reunioes_agendadas: 0, reunioes_realizadas: 0, propostas_enviadas: 0,
    contratos_fechados: 0, contratos_perdidos: 0, receita_fechada: 0,
  },
  por_nicho: [], por_dia: [], motivos: [],
};

const TTL_MS = 5 * 60 * 1000; // 5 min
const mem = new Map<string, { ts: number; data: AggDashboard }>();

const cacheKey = (i: string, f: string, n: Nicho[]) =>
  `metricas:agg:${i}:${f}:${[...n].sort().join(",")}`;

export function clearMetricasAggCache() {
  mem.clear();
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("metricas:agg:"))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

export function useMetricasAgregado(inicio: string, fim: string, nichos: Nicho[] = []) {
  const [data, setData] = useState<AggDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIt = useCallback(async (force = false) => {
    const key = cacheKey(inicio, fim, nichos);
    if (!force) {
      const m = mem.get(key);
      if (m && Date.now() - m.ts < TTL_MS) { setData(m.data); setLoading(false); return; }
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { ts: number; data: AggDashboard };
          if (Date.now() - parsed.ts < TTL_MS) {
            mem.set(key, parsed);
            setData(parsed.data); setLoading(false); return;
          }
        }
      } catch { /* ignore */ }
    }
    setLoading(true);
    const { data: rpc, error: err } = await (supabase as any).rpc("mkt_dashboard_agregado", {
      p_inicio: inicio,
      p_fim: fim,
      p_nichos: nichos.length ? (nichos as string[]) : null,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    const norm: AggDashboard = {
      ...EMPTY,
      ...(rpc as any || {}),
      totais: { ...EMPTY.totais, ...((rpc as any)?.totais || {}) },
      por_nicho: (rpc as any)?.por_nicho || [],
      por_dia: (rpc as any)?.por_dia || [],
      motivos: (rpc as any)?.motivos || [],
    };
    const entry = { ts: Date.now(), data: norm };
    mem.set(key, entry);
    try { sessionStorage.setItem(key, JSON.stringify(entry)); } catch { /* ignore */ }
    setData(norm);
    setError(null);
    setLoading(false);
  }, [inicio, fim, nichos.join(",")]);

  useEffect(() => { fetchIt(false); }, [fetchIt]);

  const refresh = useCallback(() => fetchIt(true), [fetchIt]);

  return { data, loading, error, refresh };
}