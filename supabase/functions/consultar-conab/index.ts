import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CONAB public data scraping for agricultural commodity prices
// Source: portaldeinformacoes.conab.gov.br
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { produto, uf, municipio } = await req.json();

    // Map common product names to CONAB identifiers
    const produtoMap: Record<string, string> = {
      soja: "soja",
      milho: "milho",
      arroz: "arroz",
      feijao: "feijão",
      trigo: "trigo",
      cafe: "café",
      algodao: "algodão",
      cana: "cana-de-açúcar",
      sorgo: "sorgo",
      mandioca: "mandioca",
    };

    const produtoNorm = produto?.toLowerCase()?.normalize("NFD")?.replace(/[\u0300-\u036f]/g, "") || "soja";
    const produtoConab = produtoMap[produtoNorm] || produto || "soja";

    // Try fetching from CONAB's public price consultation
    // The portal uses a specific API endpoint
    const conabUrl = `https://consultaprecosdemercado.conab.gov.br/api/precos-mercado/precos?produto=${encodeURIComponent(produtoConab)}`;
    
    let precos: any[] = [];
    let fonte = "CONAB";

    try {
      const response = await fetch(conabUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "LaudoAgro/1.0",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        precos = Array.isArray(data) ? data.slice(0, 20) : [];
      }
    } catch (e) {
      console.log("CONAB API direct failed, trying alternative...");
    }

    // If direct API fails, try the download CSV endpoint
    if (precos.length === 0) {
      try {
        const csvUrl = `https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecosMedioMensal_UF.csv`;
        const csvResponse = await fetch(csvUrl);
        if (csvResponse.ok) {
          const csvText = await csvResponse.text();
          const lines = csvText.split(/\r?\n/).filter((l: string) => l.trim());
          if (lines.length > 1) {
            const headers = lines[0].split(";").map((h: string) => h.trim().toLowerCase());
            const produtoIdx = headers.findIndex((h: string) => h.includes("produto"));
            const ufIdx = headers.findIndex((h: string) => h.includes("uf") || h.includes("estado"));
            const precoIdx = headers.findIndex((h: string) => h.includes("preco") || h.includes("preço") || h.includes("valor"));
            const dataIdx = headers.findIndex((h: string) => h.includes("data") || h.includes("mes") || h.includes("mês"));

            for (let i = 1; i < Math.min(lines.length, 500); i++) {
              const cols = lines[i].split(";").map((c: string) => c.trim());
              const produtoCol = produtoIdx >= 0 ? cols[produtoIdx]?.toLowerCase() : "";
              const ufCol = ufIdx >= 0 ? cols[ufIdx] : "";

              if (produtoCol.includes(produtoNorm) && (!uf || ufCol?.toUpperCase() === uf?.toUpperCase())) {
                precos.push({
                  produto: cols[produtoIdx] || produtoConab,
                  uf: cols[ufIdx] || uf,
                  preco: precoIdx >= 0 ? cols[precoIdx] : null,
                  data: dataIdx >= 0 ? cols[dataIdx] : null,
                });
              }
              if (precos.length >= 12) break;
            }
          }
          fonte = "CONAB (CSV)";
        }
      } catch (e) {
        console.log("CONAB CSV download failed:", e);
      }
    }

    // Fallback: provide reference prices from known sources
    if (precos.length === 0) {
      precos = [
        {
          produto: produtoConab,
          mensagem: "Não foi possível obter preços automaticamente da CONAB. Consulte manualmente em: https://portaldeinformacoes.conab.gov.br/precos-agropecuarios.html",
          uf: uf || "Todas",
        },
      ];
      fonte = "CONAB (referência manual)";
    }

    return new Response(
      JSON.stringify({
        success: true,
        fonte,
        produto: produtoConab,
        uf: uf || "Todas",
        precos,
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
