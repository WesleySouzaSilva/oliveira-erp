import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── System Prompt: Laudo de Perda de Safra ─────────────────────────────────
const SYSTEM_PROMPT_PERDA = `Você é um assistente especializado em engenharia agronômica, responsável por gerar laudos técnicos de perda de safra para fins de pedido de prorrogação de dívida rural junto a instituições financeiras (Banco do Brasil, Bradesco Financiamentos, BNDES, cooperativas de crédito rural).

## Identidade e responsabilidade técnica

Os laudos gerados por você serão assinados por um Engenheiro Agrônomo devidamente registrado no CREA. Você é o assistente de redação e formatação técnica desse profissional. O conteúdo técnico é fornecido pelo agrônomo — sua função é estruturar, redigir e formatar com precisão e consistência profissional.

## Padrão técnico do laudo

### Linguagem
- Terminologia técnica agronômica formal (nomenclatura científica das culturas, terminologia de solo SiBCS/Embrapa, estádios fenológicos BBCH, parâmetros FAO-56)
- Cada termo técnico não autoevidente deve ser seguido de nota explicativa em itálico (ex.: "veranico (período contínuo sem precipitação efetiva ≥ 5 mm)")
- Tom: narrativa técnica — cada seção abre com parágrafo contextual, seguido de tabela ou dado quantitativo
- Sem linguagem jurídica — o laudo prova o fato técnico; o enquadramento legal é responsabilidade do advogado ou do próprio banco
- Sem analogias simplificadas — o público-alvo é tecnicamente capaz de ler o laudo

### Estrutura obrigatória do laudo (10 seções + anexos)

**Seção 1 — Identificação do Produtor e da Propriedade**
Dados cadastrais completos, caracterização edafoclimática (solo SiBCS, clima Köppen, precipitação normal 1991–2020 INMET, CAD do solo). Abra com parágrafo contextual sobre o produtor, sua trajetória e a aptidão da propriedade. Mínimo 2 parágrafos densos + tabelas de dados.

**Seção 2 — Culturas Implantadas — Safra [ANO]**
Parágrafo explicando o sistema de cultivo planejado. Tabela com: espécie (nomenclatura científica), cultivar, área (ha), grupo/ciclo, sistema (sequeiro/irrigado), data de semeadura, data de colheita prevista. Notas sobre tecnologia quando relevante. Mínimo 2 parágrafos + tabela.

**Seção 3 — A Adversidade Climática**
3.1 Dados pluviométricos oficiais: tabela mensal com precipitação observada × normal climatológica × déficit mm × déficit % × temperatura máxima × dias de veranico. Parágrafo analítico denso para cada subseção.
3.2 Caracterização dos veranicos: identificar cada período sem chuva, duração, impacto no estádio fenológico da cultura.
3.3 Reconhecimento oficial: decretos estadual e municipal de emergência, números e datas.
MÍNIMO 4-5 parágrafos densos nesta seção. É a seção mais importante do laudo.

**Seção 4 — Impacto na Lavoura — Vistoria Técnica de Campo**
4.1 Resultados quantitativos por cultura: tabela com parâmetro × valor obtido × referência Embrapa × variação %.
4.2 Descrição detalhada das observações de campo, mencionando pontos de amostragem, metodologia e resultados.
Mínimo 3 parágrafos por cultura avaliada.

**Seção 5 — Dados Produtivos — Frustração de Safra**
5.1 Comparativo histórico: tabela com safra × precipitação × produtividade × resultado (mínimo 4 safras anteriores se disponível).
5.2 Tabela de frustração: cultivar × área × produtividade histórica × produtividade obtida × sacas perdidas × perda %.
Calcular correlação entre precipitação e produtividade quando dados permitirem. Mínimo 2-3 parágrafos analíticos.

**Seção 6 — Contexto de Mercado — Queda das Cotações** (quando aplicável)
Análise de cotações por cultura. Identificação dos fatores estruturais de queda. Referências a fontes (CEPEA/Esalq, CONAB). Mínimo 2 parágrafos por cultura.

**Seção 7 — Impacto Econômico Total**
Tabela consolidada: perda física × desvalorização × custos extras × TOTAL.
Caixa de destaque: receita obtida vs. custo investido. Parágrafo conclusivo sobre o impacto.

**Seção 8 — Síntese Conclusiva**
Quatro itens obrigatórios: (I) evento climático comprovado, (II) perdas físicas quantificadas, (III) contexto de mercado, (IV) capacidade de pagamento comprometida.
Linguagem assertiva e objetiva. Recomendação clara de prorrogação.

**Seção 9 — Declaração do Produtor Rural**
Texto padrão de declaração de veracidade das informações (art. 299 CP).

**Seção 10 — Assinatura do Responsável Técnico**
Bloco com nome, CREA, especialidade, data e local.

### Regras de cálculo

Quando os dados brutos forem fornecidos, calcule:
1. Déficit pluviométrico: ((normal - observado) / normal) × 100
2. Frustração de safra: ((produção histórica - produção obtida) / produção histórica) × 100
3. Impacto financeiro: sacas perdidas × cotação atual por cultura
4. Fator Ky (FAO Paper 33): Ky padrão: soja = 1,25; milho = 1,25; algodão = 0,85; café = 0,90; trigo = 1,00; arroz = 1,20; feijão = 1,15

### O que fazer quando dados estiverem faltando
- Se dados de precipitação estiverem incompletos: mencionar que os dados estão pendentes de validação
- Se não houver histórico de 4 safras: usar o disponível e mencionar a limitação
- Se cotação não for fornecida: omitir a Seção 6 e indicar nos anexos
- Se não houver decreto de emergência: mencionar que o processo está em curso

### Formato de saída

Retorne um JSON com a seguinte estrutura EXATA. Cada seção deve ter texto rico e detalhado (mínimo 18-25 páginas quando impresso):

{
  "capa": {
    "titulo": "LAUDO DE PERDA DE SAFRA",
    "subtitulo": "Comprovação de Quebra de Safra por Adversidade Climática — [tipo]",
    "culturas_safra": "Culturas | Safra | Município — UF",
    "numero_laudo": "LP-XXXX/XXXX"
  },
  "ficha_tecnica": {
    "produtor": "", "cpf_cnpj": "", "propriedade": "", "car": "",
    "area_cultivada": "", "safra": "", "credor": "",
    "finalidade": "Comprovação de quebra de safra para pedido de prorrogação",
    "agronomo": "", "crea": "", "data_vistoria": "", "data_emissao": ""
  },
  "secoes": [
    {
      "numero": 1,
      "titulo": "IDENTIFICAÇÃO DO PRODUTOR E DA PROPRIEDADE",
      "paragrafos": ["parágrafo 1...", "parágrafo 2..."],
      "tabelas": [
        {
          "titulo": "Dados do Produtor e Propriedade",
          "tipo": "chave_valor",
          "linhas": [["Campo", "Valor"], ...]
        }
      ]
    }
  ],
  "anexos": ["Lista de documentos que instruem o laudo"]
}

IMPORTANTE: Cada parágrafo deve ser DENSO e TÉCNICO, com 4-8 linhas. Não gere textos curtos ou genéricos. O laudo deve ter substância técnica suficiente para fundamentar um pedido de prorrogação perante uma instituição financeira.`;

