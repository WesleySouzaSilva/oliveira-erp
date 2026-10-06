import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { latitude, longitude, municipio } = await req.json();

    if (!latitude || !longitude) {
      throw new Error("Latitude e longitude são obrigatórios");
    }

    // yr.no API - previsão detalhada (gratuita, dados do Met Norway)
    const forecastUrl = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${latitude}&lon=${longitude}`;
    const forecastResp = await fetch(forecastUrl, {
      headers: {
        "User-Agent": "LaudoAgro/1.0 (contato@laudoagro.com.br)",
        "Accept": "application/json",
      },
    });

    if (!forecastResp.ok) {
      throw new Error(`yr.no API retornou ${forecastResp.status}`);
    }

    const forecastData = await forecastResp.json();
    const timeseries = forecastData?.properties?.timeseries || [];

    // Processar dados: agrupar por dia
    const diasMap: Record<string, any[]> = {};
    for (const ts of timeseries) {
      const data = ts.time?.split("T")[0];
      if (!data) continue;
      if (!diasMap[data]) diasMap[data] = [];
      diasMap[data].push(ts);
    }

    const previsaoDiaria = Object.entries(diasMap).slice(0, 10).map(([data, registros]) => {
      const temps = registros
        .map((r) => r.data?.instant?.details?.air_temperature)
        .filter((t) => t != null);
      const precipitacao = registros.reduce((sum, r) => {
        const p = r.data?.next_1_hours?.details?.precipitation_amount
          || r.data?.next_6_hours?.details?.precipitation_amount
          || 0;
        return sum + p;
      }, 0);
      const umidades = registros
        .map((r) => r.data?.instant?.details?.relative_humidity)
        .filter((h) => h != null);
      const ventos = registros
        .map((r) => r.data?.instant?.details?.wind_speed)
        .filter((w) => w != null);
      const pressoes = registros
        .map((r) => r.data?.instant?.details?.air_pressure_at_sea_level)
        .filter((p) => p != null);

      return {
        data,
        temperatura_maxima: temps.length > 0 ? Math.max(...temps) : null,
        temperatura_minima: temps.length > 0 ? Math.min(...temps) : null,
        temperatura_media: temps.length > 0 ? +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : null,
        precipitacao_mm: +precipitacao.toFixed(1),
        umidade_media: umidades.length > 0 ? +(umidades.reduce((a, b) => a + b, 0) / umidades.length).toFixed(1) : null,
        vento_medio_ms: ventos.length > 0 ? +(ventos.reduce((a, b) => a + b, 0) / ventos.length).toFixed(1) : null,
        pressao_media_hpa: pressoes.length > 0 ? +(pressoes.reduce((a, b) => a + b, 0) / pressoes.length).toFixed(1) : null,
      };
    });

    // Análise agroclimática
    const precipTotal = previsaoDiaria.reduce((s, d) => s + (d.precipitacao_mm || 0), 0);
    const diasComChuva = previsaoDiaria.filter(d => (d.precipitacao_mm || 0) > 1).length;
    const tempMinGlobal = Math.min(...previsaoDiaria.map(d => d.temperatura_minima || 999).filter(t => t !== 999));
    const tempMaxGlobal = Math.max(...previsaoDiaria.map(d => d.temperatura_maxima || -999).filter(t => t !== -999));
    const riscoGeada = tempMinGlobal <= 3;
    const estresseCalor = tempMaxGlobal >= 35;
    const veranico = previsaoDiaria.length >= 5 &&
      previsaoDiaria.filter(d => (d.precipitacao_mm || 0) < 1).length >= 5;

    return new Response(JSON.stringify({
      success: true,
      fonte: "yr.no / MET Norway",
      municipio: municipio || `${latitude}, ${longitude}`,
      coordenadas: { latitude, longitude },
      previsao: previsaoDiaria,
      analise_agroclimatica: {
        precipitacao_total_mm: +precipTotal.toFixed(1),
        dias_com_chuva: diasComChuva,
        dias_secos: previsaoDiaria.length - diasComChuva,
        temperatura_minima_periodo: tempMinGlobal,
        temperatura_maxima_periodo: tempMaxGlobal,
        risco_geada: riscoGeada,
        estresse_termico: estresseCalor,
        indicativo_veranico: veranico,
        periodo: {
          inicio: previsaoDiaria[0]?.data,
          fim: previsaoDiaria[previsaoDiaria.length - 1]?.data,
        },
      },
      consultado_em: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("yr.no error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
