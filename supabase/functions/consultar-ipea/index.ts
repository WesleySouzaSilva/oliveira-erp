import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Séries relevantes do IPEA para laudos agrícolas
const SERIES_IPEA: Record<string, { codigo: string; descricao: string; unidade: string }> = {
  pib_agro: { codigo: "SCN104_PIBPMAGR104", descricao: "PIB Agropecuário", unidade: "R$ milhões" },
  credito_rural: { codigo: "BM12_CRLINPC12", descricao: "Crédito Rural (deflacionado INPC)", unidade: "R$ milhões" },
  preco_soja: { codigo: "GAC12_SOJAM12", descricao: "Preço Soja (Paraná)", unidade: "R$/60kg" },
  preco_milho: { codigo: "GAC12_MILHOM12", descricao: "Preço Milho (Paraná)", unidade: "R$/60kg" },
  preco_trigo: { codigo: "GAC12_TRIGOM12", descricao: "Preço Trigo (Paraná)", unidade: "R$/60kg" },
  preco_arroz: { codigo: "GAC12_ARROZM12", descricao: "Preço Arroz (RS)", unidade: "R$/50kg" },
  preco_cafe: { codigo: "GAC12_CAFEM12", descricao: "Preço Café (São Paulo)", unidade: "R$/60kg" },
  preco_algodao: { codigo: "GAC12_ALGM12", descricao: "Preço Algodão", unidade: "R$/15kg" },
  inpc_alimentos: { codigo: "PRECOS12_INPCALI12", descricao: "INPC Alimentação", unidade: "%" },
  cambio: { codigo: "GM366_ERV366", descricao: "Taxa de Câmbio (venda)", unidade: "R$/US$" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { series, cultura, ultimos } = await req.json();

    // Determinar quais séries buscar
    let seriesBuscar: string[] = [];

    if (Array.isArray(series) && series.length > 0) {
      seriesBuscar = series;
    } else if (cultura) {
      // Auto-selecionar séries com base na cultura
      const culturaNorm = cultura.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      seriesBuscar = ["cambio", "credito_rural"];

      if (culturaNorm.includes("soja")) seriesBuscar.push("preco_soja");
      if (culturaNorm.includes("milho")) seriesBuscar.push("preco_milho");
      if (culturaNorm.includes("trigo")) seriesBuscar.push("preco_trigo");
      if (culturaNorm.includes("arroz")) seriesBuscar.push("preco_arroz");
      if (culturaNorm.includes("cafe")) seriesBuscar.push("preco_cafe");
      if (culturaNorm.includes("algod")) seriesBuscar.push("preco_algodao");

      // Se nenhum preço específico, buscar soja e milho (principais)
      if (seriesBuscar.length === 2) {
        seriesBuscar.push("preco_soja", "preco_milho");
      }
    } else {
      seriesBuscar = ["preco_soja", "preco_milho", "cambio", "credito_rural"];
    }

    const numRegistros = ultimos || 12;
    const results: Record<string, any> = {};

    // Buscar séries em paralelo
    const promises = seriesBuscar.map(async (key) => {
      const serieInfo = SERIES_IPEA[key];
      if (!serieInfo) return { key, data: [], error: `Série ${key} não encontrada` };

      try {
        const url = `http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='${serieInfo.codigo}')`;
        const resp = await fetch(url, {
          headers: { "Accept": "application/json" },
        });

        if (!resp.ok) {
          console.error(`IPEA error for ${key}: ${resp.status}`);
          return { key, data: [], error: `HTTP ${resp.status}` };
        }

        const json = await resp.json();
        const values = (json.value || [])
          .sort((a: any, b: any) => (b.VALDATA || "").localeCompare(a.VALDATA || ""))
          .slice(0, numRegistros)
          .reverse()
          .map((v: any) => ({
            data: v.VALDATA ? v.VALDATA.split("T")[0] : null,
            valor: v.VALVALOR,
          }));

        return { key, data: values, descricao: serieInfo.descricao, unidade: serieInfo.unidade };
      } catch (e: any) {
        console.error(`IPEA fetch error for ${key}:`, e);
        return { key, data: [], error: e.message };
      }
    });

    const responses = await Promise.all(promises);
    for (const r of responses) {
      results[r.key] = {
        descricao: r.descricao || SERIES_IPEA[r.key]?.descricao || r.key,
        unidade: r.unidade || SERIES_IPEA[r.key]?.unidade || "",
        dados: r.data,
        error: r.error || null,
      };
    }

    // Calcular variações para análise
    const analise: Record<string, any> = {};
    for (const [key, val] of Object.entries(results)) {
      const dados = (val as any).dados || [];
      if (dados.length >= 2) {
        const ultimo = dados[dados.length - 1]?.valor;
        const penultimo = dados[dados.length - 2]?.valor;
        const primeiro = dados[0]?.valor;

        if (ultimo != null && penultimo != null && penultimo !== 0) {
          analise[key] = {
            valor_atual: ultimo,
            variacao_mensal: ((ultimo - penultimo) / penultimo * 100).toFixed(2) + "%",
            variacao_periodo: primeiro && primeiro !== 0
              ? ((ultimo - primeiro) / primeiro * 100).toFixed(2) + "%"
              : null,
            tendencia: ultimo > penultimo ? "alta" : ultimo < penultimo ? "baixa" : "estável",
          };
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      fonte: "IPEA - Instituto de Pesquisa Econômica Aplicada",
      series: results,
      analise,
      series_disponiveis: Object.fromEntries(
        Object.entries(SERIES_IPEA).map(([k, v]) => [k, v.descricao])
      ),
      consultado_em: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("IPEA error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