// ─── System Prompt: Laudo de Capacidade de Pagamento ────────────────────────
const SYSTEM_PROMPT_CAPACIDADE = `Você é um assistente especializado em engenharia agronômica e análise de viabilidade rural, responsável por gerar laudos técnicos de capacidade de pagamento para fins de renegociação de dívida rural junto a instituições financeiras.

## Função deste laudo

O Laudo de Capacidade de Pagamento responde a uma pergunta diferente do Laudo de Perda de Safra:
- Perda de Safra: "O que aconteceu? Por quê o produtor não pôde pagar?"
- Capacidade de Pagamento: "O produtor vai conseguir pagar nas novas condições propostas?"

Este documento é prospectivo — projeta receitas, custos e fluxo de caixa das próximas safras sob as condições renegociadas, demonstrando a viabilidade econômica da operação.

## Estrutura obrigatória

**Seção 1 — Identificação**
Produtor, propriedade, operação de crédito, condições atuais (saldo devedor, vencimento, juros) e condições propostas (carência, novo prazo, parcela anual). Mínimo 2 parágrafos + tabelas.

**Seção 2 — Capacidade Produtiva da Propriedade**
Histórico de produtividade (excluindo o ano da adversidade). Aptidão da propriedade (solo, clima, ZARC). Demonstração de que a queda foi evento atípico. Mínimo 3 parágrafos.

**Seção 3 — Projeção de Receita para as Próximas Safras**
Tabela por safra (3 a 5 anos): área × produtividade projetada × preço conservador = receita bruta.
Cenário base e cenário conservador (preços CEPEA com desconto de 10–15%). Mínimo 2 parágrafos + tabelas.

**Seção 4 — Projeção de Custos de Produção**
Custo por cultura por hectare (CONAB/Embrapa). Total de custos. Margem bruta projetada. Mínimo 2 parágrafos + tabela.

**Seção 5 — Fluxo de Caixa Projetado**
Tabela: Ano / Receita bruta / Custos / Margem / Parcela da dívida / Manutenção familiar / Saldo disponível.
Demonstrar saldo positivo em todos os anos. Mínimo 2 parágrafos analíticos + tabela.

**Seção 6 — Indicadores de Viabilidade**
- Relação benefício/custo (RBC)
- Ponto de equilíbrio: produtividade mínima para cobrir a parcela
- Parcela como % da receita bruta projetada (meta: < 30%)
Mínimo 2 parágrafos.

**Seção 7 — Conclusão Técnica**
Afirmação objetiva sobre a viabilidade do pagamento nas condições propostas. Mínimo 2 parágrafos assertivos.

**Seção 8 — Declaração e Assinatura**
Blocos padrão.

## Linguagem e tom
Mesma linguagem técnica do Laudo de Perda de Safra: formal, precisa, com dados quantitativos.

## Formato de saída
Retorne JSON com mesma estrutura do Laudo de Perda (capa, ficha_tecnica, secoes, anexos).
Cada parágrafo deve ser DENSO e TÉCNICO. O laudo deve ser convincente para o comitê de crédito do banco.`;

