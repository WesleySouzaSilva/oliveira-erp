import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Séries SGS relevantes para crédito rural
const SERIES = {
  // Taxa média de juros - Crédito rural PF - Taxas de mercado
  juros_rural_mercado: 20769,
  // Taxa média de juros - Crédito rural PF - Taxas reguladas
  juros_rural_regulado: 25433,
  // Selic (meta)
  selic: 432,
  // IPCA acumulado 12 meses
  ipca_12m: 13522,
  // Taxa média geral de juros - PF - Recursos direcionados
  juros_direcionados_pf: 20714,
  // CDI
  cdi: 4392,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { series, dataInicio, dataFim } = await req.json();

    // series pode ser um código numérico ou nome da série predefinida
    const seriesCodes: number[] = [];
    const seriesNames: string[] = [];

    if (Array.isArray(series)) {
      for (const s of series) {
        if (typeof s === "number") {
          seriesCodes.push(s);
          seriesNames.push(`Serie_${s}`);
        } else if (typeof s === "string" && SERIES[s as keyof typeof SERIES]) {
          seriesCodes.push(SERIES[s as keyof typeof SERIES]);
          seriesNames.push(s);
        }
      }
    } else {
      // Buscar todas as séries predefinidas
      for (const [name, code] of Object.entries(SERIES)) {
        seriesCodes.push(code);
        seriesNames.push(name);
      }
    }

    const results: Record<string, any[]> = {};

    // Buscar cada série na API do BCB
    const promises = seriesCodes.map(async (code, i) => {
      let url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json`;
      if (dataInicio) url += `&dataInicial=${dataInicio}`;
      if (dataFim) url += `&dataFinal=${dataFim}`;

      console.log(`Fetching SGS series ${code}: ${url}`);

      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`SGS error for series ${code}: ${resp.status}`);
        return { name: seriesNames[i], data: [], error: `HTTP ${resp.status}` };
      }

      const data = await resp.json();
      return { name: seriesNames[i], code, data };
    });

    const responses = await Promise.all(promises);

    for (const r of responses) {
      results[r.name] = r.data;
    }

    return new Response(
      JSON.stringify({
        success: true,
        series: results,
        meta: {
          series_disponiveis: SERIES,
          periodo: { inicio: dataInicio || "auto", fim: dataFim || "auto" },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro SGS:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
