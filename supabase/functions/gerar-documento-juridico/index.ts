import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const { tipo, laudo_dados, numero_laudo, hipoteses, perfil } = await req.json();

    if (!tipo || !laudo_dados) {
      return new Response(
        JSON.stringify({ error: "Tipo e dados do laudo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const produtor = laudo_dados.nome || "___";
    const cpf = laudo_dados.cpf || laudo_dados.documento || "___";
    const banco = laudo_dados.banco || laudo_dados.contratos?.[0]?.banco || "___";
    const cultura = laudo_dados.cultura || (laudo_dados.culturas || []).join(", ") || "___";
    const safra = laudo_dados.safra || "___";
    const municipio = laudo_dados.municipio || "___";
    const uf = laudo_dados.uf || "___";
    const evento = laudo_dados.evento_climatico || "seca prolongada / déficit hídrico";
    const agronomo = perfil?.nome || "___";
    const crea = perfil?.crea || perfil?.crea_numero || "___";
    const creaUf = perfil?.crea_uf || perfil?.uf || "___";
    const advogado = perfil?.advogado_nome || "___";
    const oab = perfil?.oab || "___";
    const cidade = perfil?.cidade || "___";
    const ufCidade = perfil?.uf || "___";
    const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const nomePropriedade = laudo_dados.nomePropriedade || "___";
    const areaTotal = laudo_dados.areaTotal || "___";
    const areaCultivada = laudo_dados.areaCultivada || "___";

    // Build contracts table
    const contratos = laudo_dados.contratos || [];
    let contratosTexto = "";
    if (contratos.length > 0) {
      contratosTexto = contratos.map((c: any, i: number) => {
        return `Op. nº ${c.numero_contrato || c.numeroContrato || "N/I"} – valor de R$ ${c.valorOriginal || c.valor || "N/I"} – banco: ${c.banco || banco} – contratação: ${c.dataContratacao || "N/I"} – vencimento: ${c.dataVencimento || "N/I"}`;
      }).join(";\n");
    } else {
      contratosTexto = `Contrato nº ${laudo_dados.numero_contrato || "___"} – valor R$ ${laudo_dados.valor_operacao || "___"}`;
    }

    // Build loss data
    const perda = laudo_dados.perda_percentual || "___";
    const prodEsperada = laudo_dados.produtividadeEsperada || "___";
    const prodRealizada = laudo_dados.produtividadeRealizada || "___";
    const receitaBruta = laudo_dados.receitaBruta || "___";
    const custoTotal = laudo_dados.custoTotal || "___";
    const saldoDevedor = laudo_dados.saldoDevedor || "___";

    const hipotesesDescricoes: Record<string, string> = {
      "I": "dificuldade de comercialização dos produtos, evidenciada pela queda acentuada dos preços realizados",
      "II": "frustração de safras por fatores adversos, decorrente de eventos climáticos extremos (seca, déficit hídrico, excesso de chuvas, granizo, etc.)",
      "III": "eventuais ocorrências prejudiciais ao desenvolvimento das culturas e explorações, por períodos de grave desequilíbrio climático que comprometeram a atividade produtiva",
    };

    const hipotesesList = (hipoteses || []).map((h: string) => {
      const key = h.replace(/[^IViv]/g, "").toUpperCase();
      return `${h}. ${hipotesesDescricoes[key] || "conforme MCR 2.6.4"}`;
    });
    const hipotesesText = hipotesesList.length > 0
      ? hipotesesList.map((h: string, i: number) => `${i + 1}. ${h}`).join(";\n")
      : "1. dificuldade de comercialização dos produtos;\n2. frustração de safras por fatores adversos;\n3. eventuais ocorrências prejudiciais ao desenvolvimento das culturas e explorações.";

    let prompt = "";

    if (tipo === "notificacao") {
      prompt = `Você é um advogado agrarista brasileiro de alto nível, especialista em crédito rural e em pedidos administrativos de alongamento de dívida rural. Gere um PEDIDO ADMINISTRATIVO DE ALONGAMENTO DE DÍVIDA RURAL completo, profissional, denso e bem fundamentado, seguindo rigorosamente a estrutura e qualidade do modelo de referência abaixo.

O DOCUMENTO DEVE TER ENTRE 8 E 12 PÁGINAS DE CONTEÚDO DENSO. Não resuma, não abrevie. Cada seção deve ser extensa e profundamente fundamentada.

=== ESTRUTURA OBRIGATÓRIA DO DOCUMENTO ===

CABEÇALHO:
- Destinatário: AO ${banco}
- À Agência competente pelas operações em anexo
- Título: URGENTE. Pedido de Alongamento de dívida rural.
- Resumo inicial: "Operações de crédito rural em anexo. Capacidade de pagamento afetada. Necessidade de alteração cronograma de quitação de acordo com a nova capacidade de pagamento, conforme MCR 2.6.4 e Resoluções CMN 5.200/2025 e 5.220/2025."

QUALIFICAÇÃO DO REQUERENTE:
${produtor}, brasileiro, produtor agropecuário, residente e domiciliado em ${nomePropriedade}, Zona Rural, no Município de ${municipio}/${uf}, inscrito no CPF sob nº ${cpf}, por meio de seu advogado que esta subscreve (procuração anexa).

TÍTULO: PEDIDO ADMINISTRATIVO DE ALONGAMENTO DE DÍVIDA RURAL

Fundamento legal completo: Súmula 298 do STJ, MCR seção 2.6.4, Resoluções CMN nº 5.200/2025, 5.204/2025 e 5.220/2025, Medida Provisória nº 1.314/2025, Resolução CMN nº 5.247/2025, art. 13 do Decreto-Lei nº 167/1967, arts. 2º, 9º e 14 da Lei nº 4.829/1965, art. 48 da Lei nº 8.171/1991, art. 19 da Lei nº 4.595/1964, e arts. 23 VIII e 187 I e II da CF/1988.

=== SEÇÕES OBRIGATÓRIAS (desenvolva cada uma extensamente) ===

1. DOS CONTRATOS DE CRÉDITO RURAL
- Descreva o relacionamento do mutuário com a instituição
- Liste TODOS os contratos em formato tabular:
${contratosTexto}
- Explique a finalidade de cada operação (custeio, investimento, etc.)

2. MOTIVOS QUE AFETARAM A CAPACIDADE DE PAGAMENTO
- Referencie os laudos técnicos do engenheiro agrônomo ${agronomo} (CREA${creaUf}: ${crea}), número ${numero_laudo}
- Descreva detalhadamente o evento climático: ${evento}
- Para CADA cultura (${cultura}), crie subseções detalhando:
  * Produtividade esperada vs. realizada (${prodEsperada} vs ${prodRealizada})
  * Percentual de perda: ${perda}%
  * Impacto na receita bruta
  * Comparação com dados CONAB
  * Fatores agronômicos específicos afetados
- Conclua demonstrando que estão configuradas as hipóteses do MCR 2.6.4:
${hipotesesText}

3. DO DIREITO AO ALONGAMENTO DA DÍVIDA RURAL
- Desenvolva extensamente que o alongamento NÃO é liberalidade, mas DIREITO SUBJETIVO
- Cite literalmente a Súmula 298 do STJ
- Fundamente no MCR 2.6.4, explicando cada hipótese
- Cite arts. 23 VIII e 187 I e II da CF
- Cite Lei 4.829/1965, Decreto-Lei 167/1967 art. 13, Lei 8.171/1991 art. 48
- Cite as Resoluções CMN 5.200/2025, 5.204/2025, 5.220/2025
- Alerte sobre responsabilização do agente financeiro em caso de negativa

4. NOVA CAPACIDADE DE PAGAMENTO
- Referencie o MCR Cap. 2, Seção 6, Item 1 sobre cronograma de reembolso
- Subseção 4.1 - Estimativa Técnica de Recuperação:
  * Referencie o laudo de capacidade de pagamento
  * Receita bruta: R$ ${receitaBruta}
  * Custo total: R$ ${custoTotal}
  * Saldo devedor: R$ ${saldoDevedor}
  * Proponha prazo de carência e número de parcelas compatíveis
  * Explique que o déficit acumulado inviabiliza temporariamente o adimplemento

5. DO PEDIDO SUBSIDIÁRIO – ENQUADRAMENTO NA MP 1314/2025
- Desenvolva o enquadramento na Medida Provisória nº 1.314/2025
- Cite regulamentação pela Resolução CMN nº 5.247/2025
- Explique as linhas de crédito emergencial (BNDES e recursos livres)
- Demonstre que o requerente preenche os requisitos

6. DOS PEDIDOS
Liste os pedidos em alíneas:
a) Alongamento nos termos do MCR 2.6.4, Súmula 298, Resoluções CMN;
b) Concessão de carência e parcelamento conforme laudo técnico;
c) Manutenção das mesmas garantias e encargos originais;
d) Subsidiariamente, enquadramento na MP 1.314/2025;
e) Suspensão de medidas de cobrança, negativação e execução de garantias;
f) Formalização no maior prazo possível.

CONSIDERAÇÕES FINAIS:
- Demonstre boa-fé e disposição de cumprimento
- Invoque função social do contrato e da propriedade

DA PRESUNÇÃO DE NEGATIVA:
- Estabeleça prazo de 72 horas para resposta
- Avise sobre medidas judiciais cabíveis (ação de obrigação de fazer com tutela de urgência)

ENCERRAMENTO:
Atenciosamente,
${cidade}/${ufCidade}, ${data}.

IMPORTANTE: Gere o documento COMPLETO, EXTENSO (8-12 páginas), em texto corrido profissional. NÃO use formatação markdown. Use linguagem jurídica formal e densa. Cada seção deve ter múltiplos parágrafos bem desenvolvidos.`;
    } else if (tipo === "peticao") {
      prompt = `Você é um advogado agrarista brasileiro de alto nível. Gere uma PETIÇÃO INICIAL completa de AÇÃO DE OBRIGAÇÃO DE FAZER C/C PEDIDO DE TUTELA DE URGÊNCIA, densa e profissional (8-12 páginas), para o seguinte caso:

DADOS DO CASO:
- Autor: ${produtor}, CPF: ${cpf}, produtor rural, domiciliado em ${nomePropriedade}, ${municipio}/${uf}
- Réu: ${banco}
- Contratos:
${contratosTexto}
- Culturas: ${cultura}, Safra: ${safra}
- Área cultivada: ${areaCultivada} ha (total: ${areaTotal} ha)
- Perda de produtividade: ${perda}%
- Produtividade esperada: ${prodEsperada} | Realizada: ${prodRealizada}
- Receita bruta: R$ ${receitaBruta} | Custo total: R$ ${custoTotal}
- Saldo devedor: R$ ${saldoDevedor}
- Evento climático: ${evento}
- Laudo técnico nº ${numero_laudo}, por ${agronomo}, CREA${creaUf}: ${crea}
- Hipóteses MCR configuradas:
${hipotesesText}

ESTRUTURA OBRIGATÓRIA:
1. ENDEREÇAMENTO ao Juízo da Comarca de ${municipio}/${uf}
2. QUALIFICAÇÃO DAS PARTES (completa)
3. DOS FATOS (extenso, com toda cronologia, contratos, perdas por cultura, dados CONAB)
4. DO DIREITO (MCR 2.6.4, Súmula 298 STJ, Lei 4.829/65, DL 167/67 art. 13, Lei 8.171/91 art. 48, CF arts. 23 VIII e 187, Resoluções CMN 5.200/2025, 5.204/2025, 5.220/2025)
5. DA TUTELA DE URGÊNCIA (probabilidade do direito + perigo de dano, com fundamentação no CPC arts. 300 e 303)
6. DOS PEDIDOS (liminares e mérito: prorrogação, suspensão de negativação, manutenção de garantias, inversão do ônus da prova)
7. DO VALOR DA CAUSA
8. Local, data, advogado

Fundamente com jurisprudência do STJ, TJPR, TJGO, TJRS, TJES. Cite CDC arts. 39 e 51 subsidiariamente. Gere documento COMPLETO, EXTENSO, sem markdown, linguagem processual formal.

${cidade}/${ufCidade}, ${data}.`;
    } else {
      return new Response(
        JSON.stringify({ error: "Tipo deve ser 'notificacao' ou 'peticao'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          {
            role: "system",
            content: "Você é um advogado agrarista brasileiro de alto nível, com vasta experiência em crédito rural, MCR 2.6.4, e pedidos administrativos de alongamento de dívida rural. Gere documentos jurídicos COMPLETOS, EXTENSOS (mínimo 8 páginas), profissionais e densamente fundamentados. Responda APENAS com o documento completo, sem explicações adicionais. NÃO use formatação markdown. Use linguagem jurídica formal brasileira.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 16000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Lovable AI error:", err);
      throw new Error("Erro ao gerar documento com IA");
    }

    const aiData = await response.json();
    const documento = aiData.choices?.[0]?.message?.content || "Erro ao gerar documento.";

    return new Response(
      JSON.stringify({ success: true, documento }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
