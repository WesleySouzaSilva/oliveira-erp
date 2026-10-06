import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims, error: claimsErr } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "analyze_documents") {
      systemPrompt = `Você é um engenheiro agrônomo especialista em laudos técnicos para prorrogação de dívida rural (MCR 2.6.4). 
Analise os documentos fornecidos e extraia informações relevantes para preencher o laudo.
Retorne um JSON estruturado com os campos encontrados.`;
      userPrompt = `Documentos enviados: ${JSON.stringify(context.documentos || [])}
Dados já preenchidos: ${JSON.stringify(context.dadosAtuais || {})}

Extraia e sugira dados para preencher as etapas do laudo: produtor, propriedade, financiamento, safra e capacidade de pagamento.`;
    } else if (action === "generate_narrative") {
      const hipLabels: Record<string, string> = {
        a: "Dificuldade de comercialização",
        b: "Frustração de safra por adversidade climática",
        c: "Pragas, doenças ou outros fatores prejudiciais",
        d: "Dificuldades de fluxo de caixa",
      };
      const culturas = context.cultura ? context.cultura.split(",").map((c: string) => c.trim()).filter(Boolean) : [];
      const hipoteses = context.hipoteses || [];
      const adversidade = hipoteses.includes("b") ? "SECA" : hipoteses.includes("a") ? "DIFICULDADE MERCADOLÓGICA" : hipoteses.includes("c") ? "PRAGAS/DOENÇAS" : "ADVERSIDADE";

      systemPrompt = `Você é um engenheiro agrônomo perito judicial especializado em laudos técnicos de prorrogação de dívida rural (MCR 2.6.4).
Gere um LAUDO DE PERDA completo e detalhado. Use linguagem técnica formal jurídica: "atesto que", "depreende-se que", "outrossim", "destarte", "é irrefutável".
Cada seção deve ter pelo menos 3-4 parágrafos densos e bem fundamentados.`;

      userPrompt = `Dados do laudo:
- Produtor: ${context.produtor || "N/I"}
- Propriedade: ${context.propriedade || "N/I"} em ${context.municipio || "N/I"}-${context.uf || "N/I"}
- Culturas: ${culturas.join(", ") || "N/I"} | Safra: ${context.safra || "N/I"}
- Área cultivada: ${context.areaCultivada || "N/I"} ha
- Produtividade esperada: ${context.produtividadeEsperada || "N/I"} sc/ha
- Produtividade realizada: ${context.produtividadeRealizada || "N/I"} sc/ha
- Média histórica: ${context.mediaHistorica || "N/I"} sc/ha
- Receita bruta: R$ ${context.receitaBruta || "N/I"}
- Custo total: R$ ${context.custoTotal || "N/I"}
- Saldo devedor: R$ ${context.saldoDevedor || "N/I"}
- Hipóteses MCR: ${hipoteses.map((h: string) => `${h} - ${hipLabels[h] || h}`).join("; ") || "Nenhuma"}
- Justificativa: ${context.justificativa || "N/I"}

Gere EXATAMENTE nesta estrutura:

# INTRODUÇÃO - AGRICULTURA
Contextualização geral da agricultura e importância das culturas ${culturas.join(" e ") || "cultivadas"}.

${culturas.map((c: string) => `# CULTURA DO(A) ${c.toUpperCase()} - SAFRA ${context.safra || "N/I"} - ${adversidade}
Análise técnica detalhada dos impactos na cultura ${c}. Mínimo 4 parágrafos com dados técnicos.`).join("\n\n")}

${hipoteses.includes("c") ? `# CUSTOS DE PRODUÇÃO
Análise do aumento dos custos de produção em decorrência de pragas/doenças.` : ""}

${hipoteses.includes("a") ? `# QUEDA DE PREÇO E DESVALORIZAÇÃO
Análise da queda de preços de mercado e impacto na rentabilidade do produtor.` : ""}

Gere APENAS a narrativa, SEM conclusão.`;
    } else if (action === "generate_conclusion") {
      systemPrompt = `Você é um engenheiro agrônomo. Gere uma conclusão técnica formal para um laudo de prorrogação de dívida rural (MCR 2.6.4).
A conclusão deve ser objetiva, citar a(s) hipótese(s) aplicável(is) e recomendar a prorrogação com base nos dados técnicos.`;
      userPrompt = `Dados resumidos:
- Produtor: ${context.produtor || "N/I"}
- Cultura: ${context.cultura || "N/I"} | Safra: ${context.safra || "N/I"}
- Hipóteses: ${(context.hipoteses || []).join(", ")}
- Resultado operacional indica ${context.podeQuitar ? "capacidade" : "incapacidade"} de pagamento.

Gere a conclusão do laudo.`;
    } else if (action === "merge_conclusions") {
      systemPrompt = `Você é um engenheiro agrônomo especialista em laudos de prorrogação de dívida rural (MCR 2.6.4).
Receba múltiplos textos de conclusão (templates) e unifique-os em um único texto coeso, formal e técnico.
Elimine redundâncias, mantenha todos os fundamentos jurídicos e técnicos, e produza um texto fluido e profissional.`;
      userPrompt = `Templates selecionados para unificação:

${(context.textos || []).map((t: string, i: number) => `--- Template ${i + 1} ---\n${t}`).join("\n\n")}

Dados do laudo:
- Produtor: ${context.produtor || "N/I"}
- Cultura(s): ${context.cultura || "N/I"}
- Safra: ${context.safra || "N/I"}
- Hipóteses MCR: ${(context.hipoteses || []).join(", ") || "Nenhuma"}

Gere uma conclusão unificada, coesa e tecnicamente fundamentada.`;
    } else if (action === "search_news") {
      systemPrompt = `Você é um pesquisador agrícola. Busque e liste notícias reais e relevantes sobre perdas agrícolas, adversidades climáticas e dificuldades de comercialização.
Formate CADA notícia assim:
1. Título: [título da notícia]
Fonte: [nome do veículo]
URL: [link se disponível]
Resumo: [breve descrição]

Liste de 3 a 5 notícias reais e relevantes. Se não encontrar notícias específicas, cite matérias genéricas sobre a situação agrícola na região/safra.`;
      userPrompt = `Busque notícias relevantes sobre perdas de safra e adversidades agrícolas para:
- Município: ${context.municipio || "N/I"}
- UF: ${context.uf || "N/I"}
- Cultura: ${context.cultura || "N/I"}
- Safra: ${context.safra || "N/I"}

Foque em notícias sobre: seca, estiagem, geada, granizo, queda de preços, pragas, perdas de produtividade na região.`;
    } else if (action === "search_decrees") {
      systemPrompt = `Você é um pesquisador jurídico especializado em direito agrário e calamidades públicas. Busque decretos de emergência, situação de emergência ou estado de calamidade pública relacionados ao município e estado informados.
Formate CADA decreto assim:
1. Decreto: [número e descrição]
Órgão: [quem emitiu]
Data: [data de publicação]
URL: [link do S2ID, DOU ou portal oficial se disponível]

Liste decretos relevantes. Busque no S2ID (https://s2id.mi.gov.br), Diário Oficial da União e portais estaduais.`;
      userPrompt = `Busque decretos de emergência ou calamidade pública para:
- Município: ${context.municipio || "N/I"}
- UF: ${context.uf || "N/I"}
- Safra/Período: ${context.safra || "N/I"}

Foque em decretos relacionados a: seca, estiagem, enchente, granizo ou outras adversidades climáticas que afetem a produção agrícola.`;
    } else if (action === "generate_notification") {
      const hipLabels: Record<string, string> = {
        a: "Dificuldade de comercialização do produto",
        b: "Frustração de safra por adversidade climática",
        c: "Pragas, doenças ou outros fatores prejudiciais",
        d: "Dificuldades de fluxo de caixa",
      };
      const hipoteses = context.hipoteses || [];
      const contratos = context.contratos || [];

      systemPrompt = `Você é um advogado especialista em direito agrário e bancário. Gere uma NOTIFICAÇÃO EXTRAJUDICIAL completa e profissional para solicitar a prorrogação de dívida rural, conforme o Manual de Crédito Rural (MCR), especificamente o item 2.6.4.

A notificação deve:
1. Ser formal, com linguagem jurídica técnica
2. Citar a fundamentação legal: MCR 2.6.4, Lei 8.171/91, Lei 13.340/2016, Súmula 298 do STJ
3. Indicar claramente o pedido de prorrogação
4. Fazer referência ao laudo técnico agronômico que fundamenta o pedido
5. Estabelecer prazo de 15 dias úteis para resposta
6. Mencionar que o silêncio será interpretado como elemento probatório favorável ao produtor em eventual ação judicial

Formato:
- Cabeçalho com destinatário (banco), remetente (produtor), data
- "DO:" com dados do produtor
- "AO:" com dados do banco
- Corpo da notificação com seções numeradas
- Pedidos ao final
- Local, data e espaço para assinatura`;

      userPrompt = `Gere a notificação extrajudicial com os seguintes dados:

PRODUTOR/NOTIFICANTE:
- Nome: ${context.produtor || "N/I"}
- Município: ${context.municipio || "N/I"}-${context.uf || "N/I"}

BANCO/NOTIFICADO:
- Instituição: ${context.banco || "N/I"}
- Contrato(s): ${contratos.join(", ") || "N/I"}
- Saldo devedor total: R$ ${context.saldoDevedor || "N/I"}

DADOS DO LAUDO TÉCNICO:
- Cultura(s): ${context.cultura || "N/I"}
- Safra: ${context.safra || "N/I"}
- Score de enquadramento: ${context.scoreEnquadramento || "N/I"}/100
- Hipóteses MCR aplicáveis: ${hipoteses.map((h: string) => `Alínea "${h}" - ${hipLabels[h] || h}`).join("; ") || "Nenhuma"}
- Prazo solicitado: ${context.prazoSolicitado || "36"} meses

${context.textoNarrativa ? `RESUMO DO LAUDO:\n${context.textoNarrativa.substring(0, 1000)}` : ""}

Gere a notificação completa.`;
    } else {
      throw new Error("Ação não reconhecida: " + action);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Erro no gateway de IA");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-laudo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