// ─── Build user prompt from wizard data ─────────────────────────────────────
function buildUserPromptPerda(ctx: any): string {
  const culturas = ctx.culturas || (ctx.cultura ? [ctx.cultura] : []);
  const contratos = ctx.contratos || [];

  let prompt = `SOLICITAÇÃO: Gere o laudo de perda de safra completo com os dados abaixo.

=== BLOCO 1 — RESPONSÁVEL TÉCNICO ===
Nome do agrônomo: ${ctx.nomeAgronomo || "[a definir pelo agrônomo]"}
CREA: ${ctx.creaNumero || "[a definir]"}
Número do laudo: ${ctx.numeroLaudo || "LP-" + new Date().getFullYear() + "/XXXX"}
Data de emissão: ${new Date().toLocaleDateString("pt-BR")}

=== BLOCO 2 — PRODUTOR E PROPRIEDADE ===
Nome completo: ${ctx.nome || "[N/I]"}
CPF/CNPJ: ${ctx.documento || "[N/I]"}
Telefone: ${ctx.telefone || "[N/I]"}
Nome da fazenda: ${ctx.nomePropriedade || "[N/I]"}
Município e UF: ${ctx.municipio || "[N/I]"}-${ctx.uf || "[N/I]"}
Coordenadas GPS: ${ctx.latitude || "[N/I]"}° S, ${ctx.longitude || "[N/I]"}° W
Área total: ${ctx.areaTotal || "[N/I]"} ha
Área cultivada: ${ctx.areaCultivada || "[N/I]"} ha
CAR: ${ctx.car || "[N/I]"}
Tipo de solo: ${ctx.tipoSolo || "[N/I]"}
Sistema de irrigação: ${ctx.sistemaIrrigacao || "Sequeiro"}

=== BLOCO 3 — CULTURAS DA SAFRA ===
Culturas: ${culturas.join(", ") || "[N/I]"}
Safra: ${ctx.safra || "[N/I]"}
Data de plantio: ${ctx.dataPlantio || "[N/I]"}
Data de colheita prevista: ${ctx.dataColheita || "[N/I]"}
Espaçamento: ${ctx.espacamento || "[N/I]"} m
Densidade de plantio: ${ctx.densidade || "[N/I]"} plantas/ha`;

  if (contratos.length > 0) {
    prompt += `\n\n=== BLOCO — FINANCIAMENTO ===`;
    contratos.forEach((c: any, i: number) => {
      prompt += `\nContrato ${i + 1}:`;
      prompt += `\n  Banco(s): ${(c.banco || []).join(", ") || "[N/I]"}`;
      prompt += `\n  Número: ${c.contrato || "[N/I]"}`;
      prompt += `\n  Modalidade: ${c.modalidade || "[N/I]"}`;
      prompt += `\n  Valor original: R$ ${c.valorOriginal || "[N/I]"}`;
      prompt += `\n  Saldo devedor: R$ ${c.saldoDevedor || "[N/I]"}`;
      prompt += `\n  Vencimento: ${c.dataVencimento || "[N/I]"}`;
    });
  }

  prompt += `\n\n=== BLOCO 4 — DADOS CLIMÁTICOS ===
Informações disponíveis no sistema (dados INMET consultados):
${ctx.dadosClimaticos ? JSON.stringify(ctx.dadosClimaticos, null, 2) : "[Dados climáticos não disponíveis — gerar seção com base nas informações regionais conhecidas]"}

Decretos de emergência conhecidos:
${ctx.decretos ? JSON.stringify(ctx.decretos, null, 2) : "[Verificar junto ao S2ID e Defesa Civil]"}`;

  prompt += `\n\n=== BLOCO 5 — PRODUTIVIDADE ===
Média histórica: ${ctx.mediaHistorica || "[N/I]"} sc/ha
Produtividade esperada: ${ctx.produtividadeEsperada || "[N/I]"} sc/ha
Produtividade realizada: ${ctx.produtividadeRealizada || "[N/I]"} sc/ha
Histórico por safra:`;

  ["19/20", "20/21", "21/22", "22/23", "23/24"].forEach(s => {
    const key = `produtividade${s.replace("/", "")}`;
    if (ctx[key]) prompt += `\n  Safra ${s}: ${ctx[key]} sc/ha`;
  });

  prompt += `\n\n=== BLOCO 6 — DADOS FINANCEIROS ===
Receita bruta: R$ ${ctx.receitaBruta || "[N/I]"}
Custo total de produção: R$ ${ctx.custoTotal || "[N/I]"}
Saldo devedor total: R$ ${ctx.saldoDevedor || "[N/I]"}
Preço médio de venda: R$ ${ctx.precoVenda || "[N/I]"}/saca
Volume comercializado: ${ctx.volumeComercializado || "[N/I]"} sacas

=== BLOCO 7 — ENQUADRAMENTO MCR ===
Hipóteses selecionadas: ${(ctx.hipoteses || []).map((h: string) => {
    const labels: Record<string, string> = {
      a: "Dificuldade de comercialização do produto",
      b: "Frustração de safra por adversidade climática",
      c: "Pragas, doenças ou outros fatores prejudiciais",
      d: "Dificuldades de fluxo de caixa",
    };
    return `Alínea "${h}" — ${labels[h] || h}`;
  }).join("; ") || "Nenhuma"}
Justificativa: ${ctx.justificativa || "[N/I]"}

=== BLOCO 8 — OBSERVAÇÕES ===
${ctx.observacoes || "[Sem observações adicionais]"}

INSTRUÇÃO FINAL: Gere o laudo COMPLETO e DETALHADO. Cada seção deve ter parágrafos densos e técnicos. O laudo deve ter conteúdo suficiente para 18-25 páginas quando formatado. NÃO gere textos genéricos ou curtos. Use os dados fornecidos para fundamentar cada afirmação.`;

  return prompt;
}

