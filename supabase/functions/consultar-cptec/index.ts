import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { municipio, uf, dias } = await req.json();
    if (!municipio) throw new Error("Município é obrigatório");

    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

    const munNorm = normalize(municipio);

    // 1. Buscar código da cidade no CPTEC
    const searchUrl = `http://servicos.cptec.inpe.br/XML/listaCidades?city=${encodeURIComponent(municipio)}`;
    const searchResp = await fetch(searchUrl);
    const searchXml = await searchResp.text();

    // Parse XML simples para extrair cidades
    const cidadeRegex = /<cidade>[\s\S]*?<nome>(.*?)<\/nome>[\s\S]*?<uf>(.*?)<\/uf>[\s\S]*?<id>(\d+)<\/id>[\s\S]*?<\/cidade>/gi;
    let match;
    let cidadeId: string | null = null;
    let cidadeNome = "";

    while ((match = cidadeRegex.exec(searchXml)) !== null) {
      const nome = match[1];
      const cidUf = match[2];
      if (normalize(nome).includes(munNorm) || munNorm.includes(normalize(nome))) {
        if (!uf || cidUf.toUpperCase() === uf.toUpperCase()) {
          cidadeId = match[3];
          cidadeNome = nome;
          break;
        }
      }
    }

    if (!cidadeId) {
      return new Response(JSON.stringify({
        success: true,
        fonte: "CPTEC/INPE",
        municipio,
        previsao: [],
        mensagem: "Município não encontrado na base do CPTEC. Tente com o nome oficial.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Buscar previsão (7 dias por padrão)
    const numDias = dias || 7;
    const previsaoUrl = `http://servicos.cptec.inpe.br/XML/cidade/${cidadeId}/previsao.xml`;
    const prevResp = await fetch(previsaoUrl);
    const prevXml = await prevResp.text();

    // Parse previsão
    const previsaoRegex = /<previsao>[\s\S]*?<dia>(.*?)<\/dia>[\s\S]*?<tempo>(.*?)<\/tempo>[\s\S]*?<maxima>(.*?)<\/maxima>[\s\S]*?<minima>(.*?)<\/minima>[\s\S]*?<iuv>(.*?)<\/iuv>[\s\S]*?<\/previsao>/gi;
    const previsoes: any[] = [];
    let prevMatch;

    const tempoDescricao: Record<string, string> = {
      ec: "Encoberto com Chuvas Isoladas", ci: "Chuvas Isoladas", c: "Chuva",
      in: "Instável", pp: "Poss. de Pancadas de Chuva", cm: "Chuva pela Manhã",
      cn: "Chuva à Noite", pt: "Pancadas de Chuva à Tarde",
      pm: "Pancadas de Chuva pela Manhã", np: "Nublado e Pancadas de Chuva",
      pc: "Pancadas de Chuva", pn: "Parcialmente Nublado",
      cv: "Chuvisco", ch: "Chuvoso", t: "Tempestade",
      ps: "Predomínio de Sol", e: "Encoberto", n: "Nublado",
      cl: "Céu Claro", nv: "Nevoeiro", g: "Geada",
      ne: "Neve", nd: "Não Definido", pnt: "Pancadas de Chuva à Noite",
      vn: "Variação de Nebulosidade",
    };

    while ((prevMatch = previsaoRegex.exec(prevXml)) !== null) {
      previsoes.push({
        data: prevMatch[1],
        tempo_sigla: prevMatch[2],
        tempo: tempoDescricao[prevMatch[2].toLowerCase()] || prevMatch[2],
        maxima: parseFloat(prevMatch[3]),
        minima: parseFloat(prevMatch[4]),
        iuv: parseFloat(prevMatch[5]),
      });
    }

    // 3. Buscar previsão estendida (14 dias) se disponível
    let previsaoEstendida: any[] = [];
    try {
      const extUrl = `http://servicos.cptec.inpe.br/XML/cidade/${cidadeId}/estendida.xml`;
      const extResp = await fetch(extUrl);
      const extXml = await extResp.text();
      let extMatch;
      while ((extMatch = previsaoRegex.exec(extXml)) !== null) {
        previsaoEstendida.push({
          data: extMatch[1],
          tempo_sigla: extMatch[2],
          tempo: tempoDescricao[extMatch[2].toLowerCase()] || extMatch[2],
          maxima: parseFloat(extMatch[3]),
          minima: parseFloat(extMatch[4]),
          iuv: parseFloat(extMatch[5]),
        });
      }
    } catch (_) { /* estendida pode não estar disponível */ }

    // Análise resumida
    const diasChuva = previsoes.filter(p =>
      ["c", "ci", "cm", "cn", "ch", "pc", "pt", "pm", "np", "pp", "t", "pnt", "in", "ec"].includes(p.tempo_sigla.toLowerCase())
    ).length;
    const geada = previsoes.some(p => p.tempo_sigla.toLowerCase() === "g" || p.minima <= 2);
    const maxTemp = Math.max(...previsoes.map(p => p.maxima).filter(Boolean));
    const minTemp = Math.min(...previsoes.map(p => p.minima).filter(Boolean));

    return new Response(JSON.stringify({
      success: true,
      fonte: "CPTEC/INPE",
      municipio: cidadeNome,
      uf: uf || "",
      cidade_id: cidadeId,
      previsao: previsoes,
      previsao_estendida: previsaoEstendida,
      analise: {
        dias_com_chuva: diasChuva,
        total_dias: previsoes.length,
        risco_geada: geada,
        temperatura_maxima: maxTemp,
        temperatura_minima: minTemp,
      },
      consultado_em: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("CPTEC error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
