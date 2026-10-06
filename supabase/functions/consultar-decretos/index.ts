import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Consulta decretos de calamidade/emergência via S2ID (Defesa Civil) e fontes públicas
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { municipio, uf, ano } = await req.json();

    if (!municipio && !uf) {
      throw new Error("Informe ao menos o município ou UF");
    }

    const resultados: any[] = [];
    const anoConsulta = ano || new Date().getFullYear();

    // 1. Try S2ID public data (Defesa Civil Nacional)
    // S2ID provides a public summary page with disaster info
    try {
      const s2idUrl = `https://s2id.mi.gov.br/paginas/atlas/`;
      const response = await fetch(s2idUrl, {
        headers: { "User-Agent": "LaudoAgro/1.0" },
      });
      if (response.ok) {
        // S2ID doesn't have a public JSON API, but we can note the reference
        resultados.push({
          fonte: "S2ID - Sistema Integrado de Informações sobre Desastres",
          tipo: "referencia",
          url: `https://s2id.mi.gov.br/paginas/atlas/`,
          descricao: `Consulte o Atlas Digital de Desastres do S2ID para ${municipio || ""} - ${uf || ""}. O S2ID é a fonte oficial do governo federal para decretos de emergência e calamidade pública.`,
        });
      }
      await response.text(); // consume body
    } catch (e) {
      console.log("S2ID fetch failed:", e);
    }

    // 2. Try Diário Oficial da União (DOU) search for calamity decrees
    try {
      const searchTerm = encodeURIComponent(
        `decreto ${municipio ? `"${municipio}"` : ""} ${uf || ""} calamidade OR emergência ${anoConsulta}`
      );
      const douUrl = `https://www.in.gov.br/servicos/diario-oficial-da-uniao/pesquisa?q=${searchTerm}`;
      
      resultados.push({
        fonte: "Diário Oficial da União (DOU)",
        tipo: "referencia",
        url: douUrl,
        descricao: `Busca no DOU por decretos de calamidade/emergência para ${municipio || "todos municípios"} - ${uf || ""}`,
      });
    } catch (e) {
      console.log("DOU search failed:", e);
    }

    // 3. Search for municipal decree via Google-like search
    try {
      const searchQuery = encodeURIComponent(
        `decreto calamidade pública ${municipio || ""} ${uf || ""} ${anoConsulta} site:gov.br OR site:diariooficial`
      );
      
      resultados.push({
        fonte: "Busca em portais governamentais",
        tipo: "referencia",
        url: `https://www.google.com/search?q=${searchQuery}`,
        descricao: `Pesquisa em portais oficiais por decretos de emergência/calamidade para ${municipio || ""} - ${uf || ""}`,
      });
    } catch (e) {
      console.log("Search failed:", e);
    }

    // 4. Add IBGE disaster data reference
    resultados.push({
      fonte: "IBGE - Perfil dos Municípios Brasileiros (MUNIC)",
      tipo: "referencia", 
      url: "https://www.ibge.gov.br/estatisticas/sociais/saude/10586-pesquisa-de-informacoes-basicas-municipais.html",
      descricao: "Base de dados do IBGE com informações sobre desastres e calamidades por município.",
    });

    // 5. Add Defesa Civil state reference
    if (uf) {
      const defesaCivilUFs: Record<string, string> = {
        RS: "https://www.defesacivil.rs.gov.br",
        SC: "https://www.defesacivil.sc.gov.br",
        PR: "https://www.defesacivil.pr.gov.br",
        SP: "https://www.defesacivil.sp.gov.br",
        MG: "https://www.defesacivil.mg.gov.br",
        RJ: "https://www.defesacivil.rj.gov.br",
        BA: "https://www.defesacivil.ba.gov.br",
        GO: "https://www.defesacivil.go.gov.br",
        MT: "https://www.defesacivil.mt.gov.br",
        MS: "https://www.defesacivil.ms.gov.br",
      };
      
      const defesaUrl = defesaCivilUFs[uf.toUpperCase()];
      if (defesaUrl) {
        resultados.push({
          fonte: `Defesa Civil do ${uf.toUpperCase()}`,
          tipo: "referencia",
          url: defesaUrl,
          descricao: `Portal da Defesa Civil estadual do ${uf.toUpperCase()} com informações sobre decretos de emergência.`,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        municipio: municipio || null,
        uf: uf || null,
        ano: anoConsulta,
        total_resultados: resultados.length,
        resultados,
        nota: "Os dados de decretos de calamidade pública não possuem API pública unificada. As referências abaixo direcionam às fontes oficiais para consulta manual.",
        consultado_em: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