function buildUserPromptCapacidade(ctx: any): string {
  const producoes = ctx.producoes || [];
  
  let prompt = `SOLICITAÇÃO: Gere o laudo de capacidade de pagamento com os dados abaixo.

=== BLOCO 1 — RESPONSÁVEL TÉCNICO ===
Nome do agrônomo: ${ctx.nomeAgronomo || "[a definir pelo agrônomo]"}
CREA: ${ctx.creaNumero || "[a definir]"}
Número do laudo: LCP-${new Date().getFullYear()}/XXXX

=== BLOCO 2 — PRODUTOR E PROPRIEDADE ===
Nome: ${ctx.nome || "[N/I]"}
CPF/CNPJ: ${ctx.documento || "[N/I]"}
Propriedade: ${ctx.nomePropriedade || "[N/I]"} — ${ctx.municipio || "[N/I]"}/${ctx.uf || "[N/I]"}
Área cultivada: ${ctx.areaCultivada || "[N/I]"} ha
Culturas: ${(ctx.culturas || []).join(", ") || "[N/I]"}
Safra: ${ctx.safra || "[N/I]"}

=== BLOCO 3 — DÍVIDA A RENEGOCIAR ===
Composição total das dívidas: R$ ${ctx.composicaoDividas || "[N/I]"}
Carência proposta: ${ctx.carenciaAnos || "[N/I]"} anos
Prazo de parcelamento: ${ctx.prazoParcelamento || "[N/I]"} anos
Parcela anual estimada: R$ ${ctx.parcelaAnual || "[calcular]"}`;

  if (ctx.contratos?.length > 0) {
    prompt += `\n\nContratos:`;
    ctx.contratos.forEach((c: any, i: number) => {
      prompt += `\n  ${i + 1}. Banco: ${(c.banco || []).join(", ")} | Nº ${c.contrato} | Saldo: R$ ${c.saldoDevedor}`;
    });
  }

  prompt += `\n\n=== BLOCO 4 — PRODUÇÃO E RECEITAS ===`;
  if (producoes.length > 0) {
    producoes.forEach((p: any) => {
      const receita = (Number(p.producaoTotal) || 0) * (Number(p.precoMedio) || 0);
      prompt += `\n  ${p.tipo === "vegetal" ? "🌱" : "🐄"} ${p.cultura}: ${p.areaOuAnimais} ${p.tipo === "vegetal" ? "ha" : "animais"} | Produção: ${p.producaoTotal} ${p.tipo === "vegetal" ? "sc" : "L"} | Preço: R$ ${p.precoMedio} | Custo: R$ ${p.custoProducao} | Receita: R$ ${receita.toFixed(2)}`;
    });
  }

  const receitaTotal = producoes.reduce((acc: number, p: any) => acc + (Number(p.producaoTotal) || 0) * (Number(p.precoMedio) || 0), 0) + (Number(ctx.outrasReceitas) || 0);
  const custoTotal = producoes.reduce((acc: number, p: any) => acc + (Number(p.custoProducao) || 0), 0) + (Number(ctx.outrasDespesas) || 0);

  prompt += `\n\nOutras receitas: R$ ${ctx.outrasReceitas || "0"}
Outras despesas: R$ ${ctx.outrasDespesas || "0"}
Receita total projetada: R$ ${receitaTotal.toFixed(2)}
Custo total projetado: R$ ${custoTotal.toFixed(2)}
Resultado das atividades: R$ ${(receitaTotal - custoTotal).toFixed(2)}

=== BLOCO 5 — MANUTENÇÃO DO PROPONENTE ===
Manutenção familiar (R$/ano): R$ ${ctx.manutencaoFamiliar || "[N/I]"}
Outras manutenções (R$/ano): R$ ${ctx.outrasManutencoes || "0"}

=== BLOCO 6 — HISTÓRICO DE PRODUTIVIDADE ===
Média histórica: ${ctx.mediaHistorica || "[N/I]"} sc/ha
Produtividade esperada: ${ctx.produtividadeEsperada || "[N/I]"} sc/ha`;

  ["19/20", "20/21", "21/22", "22/23", "23/24"].forEach(s => {
    const key = `produtividade${s.replace("/", "")}`;
    if (ctx[key]) prompt += `\n  Safra ${s}: ${ctx[key]} sc/ha`;
  });

  prompt += `\n\nINSTRUÇÃO FINAL: Gere o laudo de capacidade de pagamento COMPLETO. Demonstre tecnicamente que o produtor terá condições de pagar nas novas condições propostas. Use dados quantitativos, tabelas comparativas e projeções realistas. Mínimo 12-18 páginas.`;

  return prompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { tipo, dados } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada. Adicione a chave nas configurações do projeto.");

    let systemPrompt: string;
    let userPrompt: string;

    if (tipo === "perda") {
      systemPrompt = SYSTEM_PROMPT_PERDA;
      userPrompt = buildUserPromptPerda(dados);
    } else if (tipo === "capacidade") {
      systemPrompt = SYSTEM_PROMPT_CAPACIDADE;
      userPrompt = buildUserPromptCapacidade(dados);
    } else {
      throw new Error("Tipo de laudo não reconhecido: " + tipo);
    }

    console.log(`Gerando laudo ${tipo} via Claude — prompt: ${userPrompt.length} chars`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições da API Claude excedido. Aguarde alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Chave da API Claude inválida. Verifique a configuração." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro na API Claude: ${response.status} — ${errText}`);
    }

    const result = await response.json();
    const rawContent = result.content?.[0]?.text || "";

    // Try to parse JSON from the response (may be wrapped in markdown code blocks)
    let laudoData: any;
    try {
      // Strip markdown code fences if present
      const jsonStr = rawContent.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      laudoData = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, return the raw text as a structured fallback
      laudoData = {
        capa: { titulo: "LAUDO TÉCNICO", subtitulo: tipo === "perda" ? "Perda de Safra" : "Capacidade de Pagamento" },
        texto_completo: rawContent,
        parse_error: true,
      };
    }

    return new Response(JSON.stringify({ laudo: laudoData, tipo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gerar-laudo-completo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
