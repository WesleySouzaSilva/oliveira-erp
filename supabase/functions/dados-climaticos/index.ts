import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Exige usuário autenticado (consulta fontes externas e consome créditos de IA)
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: authData } = token
      ? await authClient.auth.getUser(token)
      : { data: { user: null } };
    if (!authData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, uf, municipio, dataInicio, dataFim, latitude, longitude } = await req.json();

    // ──────────────────────────────────────────────
    // ACTION: list_stations — return only the nearest
    // ──────────────────────────────────────────────
    if (action === "list_stations") {
      const resp = await fetch("https://apitempo.inmet.gov.br/estacoes/T");
      if (!resp.ok) throw new Error("Falha ao buscar estações INMET");

      const allStations = await resp.json();
      let filtered = allStations.filter((s: any) => {
        const matchUf = !uf || s.SG_ESTADO === uf;
        return matchUf && s.CD_SITUACAO === "Operante";
      });

      // If municipio provided, find best match and use its coords as reference
      let refLat = latitude ? parseFloat(latitude) : null;
      let refLon = longitude ? parseFloat(longitude) : null;

      if (municipio && municipio.trim()) {
        const search = normalizeStr(municipio.trim());

        const scored = filtered.map((s: any) => {
          const nome = normalizeStr(s.DC_NOME || "");
          if (nome === search) return { s, score: 100 };
          if (nome.includes(search)) return { s, score: 80 };
          if (search.includes(nome)) return { s, score: 60 };
          if (search.length >= 3 && nome.includes(search.substring(0, 3))) return { s, score: 30 };
          return { s, score: 0 };
        });

        const matches = scored.filter((x: any) => x.score > 0).sort((a: any, b: any) => b.score - a.score);
        if (matches.length > 0) {
          const best = matches[0].s;
          if (!refLat) {
            refLat = parseFloat(best.VL_LATITUDE);
            refLon = parseFloat(best.VL_LONGITUDE);
          }
        }
      }

      // If we have a reference point, sort by distance and return the nearest
      if (refLat && refLon) {
        const withDist = filtered.map((s: any) => ({
          s,
          dist: haversineKm(refLat!, refLon!, parseFloat(s.VL_LATITUDE), parseFloat(s.VL_LONGITUDE)),
        }));
        withDist.sort((a: any, b: any) => a.dist - b.dist);
        filtered = withDist.slice(0, 1).map((x: any) => x.s);
      } else {
        filtered = filtered.slice(0, 1);
      }

      const result = filtered.map((s: any) => ({
        codigo: s.CD_ESTACAO,
        nome: s.DC_NOME,
        uf: s.SG_ESTADO,
        latitude: parseFloat(s.VL_LATITUDE),
        longitude: parseFloat(s.VL_LONGITUDE),
        altitude: parseFloat(s.VL_ALTITUDE),
        dataInicio: s.DT_INICIO_OPERACAO,
        distanciaKm: refLat ? Math.round(haversineKm(refLat, refLon!, parseFloat(s.VL_LATITUDE), parseFloat(s.VL_LONGITUDE))) : null,
      }));

      return new Response(JSON.stringify({ stations: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────
    // ACTION: nasa_power — satellite data for any coordinate
    // ──────────────────────────────────────────────
    if (action === "nasa_power") {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lon)) throw new Error("Coordenadas inválidas");

      const start = (dataInicio || "").replace(/-/g, "") || "20240101";
      const end = (dataFim || "").replace(/-/g, "") || new Date().toISOString().slice(0, 10).replace(/-/g, "");

      const params = "PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,ALLSKY_SFC_SW_DWN,RH2M";
      const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params}&community=AG&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`NASA POWER API erro: ${resp.status}`);
      const data = await resp.json();

      const properties = data.properties?.parameter || {};
      const precip = properties.PRECTOTCORR || {};
      const t2m = properties.T2M || {};
      const tmax = properties.T2M_MAX || {};
      const tmin = properties.T2M_MIN || {};
      const solar = properties.ALLSKY_SFC_SW_DWN || {};
      const humidity = properties.RH2M || {};

      // Aggregate monthly
      const monthly: Record<string, { precip: number; tAvg: number[]; tMax: number; tMin: number; solar: number[]; humidity: number[]; count: number }> = {};

      for (const [dateStr, val] of Object.entries(precip)) {
        const v = val as number;
        if (v < -900) continue; // missing data sentinel
        const ym = dateStr.slice(0, 6); // YYYYMM
        if (!monthly[ym]) monthly[ym] = { precip: 0, tAvg: [], tMax: -999, tMin: 999, solar: [], humidity: [], count: 0 };
        monthly[ym].precip += v;
        monthly[ym].count++;

        const tVal = (t2m as any)[dateStr] as number;
        if (tVal > -900) monthly[ym].tAvg.push(tVal);

        const tmaxVal = (tmax as any)[dateStr] as number;
        if (tmaxVal > -900 && tmaxVal > monthly[ym].tMax) monthly[ym].tMax = tmaxVal;

        const tminVal = (tmin as any)[dateStr] as number;
        if (tminVal > -900 && tminVal < monthly[ym].tMin) monthly[ym].tMin = tminVal;

        const solarVal = (solar as any)[dateStr] as number;
        if (solarVal > -900) monthly[ym].solar.push(solarVal);

        const humVal = (humidity as any)[dateStr] as number;
        if (humVal > -900) monthly[ym].humidity.push(humVal);
      }

      const monthlyData = Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ym, m]) => {
          const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
          const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
          const monthIdx = parseInt(ym.slice(4)) - 1;
          return {
            mes: `${monthNames[monthIdx]}/${ym.slice(2, 4)}`,
            precipitacao: Math.round(m.precip * 10) / 10,
            tempMedia: avg(m.tAvg),
            tempMax: m.tMax > -900 ? Math.round(m.tMax * 10) / 10 : null,
            tempMin: m.tMin < 900 ? Math.round(m.tMin * 10) / 10 : null,
            radiacaoSolar: avg(m.solar),
            umidadeRelativa: avg(m.humidity),
          };
        });

      // Totals
      const allPrecip = Object.values(precip).filter((v: any) => v > -900) as number[];
      const allT2m = Object.values(t2m).filter((v: any) => v > -900) as number[];
      const allTmax = Object.values(tmax).filter((v: any) => v > -900) as number[];
      const allTmin = Object.values(tmin).filter((v: any) => v > -900) as number[];

      const totalPrecip = allPrecip.reduce((a, b) => a + b, 0);
      const avgTemp = allT2m.length ? allT2m.reduce((a, b) => a + b, 0) / allT2m.length : null;
      const maxTemp = allTmax.length ? Math.max(...allTmax) : null;
      const minTemp = allTmin.length ? Math.min(...allTmin) : null;
      const diasSemChuva = allPrecip.filter((v) => v < 1).length;
      const diasChuvaIntensa = allPrecip.filter((v) => v > 30).length;
      const diasGeada = allTmin.filter((v) => v <= 0).length;
      const diasAcima35 = allTmax.filter((v) => v >= 35).length;

      const summary = {
        precipitacao_total_mm: Math.round(totalPrecip * 10) / 10,
        temperatura_media_c: avgTemp ? Math.round(avgTemp * 10) / 10 : null,
        temperatura_maxima_c: maxTemp ? Math.round(maxTemp * 10) / 10 : null,
        temperatura_minima_c: minTemp ? Math.round(minTemp * 10) / 10 : null,
        dias_sem_chuva: diasSemChuva,
        dias_chuva_intensa: diasChuvaIntensa,
        dias_geada: diasGeada,
        dias_acima_35c: diasAcima35,
        total_dias: allPrecip.length,
      };

      return new Response(JSON.stringify({ summary, monthly: monthlyData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────
    // ACTION: analyze_climate — AI analysis
    // ──────────────────────────────────────────────
    if (action === "analyze_climate") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

      // Build context from satellite data if provided
      const satelliteContext = arguments?.length ? "" : "";
      const extraContext = req.headers.get("x-satellite-data") || "";

      const prompt = `Você é um meteorologista agrícola brasileiro especialista em dados climáticos do INMET e NASA POWER.

Com base em seu conhecimento sobre o clima da região de ${municipio || "não especificado"}-${uf || "BR"}, 
para o período de ${dataInicio || "últimos 12 meses"} a ${dataFim || "hoje"},
${extraContext ? `\nDados satelitais NASA POWER coletados:\n${extraContext}\n` : ""}
forneça uma análise climática completa no seguinte formato JSON:

{
  "precipitacao_media_historica_mm": <número da média histórica anual ou do período>,
  "eventos_extremos": ["lista de eventos climáticos relevantes ocorridos ou típicos da região no período"],
  "analise_textual": "Texto técnico de 3-4 parágrafos analisando: 1) Regime pluviométrico da região e comparação com a média histórica, 2) Temperaturas e seus impactos na agricultura, 3) Balanço hídrico e déficit/excesso, 4) Conclusão sobre aptidão climática e riscos. Mencione dados específicos.",
  "classificacao_risco": "normal|atenção|crítico",
  "deficit_hidrico_mm": <número estimado se aplicável, ou null>,
  "balanco_hidrico_mensal": "Texto descritivo sobre o balanço hídrico mês a mês",
  "recomendacoes_laudo": "Texto com recomendações técnicas para uso em laudo agrícola"
}

IMPORTANTE: Forneça APENAS o JSON, sem markdown ou texto adicional.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você é um meteorologista agrícola brasileiro. Responda APENAS com JSON válido." },
            { role: "user", content: prompt },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Erro no gateway de IA");
      }

      const result = await response.json();
      let content = result.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { analise_textual: content, classificacao_risco: "normal" };
      }

      return new Response(JSON.stringify({ analysis: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação não reconhecida");
  } catch (e) {
    console.error("dados-climaticos error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
