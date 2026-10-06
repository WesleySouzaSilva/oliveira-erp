import { supabase } from "@/integrations/supabase/client";
import { FunctionRegion } from "@supabase/supabase-js";

/** Captura pelo servidor forçado em São Paulo (sa-east-1), onde o DJEN aceita o acesso. */
export async function capturarPeloServidor() {
  const { data, error } = await supabase.functions.invoke("djen-captura", {
    body: {}, region: FunctionRegion.SaEast1,
  });
  if (error) throw error;
  const r = (data as any)?.resultado?.[0];
  if (r?.erro) throw new Error(r.erro);
  const oabs: any[] = r?.oabs || [];
  return {
    recebidas: oabs.reduce((s, o) => s + (o.recebidas || 0), 0),
    novas: r?.novas ?? 0,
  };
}

const DJEN = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const brData = (s?: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");

/** Calendário da Controladoria (sáb/dom + feriados ativos + forenses ativos). */
export function montarCalendario(feriados: string[]) {
  const set = new Set(feriados);
  const util = (s: string) => {
    const dow = new Date(`${s}T12:00:00Z`).getUTCDay();
    return dow !== 0 && dow !== 6 && !set.has(s);
  };
  const seguinte = (s: string) => {
    const d = new Date(`${s}T12:00:00Z`);
    for (let i = 0; i < 400; i++) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (util(iso(d))) return iso(d);
    }
    return iso(d);
  };
  /** Prazo fatal: conta N dias úteis a partir do início do prazo (o início é o dia 1). */
  const prazoFatal = (inicio: string, dias: number) => {
    let d = util(inicio) ? inicio : seguinte(inicio);
    for (let i = 1; i < dias; i++) d = seguinte(d);
    return d;
  };
  return { util, seguinte, prazoFatal };
}

async function paginaDjen(p: URLSearchParams) {
  for (let t = 1; t <= 6; t++) {
    const res = await fetch(`${DJEN}?${p}`, { headers: { Accept: "application/json" } });
    if (res.status === 429) {
      await espera(3000 * 2 ** (t - 1));
      continue;
    }
    if (!res.ok) throw new Error(`O DJEN respondeu ${res.status}`);
    return res.json();
  }
  throw new Error("O DJEN limitou as consultas. Tente de novo em alguns minutos.");
}

/**
 * Busca no DJEN pelo navegador (o DJEN só aceita acessos do Brasil) e envia
 * cada página para o servidor gravar. Ao fim, o servidor liga ao ADVBOX e avisa.
 */
export async function capturarPeloNavegador(
  oabs: { id: string; numero: string; uf: string; carga_inicial_feita: boolean }[],
  onProgresso?: (msg: string) => void,
) {
  const hoje = iso(new Date(Date.now() - 3 * 3600e3));
  const menos = (n: number) => iso(new Date(new Date(`${hoje}T12:00:00Z`).getTime() - n * 86400e3));
  const novasIds: number[] = [];
  let recebidas = 0;
  for (const oab of oabs) {
    const ini = oab.carga_inicial_feita ? menos(5) : menos(31);
    for (let pagina = 1; pagina <= 100; pagina++) {
      onProgresso?.(`OAB ${oab.numero}/${oab.uf}: página ${pagina}…`);
      const b = await paginaDjen(new URLSearchParams({
        numeroOab: oab.numero, ufOab: oab.uf,
        dataDisponibilizacaoInicio: ini, dataDisponibilizacaoFim: hoje,
        itensPorPagina: "100", pagina: String(pagina),
      }));
      const itens: any[] = b?.items ?? [];
      recebidas += itens.length;
      if (itens.length) {
        const { data, error } = await supabase.functions.invoke("djen-captura", {
          body: { parcial: true, lotes: { [oab.id]: itens } },
        });
        if (error) throw error;
        const r = (data as any)?.resultado?.[0];
        if (r?.erro) throw new Error(r.erro);
        novasIds.push(...((r?.novas_ids as string[]) || []).map(Number));
      }
      if (itens.length < 100) break;
      await espera(1500);
    }
  }
  onProgresso?.("Ligando aos processos do ADVBOX…");
  const { data, error } = await supabase.functions.invoke("djen-captura", {
    body: { acao: "vincular_advbox", novasIds },
  });
  if (error) throw error;
  return { recebidas, novas: novasIds.length, advbox: (data as any)?.resultado?.[0]?.advbox };
}
