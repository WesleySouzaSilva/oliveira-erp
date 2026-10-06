import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// URLs de scraping para cada fonte
const FONTES: Record<string, { url: string; descricao: string }> = {
  cepea_soja: {
    url: "https://www.cepea.esalq.usp.br/br/indicador/soja.aspx",
    descricao: "CEPEA/Esalq — Indicador Soja",
  },
  cepea_milho: {
    url: "https://www.cepea.esalq.usp.br/br/indicador/milho.aspx",
    descricao: "CEPEA/Esalq — Indicador Milho",
  },
  cepea_trigo: {
    url: "https://www.cepea.esalq.usp.br/br/indicador/trigo.aspx",
    descricao: "CEPEA/Esalq — Indicador Trigo",
  },
  cepea_arroz: {
    url: "https://www.cepea.esalq.usp.br/br/indicador/arroz.aspx",
    descricao: "CEPEA/Esalq — Indicador Arroz",
  },
  cepea_cafe: {
    url: "https://www.cepea.esalq.usp.br/br/indicador/cafe.aspx",
    descricao: "CEPEA/Esalq — Indicador Café",
  },
  cepea_algodao: {
    url: "https://www.cepea.esalq.usp.br/br/indicador/algodao.aspx",
    descricao: "CEPEA/Esalq — Indicador Algodão",
  },
  noticias_agricolas: {
    url: "https://www.noticiasagricolas.com.br/cotacoes",
    descricao: "Notícias Agrícolas — Cotações",
  },
  agrolink: {
    url: "https://www.agrolink.com.br/cotacoes/graos",
    descricao: "Agrolink — Cotações de Grãos",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Exige usuário autenticado (a função consome créditos do Firecrawl)
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: authData } = token
      ? await authClient.auth.getUser(token)
      : { data: { user: null } };
    if (!authData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cultura, fontes: fontesParam } = await req.json();

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY não configurada. Conecte o Firecrawl nas configurações.");
    }

    // Determinar quais fontes buscar
    let fontesParaBuscar: string[] = [];

    if (Array.isArray(fontesParam) && fontesParam.length > 0) {
      fontesParaBuscar = fontesParam;
    } else if (cultura) {
      const culturaNorm = cultura.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Sempre incluir notícias e agrolink
      fontesParaBuscar = ["noticias_agricolas", "agrolink"];

      if (culturaNorm.includes("soja")) fontesParaBuscar.push("cepea_soja");
      else if (culturaNorm.includes("milho")) fontesParaBuscar.push("cepea_milho");
      else if (culturaNorm.includes("trigo")) fontesParaBuscar.push("cepea_trigo");
      else if (culturaNorm.includes("arroz")) fontesParaBuscar.push("cepea_arroz");
      else if (culturaNorm.includes("cafe")) fontesParaBuscar.push("cepea_cafe");
      else if (culturaNorm.includes("algod")) fontesParaBuscar.push("cepea_algodao");
      else fontesParaBuscar.push("cepea_soja", "cepea_milho"); // default
    } else {
      fontesParaBuscar = ["cepea_soja", "cepea_milho", "noticias_agricolas"];
    }

    // Scrape em paralelo via Firecrawl
    const results: Record<string, any> = {};
    const promises = fontesParaBuscar.map(async (fonteKey) => {
      const fonte = FONTES[fonteKey];
      if (!fonte) return { key: fonteKey, error: "Fonte não encontrada" };

      try {
        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: fonte.url,
            formats: ["markdown"],
            onlyMainContent: true,
            waitFor: 3000,
          }),
        });

        if (!response.ok) {
          const errData = await response.text();
          console.error(`Firecrawl error for ${fonteKey}:`, response.status, errData);
          return { key: fonteKey, error: `HTTP ${response.status}`, descricao: fonte.descricao };
        }

        const data = await response.json();
        const markdown = data?.data?.markdown || data?.markdown || "";
        const metadata = data?.data?.metadata || data?.metadata || {};

        return {
          key: fonteKey,
          descricao: fonte.descricao,
          url: fonte.url,
          titulo: metadata.title || fonte.descricao,
          conteudo: markdown.substring(0, 3000), // Limitar tamanho
          extraido_em: new Date().toISOString(),
        };
      } catch (e: any) {
        console.error(`Scrape error for ${fonteKey}:`, e);
        return { key: fonteKey, error: e.message, descricao: fonte.descricao };
      }
    });

    const responses = await Promise.all(promises);
    for (const r of responses) {
      results[r.key] = r;
    }

    // Buscar notícias via search (mais relevantes para a cultura)
    let noticias: any[] = [];
    try {
      const searchQuery = `${cultura || "soja milho"} safra preço ${new Date().getFullYear()} Brasil`;
      const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 5,
          lang: "pt",
          country: "BR",
          tbs: "qdr:m", // último mês
        }),
      });

      if (searchResp.ok) {
        const searchData = await searchResp.json();
        noticias = (searchData?.data || []).map((r: any) => ({
          titulo: r.title,
          url: r.url,
          descricao: r.description || "",
        }));
      }
    } catch (e) {
      console.log("Search news failed:", e);
    }

    return new Response(JSON.stringify({
      success: true,
      cultura: cultura || "geral",
      cotacoes: results,
      noticias_recentes: noticias,
      fontes_disponiveis: Object.fromEntries(
        Object.entries(FONTES).map(([k, v]) => [k, v.descricao])
      ),
      consultado_em: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("Scraping agro error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
