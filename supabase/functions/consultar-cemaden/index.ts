import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { municipio, uf, codIbge, dataInicio, dataFim } = await req.json();

    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // 1. Buscar alertas ativos do CEMADEN
    let alertas: any[] = [];
    try {
      const alertUrl = "http://resources.cemaden.gov.br/graficos/json/alertas_municipios.json";
      const alertResp = await fetch(alertUrl, { headers: { "Accept": "application/json" } });
      if (alertResp.ok) {
        const alertData = await alertResp.json();
        const items = Array.isArray(alertData) ? alertData : (alertData?.features || []);

        const munNorm = normalize(municipio || "");
        const ufUp = (uf || "").toUpperCase();

        for (const item of items) {
          const props = item.properties || item;
          const nome = props.NOME || props.nome || props.municipio || "";
          const estado = (props.UF || props.uf || props.estado || "").toUpperCase();

          if (codIbge && (props.COD_IBGE === codIbge || props.geocodigo === codIbge)) {
            alertas.push({
              municipio: nome,
              uf: estado,
              nivel: props.NIVEL || props.nivel || props.alerta || "N/I",
              tipo: props.TIPO || props.tipo || "Hidrológico",
              data: props.DATA || props.data || null,
              populacao_risco: props.POP_RISCO || null,
            });
          } else if (normalize(nome).includes(munNorm) && (!uf || estado === ufUp)) {
            alertas.push({
              municipio: nome,
              uf: estado,
              nivel: props.NIVEL || props.nivel || props.alerta || "N/I",
              tipo: props.TIPO || props.tipo || "Hidrológico",
              data: props.DATA || props.data || null,
              populacao_risco: props.POP_RISCO || null,
            });
          }
        }
      }
    } catch (e) {
      console.log("CEMADEN alertas fetch failed:", e);
    }

    // 2. Buscar dados pluviométricos (últimas 24h/72h)
    let pluviometria: any[] = [];
    try {
      // API pública de dados pluviométricos
      const pluvUrl = `http://resources.cemaden.gov.br/graficos/json/pluviometria_municipios.json`;
      const pluvResp = await fetch(pluvUrl, { headers: { "Accept": "application/json" } });
      if (pluvResp.ok) {
        const pluvData = await pluvResp.json();
        const items = Array.isArray(pluvData) ? pluvData : (pluvData?.features || []);

        const munNorm = normalize(municipio || "");
        const ufUp = (uf || "").toUpperCase();

        for (const item of items) {
          const props = item.properties || item;
          const nome = props.NOME || props.nome || props.municipio || "";
          const estado = (props.UF || props.uf || "").toUpperCase();

          if (normalize(nome).includes(munNorm) && (!uf || estado === ufUp)) {
            pluviometria.push({
              municipio: nome,
              uf: estado,
              acumulado_1h: props.ACC_1H || props.chuva_1h || null,
              acumulado_3h: props.ACC_3H || props.chuva_3h || null,
              acumulado_6h: props.ACC_6H || props.chuva_6h || null,
              acumulado_12h: props.ACC_12H || props.chuva_12h || null,
              acumulado_24h: props.ACC_24H || props.chuva_24h || null,
              acumulado_72h: props.ACC_72H || props.chuva_72h || null,
              estacao: props.ESTACAO || props.nome_estacao || null,
            });
          }
        }
      }
    } catch (e) {
      console.log("CEMADEN pluviometria fetch failed:", e);
    }

    // 3. Buscar áreas de risco monitoradas
    let areasRisco: any[] = [];
    try {
      const riskUrl = "http://resources.cemaden.gov.br/graficos/json/setores_risco.json";
      const riskResp = await fetch(riskUrl, { headers: { "Accept": "application/json" } });
      if (riskResp.ok) {
        const riskData = await riskResp.json();
        const items = Array.isArray(riskData) ? riskData : (riskData?.features || []);

        const munNorm = normalize(municipio || "");
        for (const item of items) {
          const props = item.properties || item;
          const nome = props.NOME_MUN || props.municipio || "";
          if (normalize(nome).includes(munNorm)) {
            areasRisco.push({
              setor: props.NOME_SETOR || props.setor || "N/I",
              tipo_risco: props.TIPO_RISCO || props.tipo || "N/I",
              nivel: props.NIVEL || "N/I",
            });
          }
        }
      }
    } catch (e) {
      console.log("CEMADEN áreas de risco fetch failed:", e);
    }

    const temAlerta = alertas.length > 0;
    const nivelMaximo = alertas.reduce((max, a) => {
      const niveis: Record<string, number> = { verde: 0, amarelo: 1, laranja: 2, vermelho: 3 };
      const n = niveis[(a.nivel || "").toLowerCase()] || 0;
      return n > max ? n : max;
    }, 0);
    const nivelLabels = ["Verde (Normal)", "Amarelo (Atenção)", "Laranja (Alerta)", "Vermelho (Alerta Máximo)"];

    return new Response(JSON.stringify({
      success: true,
      fonte: "CEMADEN - Centro Nacional de Monitoramento e Alertas de Desastres Naturais",
      municipio: municipio || "",
      uf: uf || "",
      alertas,
      pluviometria,
      areas_risco: areasRisco,
      resumo: {
        tem_alerta_ativo: temAlerta,
        nivel_maximo: nivelLabels[nivelMaximo],
        total_estacoes_pluviometricas: pluviometria.length,
        total_areas_risco: areasRisco.length,
      },
      consultado_em: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("CEMADEN error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
