import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECOES_CONFIG: Record<string, Record<string, { titulo: string; instrucao: string }[]>> = {
  pedido_administrativo: {
    secoes: [
      {
        titulo: "Endereçamento e Qualificação",
        instrucao: "Gere o endereçamento ao banco/cooperativa de crédito (use o nome do banco dos dados do caso). Identifique como 'URGENTE. Pedido de Alongamento de dívida rural.' Inclua resumo: operações de crédito rural em anexo, capacidade de pagamento afetada, necessidade de alteração do cronograma conforme MCR 2.6.4 e Resoluções CMN 5.200/2025 e 5.220/2025. Qualifique o produtor rural com nome completo, nacionalidade, profissão, endereço, CPF. Indique que age por meio de seu advogado. Apresente formalmente o PEDIDO ADMINISTRATIVO DE ALONGAMENTO DE DÍVIDA RURAL com fulcro na Súmula 298 do STJ, MCR 2.6.4, Resoluções CMN 5.200/2025, 5.204/2025, 5.220/2025, MP 1.314/2025, Resolução CMN 5.247/2025, art. 13 DL 167/1967, arts. 2, 9 e 14 da Lei 4.829/1965, art. 48 da Lei 8.171/1991, art. 19 da Lei 4.595/1964, arts. 23 VIII e 187 I e II da CF/1988.",
      },
      {
        titulo: "Dos Contratos de Crédito Rural",
        instrucao: "Descreva o relacionamento do mutuário com a instituição financeira. Mencione que tem interesse na continuidade da parceria de forma legal e equilibrada. Liste TODOS os contratos de crédito rural em formato de tabela com: número da operação, valor, data de contratação, data de início do pagamento, data de vencimento e fim do pagamento. Descreva a finalidade das operações (custeio, investimento, financiamento da produção). Cite que constitui crédito rural nos termos dos arts. 2º e 9º, I e II, da Lei 4.829/1965.",
      },
      {
        titulo: "Motivos que Afetaram a Capacidade de Pagamento",
        instrucao: "Descreva detalhadamente os motivos que afetaram a capacidade de pagamento, com base no laudo técnico. Inclua: período de déficit hídrico, eventos climáticos reconhecidos oficialmente (AGERH, Monitor de Secas, CONAB). Para cada atividade produtiva (cafeicultura, pecuária, soja, etc.), detalhe: redução percentual na produção por safra, desvalorização dos preços de comercialização, redução da receita bruta com valores comparativos, impactos específicos (mortalidade de animais, degradação de pastagens, etc.). Conclua demonstrando que estão configuradas as hipóteses do MCR 2.6.4: (1) dificuldade de comercialização, (2) frustração de safras, (3) ocorrências prejudiciais. Seja muito detalhado com números e percentuais. Mínimo 2 páginas.",
      },
      {
        titulo: "Do Direito ao Alongamento da Dívida Rural",
        instrucao: "Fundamente que o alongamento NÃO é mera liberalidade mas direito subjetivo do produtor. Cite literalmente a Súmula 298 do STJ. Explique o MCR 2.6.4 com as 3 hipóteses de prorrogação obrigatória. Cite o arcabouço normativo: arts. 23 VIII e 187 I e II da CF, Lei 4.829/1965, art. 13 DL 167/1967, art. 48 Lei 8.171/1991. Mencione as Resoluções CMN 5.200/2025, 5.204/2025 e 5.220/2025 que autorizam prorrogação mantendo garantias e encargos originais. Conclua que a negativa injustificada enseja responsabilização do agente financeiro perante órgãos de controle do SFN e configura dano passível de reparação. Mínimo 1,5 páginas.",
      },
      {
        titulo: "Nova Capacidade de Pagamento",
        instrucao: "Cite o MCR Cap. 2, Seção 6, Item 1 sobre cronograma de reembolso. Apresente a estimativa técnica de recuperação com base no laudo do engenheiro agrônomo. Indique a partir de qual ano haverá fluxo de caixa positivo. Recomende tecnicamente a prorrogação com: número de parcelas anuais, valor de cada parcela, ano de início, respeitando sazonalidade. Mencione que as projeções foram feitas com dados da CONAB e INMET. Explique que o déficit acumulado inviabiliza temporariamente o adimplemento sem configurar mora culposa.",
      },
      {
        titulo: "Do Pedido Subsidiário – MP 1.314/2025",
        instrucao: "Apresente pedido subsidiário de enquadramento na MP 1.314/2025 regulamentada pela Resolução CMN 5.247/2025. Explique que a MP autorizou linhas de crédito emergencial para liquidação ou amortização de dívidas de produtores prejudicados por eventos adversos. Cite o art. 1º §2º sobre beneficiários (perda em duas ou mais safras entre 01/07/2020 e 30/06/2025). Mencione o art. 2º III e IV sobre operações renegociadas. Descreva as duas linhas: (i) recursos supervisionados via BNDES e (ii) recursos livres. Indique o prazo de contratação (até 15/12/2026).",
      },
      {
        titulo: "Dos Pedidos",
        instrucao: "Liste os pedidos em alíneas formais: (a) alongamento nos termos do MCR 2.6.4, Súmula 298 STJ, Resoluções CMN; (b) concessão de carência até o ano indicado no laudo e pagamento em parcelas anuais conforme recomendação técnica; (c) manutenção das mesmas garantias reais e encargos financeiros originais nos termos do MCR 2.6.4; (d) subsidiariamente, enquadramento nas linhas da MP 1.314/2025; (e) suspensão de quaisquer medidas de cobrança, negativação e execução de garantias até formalização do alongamento; (f) formalização no maior prazo possível como direito subjetivo.",
      },
      {
        titulo: "Considerações Finais e Presunção de Negativa",
        instrucao: "Nas considerações finais, mencione que o requerente aguarda resposta conforme boas práticas de atendimento, boa-fé objetiva e função social do contrato. Informe que todos os documentos estão anexos (laudos técnicos, documento descritivo de crédito, procuração). Manifeste boa-fé e disposição de cumprir obrigações adequadas à real capacidade. Na presunção de negativa, informe que se não houver resposta fundamentada em 72 horas, ou em caso de negativa sem fundamentação legal, o requerente considerará presumida a recusa e adotará medidas judiciais cabíveis (ação de obrigação de fazer com tutela de urgência, fundada na Súmula 298 do STJ). Finalize com local, data, nome e OAB do advogado.",
      },
    ],
  },
  peticao_inicial: {
    secoes: [
      {
        titulo: "Endereçamento",
        instrucao: "Gere o endereçamento ao Juízo competente da Comarca, com a designação formal completa do juízo.",
      },
      {
        titulo: "Qualificação das Partes",
        instrucao: "Qualifique o autor (produtor rural) e o réu (instituição financeira) com todos os dados: nome completo, CPF/CNPJ, endereço, domicílio, representante legal se PJ.",
      },
      {
        titulo: "Dos Fatos",
        instrucao: "Narre todos os fatos de forma cronológica e detalhada: histórico da relação com o banco, contratos celebrados, finalidade das operações, eventos climáticos, perdas por cultura com dados técnicos do laudo, comparação com CONAB. Mínimo 3 páginas. Seja denso e fundamentado.",
      },
      {
        titulo: "Do Direito",
        instrucao: "Fundamente o direito ao alongamento: MCR 2.6.4 (cite e explique cada hipótese), Súmula 298 STJ (cite literalmente), Lei 4.829/65, DL 167/67 art. 13, Lei 8.171/91 art. 48, CF arts. 23 VIII e 187 I e II, Resoluções CMN 5.200/2025, 5.204/2025, 5.220/2025. Cite jurisprudência do STJ, TJGO, TJPR, TJRS. Mínimo 3 páginas.",
      },
      {
        titulo: "Da Tutela de Urgência",
        instrucao: "Fundamente o pedido de tutela de urgência com base nos arts. 300 e 303 do CPC. Demonstre: probabilidade do direito (laudo + legislação) e perigo de dano (negativação, execução de garantias, perda da terra). Cite precedentes.",
      },
      {
        titulo: "Dos Pedidos",
        instrucao: "Liste todos os pedidos em alíneas: (a) tutela de urgência para suspensão de negativação e execução; (b) condenação ao alongamento nos termos do MCR 2.6.4; (c) parcelamento conforme laudo de capacidade; (d) manutenção das garantias originais; (e) inversão do ônus da prova; (f) condenação em custas e honorários. Inclua valor da causa.",
      },
    ],
  },
  tutela_urgencia: {
    secoes: [
      {
        titulo: "Endereçamento",
        instrucao: "Gere o endereçamento ao Juízo competente, referenciando o processo principal se existir.",
      },
      {
        titulo: "Qualificação e Resumo",
        instrucao: "Qualifique o requerente e apresente síntese do caso: contratos, perdas, negativa do banco.",
      },
      {
        titulo: "Da Situação de Urgência",
        instrucao: "Descreva detalhadamente a situação de urgência: iminência de negativação, execução extrajudicial de garantias, risco de perda da terra/propriedade, safra em curso que será comprometida. Use linguagem que demonstre o perigo concreto e atual.",
      },
      {
        titulo: "Do Direito - Requisitos da Tutela",
        instrucao: "Fundamente nos arts. 300, 303 e 311 do CPC. Demonstre: (1) probabilidade do direito com base no MCR 2.6.4, Súmula 298 STJ, laudo técnico; (2) perigo de dano irreparável; (3) reversibilidade da medida. Cite jurisprudência específica de tutelas deferidas em crédito rural.",
      },
      {
        titulo: "Dos Pedidos Liminares",
        instrucao: "Liste os pedidos liminares: suspensão de negativação em cadastros restritivos (SPC/SERASA), suspensão de execução extrajudicial de garantias, manutenção do mutuário na posse do imóvel rural, proibição de vencimento antecipado do contrato. Fixe multa diária por descumprimento (astreintes).",
      },
    ],
  },
  manifestacao: {
    secoes: [
      {
        titulo: "Endereçamento e Referência Processual",
        instrucao: "Gere o endereçamento ao Juízo, referenciando o número do processo, vara, comarca. Identifique as partes.",
      },
      {
        titulo: "Da Tempestividade",
        instrucao: "Demonstre que a manifestação é tempestiva, indicando a data da intimação e o prazo legal.",
      },
      {
        titulo: "Dos Fatos Supervenientes / Impugnação",
        instrucao: "Apresente os fatos novos ou impugne os argumentos da parte contrária. Se for contestação do banco, rebata ponto a ponto: (1) alegação de inadimplência voluntária vs. caso fortuito/força maior; (2) alegação de não configuração do MCR 2.6.4 vs. laudo técnico; (3) cláusulas contratuais vs. normas cogentes do CMN.",
      },
      {
        titulo: "Do Direito Aplicável",
        instrucao: "Reforce a fundamentação jurídica: MCR 2.6.4, Súmula 298 STJ, legislação agrária. Cite novas resoluções CMN ou decisões judiciais favoráveis. Diferencie inadimplência voluntária de impossibilidade superveniente por caso fortuito.",
      },
      {
        titulo: "Dos Pedidos / Requerimentos",
        instrucao: "Liste os requerimentos: manutenção da liminar, julgamento antecipado, produção de prova pericial agronômica se necessário, oitiva de testemunhas.",
      },
    ],
  },
  cautelar_antecedente: {
    secoes: [
      { titulo: "Endereçamento", instrucao: "Endereçamento ao Juízo Cível competente da Comarca do domicílio do produtor, indicando expressamente que se trata de TUTELA CAUTELAR EM CARÁTER ANTECEDENTE (art. 305 do CPC)." },
      { titulo: "Qualificação das Partes", instrucao: "Qualifique requerente (produtor rural) e requerida (instituição financeira), com nome, CPF/CNPJ, endereço e representação processual." },
      { titulo: "Síntese da Lide Principal a ser Proposta", instrucao: "Conforme art. 305 CPC, indique a lide principal que será deduzida em até 30 dias após efetivada a cautelar: ação de obrigação de fazer para alongamento da dívida rural com base no MCR 2.6.4 e Súmula 298 STJ. Aponte fundamentos, pedidos e valor estimado." },
      { titulo: "Dos Fatos – Recusa ou Silêncio do Banco", instrucao: "Narre cronologicamente: contratos firmados, eventos climáticos, laudo técnico apresentado ao banco com pedido administrativo de alongamento, e a recusa expressa OU o silêncio injustificado da instituição mesmo após esgotado o prazo de resposta. Demonstre a violação à boa-fé objetiva e à função social do contrato." },
      { titulo: "Do Cabimento da Tutela Cautelar Antecedente (art. 305 CPC)", instrucao: "Fundamente o cabimento da cautelar antecedente, distinguindo-a da tutela antecipada antecedente (art. 303). Cite doutrina (Fredie Didier, Daniel Mitidiero) e jurisprudência do STJ. Demonstre que se busca assegurar o resultado útil do processo principal, e não satisfazer desde logo o direito material." },
      { titulo: "Da Probabilidade do Direito (Fumus Boni Iuris)", instrucao: "Demonstre a plausibilidade do direito: MCR 2.6.4 (com as 3 hipóteses), Súmula 298 STJ, laudo técnico do engenheiro agrônomo, dados oficiais (CONAB, INMET, AGERH, Monitor de Secas), enquadramento nas Resoluções CMN 5.200/2025, 5.204/2025 e 5.220/2025. Cite jurisprudência específica de tutelas concedidas em crédito rural." },
      { titulo: "Do Perigo de Dano (Periculum in Mora)", instrucao: "Demonstre o perigo concreto e atual: iminência de vencimento antecipado, negativação em SPC/SERASA, execução extrajudicial de garantias reais (alienação fiduciária, hipoteca rural), risco de leilão do imóvel rural produtivo, comprometimento da safra em curso e da subsistência da família rural." },
      { titulo: "Dos Pedidos Cautelares e Aditamento (art. 308 CPC)", instrucao: "Liste pedidos cautelares: (a) determinar ao banco que se manifeste em prazo certo sobre o pedido administrativo de alongamento; (b) suspender negativação em cadastros restritivos; (c) suspender execução extrajudicial de garantias; (d) proibir vencimento antecipado; (e) fixar astreintes. Informe expressamente que o aditamento da inicial principal será apresentado em até 30 dias após efetivada a tutela, nos termos do art. 308 do CPC." },
    ],
  },
  mandamental_alongamento: {
    secoes: [
      { titulo: "Endereçamento", instrucao: "Endereçamento ao Juízo Cível competente da Comarca do domicílio do produtor rural, indicando AÇÃO DE OBRIGAÇÃO DE FAZER COM TUTELA MANDAMENTAL DE ALONGAMENTO DE DÍVIDA RURAL." },
      { titulo: "Qualificação das Partes", instrucao: "Qualifique autor (produtor rural) e réu (instituição financeira/cooperativa de crédito), com dados completos e representação processual. Indique procurações em anexo." },
      { titulo: "Dos Fatos", instrucao: "Narre cronologicamente: histórico do relacionamento bancário, contratos celebrados (com nº, valor, vencimento, garantias), evento climático e perdas técnicas, pedido administrativo prévio, recusa ou silêncio da instituição. Use os dados do laudo técnico. Mínimo 2 páginas." },
      { titulo: "Do Direito ao Alongamento (MCR 2.6.4 + Súmula 298 STJ)", instrucao: "Fundamente que o alongamento é DIREITO SUBJETIVO PÚBLICO do produtor rural, e não mera liberalidade. Cite literalmente a Súmula 298 STJ e desenvolva as 3 hipóteses do MCR 2.6.4. Cite Lei 4.829/1965, DL 167/1967 art. 13, Lei 8.171/1991 art. 48, CF arts. 23 VIII e 187 I e II, Resoluções CMN 5.200/2025, 5.204/2025 e 5.220/2025." },
      { titulo: "Da Natureza Mandamental da Tutela", instrucao: "Diferencie a tutela mandamental da condenatória pura: aqui se pretende ordem judicial DIRETA à instituição financeira para PRATICAR o ato de alongamento (formalização do aditivo contratual), e não apenas reconhecer o direito. Cite Pontes de Miranda e doutrina contemporânea (Marinoni, Didier). Justifique a imposição de astreintes (art. 537 CPC) e medidas atípicas (art. 139, IV CPC)." },
      { titulo: "Da Tutela de Urgência", instrucao: "Fundamente nos arts. 300 e 303 CPC: (1) probabilidade do direito (MCR + Súmula 298 + laudo); (2) perigo de dano (vencimento antecipado, negativação, execução de garantias). Peça liminarmente: suspensão de cobrança e negativação, manutenção das garantias originais, proibição de vencimento antecipado." },
      { titulo: "Dos Pedidos Mandamentais", instrucao: "Liste em alíneas: (a) deferimento da tutela de urgência liminar; (b) PROCEDÊNCIA para DETERMINAR ao réu que formalize o alongamento nos termos do MCR 2.6.4 com manutenção de garantias e encargos originais; (c) fixação de astreintes por descumprimento; (d) parcelamento conforme laudo de capacidade; (e) inversão do ônus da prova (CDC); (f) condenação em custas e honorários; (g) subsidiariamente, enquadramento na MP 1.314/2025." },
      { titulo: "Do Valor da Causa", instrucao: "Atribua valor da causa correspondente ao proveito econômico pretendido: valor total do saldo devedor objeto do alongamento. Cite art. 292 CPC. Indique documentos em anexo (procuração, laudo técnico, contratos, comprovante do pedido administrativo e da recusa)." },
    ],
  },
  embargos_execucao: {
    secoes: [
      { titulo: "Endereçamento e Referência à Execução", instrucao: "Endereçamento ao Juízo da Execução. Identifique: nº dos autos da execução, vara, comarca, partes (exequente/instituição financeira e executado/produtor rural). Indique título executivo (cédula de crédito rural – CCR, CCB, CPR, etc.)." },
      { titulo: "Da Tempestividade e Garantia do Juízo", instrucao: "Demonstre tempestividade nos termos do art. 915 CPC (15 dias úteis da juntada do mandado de citação ou penhora). Informe se houve garantia do juízo (penhora, depósito) ou justifique sua dispensa para fins de admissibilidade dos embargos (art. 914 CPC). Cite jurisprudência sobre desnecessidade de garantia para discussão de mérito." },
      { titulo: "Síntese da Execução Embargada", instrucao: "Resuma a execução: título exequendo, valor cobrado, data da assinatura da cédula, finalidade do crédito rural, garantias prestadas, evolução do débito apresentada pelo exequente. Identifique os pontos a serem impugnados." },
      { titulo: "Das Teses de Defesa Selecionadas", instrucao: "Desenvolva CADA UMA das teses de defesa listadas nos dados do caso (campo TESES_SELECIONADAS), uma após a outra, em subtópicos numerados. Para cada tese: (i) descreva o vício/abusividade concreta; (ii) fundamente com legislação, súmulas e jurisprudência do STJ específicas; (iii) demonstre o impacto financeiro no débito; (iv) cite precedentes recentes (últimos 5 anos). Mínimo 800 palavras POR TESE. Se houver tese de MCR 2.6.4, articule com o laudo técnico do caso. Se houver tese de caso fortuito climático, use os dados do evento e perdas constantes do laudo. Se houver tese de excesso de execução, indique necessidade de refazimento da planilha pelo expert." },
      { titulo: "Do Pedido de Efeito Suspensivo (art. 919, §1º CPC)", instrucao: "Requeira efeito suspensivo aos embargos demonstrando: (i) relevância da fundamentação (todas as teses acima); (ii) perigo de dano grave de difícil ou incerta reparação (leilão de imóvel rural produtivo, perda da safra, ruína financeira da família rural); (iii) garantia do juízo (se houver) ou pedido de dispensa fundamentado. Cite jurisprudência do STJ sobre efeito suspensivo em execuções de cédula rural." },
      { titulo: "Da Necessidade de Perícia Contábil e Agronômica", instrucao: "Requeira: (a) perícia contábil para apurar excesso de execução, expurgando encargos abusivos e recalculando o saldo conforme decisões judiciais; (b) perícia agronômica para confirmar perdas de safra e enquadramento no MCR 2.6.4 quando essa tese for invocada. Indique quesitos preliminares." },
      { titulo: "Dos Pedidos", instrucao: "Liste em alíneas: (a) recebimento dos embargos com efeito suspensivo; (b) procedência integral para extinguir ou reduzir a execução conforme teses acolhidas; (c) declaração de nulidade/inexigibilidade do título ou de cláusulas específicas; (d) reconhecimento do direito ao alongamento (se tese MCR invocada); (e) condenação do exequente em custas, honorários e eventual litigância de má-fé; (f) produção de provas pericial e documental superveniente; (g) inversão do ônus da prova (Súmula 297 STJ). Valor da causa: proveito econômico pretendido." },
    ],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims, error: claimsErr } = await authSb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tipo_peticao, secao_index, dados_caso, contexto_secoes_anteriores } = await req.json();

    if (!tipo_peticao || secao_index === undefined || !dados_caso) {
      return new Response(
        JSON.stringify({ error: "tipo_peticao, secao_index e dados_caso são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = SECOES_CONFIG[tipo_peticao];
    if (!config) {
      return new Response(
        JSON.stringify({ error: `Tipo '${tipo_peticao}' não suportado. Use: pedido_administrativo, cautelar_antecedente, mandamental_alongamento, peticao_inicial, embargos_execucao, tutela_urgencia, manifestacao` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const secao = config.secoes[secao_index];
    if (!secao) {
      return new Response(
        JSON.stringify({ error: `Seção ${secao_index} não existe para o tipo ${tipo_peticao}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context from case data
    const d = dados_caso;
    const tesesTexto = Array.isArray(d.teses_detalhadas) && d.teses_detalhadas.length > 0
      ? d.teses_detalhadas.map((t: any, i: number) => `  ${i + 1}. ${t.nome} — ${t.descricao}`).join("\n")
      : (Array.isArray(d.teses_selecionadas) && d.teses_selecionadas.length > 0
          ? d.teses_selecionadas.join(", ")
          : "Nenhuma tese específica selecionada");
    const contexto = `
DADOS DO CASO:
- Produtor: ${d.produtor || "___"}, CPF: ${d.cpf || "___"}
- Propriedade: ${d.propriedade || "___"}, Município: ${d.municipio || "___"}/${d.uf || "___"}
- Banco/Instituição: ${d.banco || "___"}
- Contratos: ${d.contratos || "Não informado"}
- Culturas: ${d.culturas || "___"}, Safra: ${d.safra || "___"}
- Área total: ${d.area_total || "___"} ha, Área cultivada: ${d.area_cultivada || "___"} ha
- Evento climático: ${d.evento_climatico || "seca / déficit hídrico"}
- Perda: ${d.perda_percentual || "___"}%
- Produtividade esperada: ${d.prod_esperada || "___"} | Realizada: ${d.prod_realizada || "___"}
- Receita bruta: R$ ${d.receita_bruta || "___"} | Custo total: R$ ${d.custo_total || "___"}
- Saldo devedor: R$ ${d.saldo_devedor || "___"}
- Laudo nº: ${d.numero_laudo || "___"}, Agrônomo: ${d.agronomo || "___"}, CREA: ${d.crea || "___"}
- Advogado: ${d.advogado || "___"}, OAB: ${d.oab || "___"}
- Hipóteses MCR: ${d.hipoteses || "I, II e III do MCR 2.6.4"}
- Número do processo (se existir): ${d.numero_processo || "N/A"}
- TESES_SELECIONADAS:
${tesesTexto}
`.trim();

    let contextoPrevio = "";
    if (contexto_secoes_anteriores && contexto_secoes_anteriores.length > 0) {
      contextoPrevio = "\n\nSEÇÕES JÁ REDIGIDAS (mantenha coerência e não repita informações):\n" +
        contexto_secoes_anteriores.map((s: { titulo: string; conteudo: string }) =>
          `--- ${s.titulo} ---\n${s.conteudo?.substring(0, 500)}...`
        ).join("\n\n");
    }

    const prompt = `Você está redigindo a seção "${secao.titulo}" de ${
      tipo_peticao === "pedido_administrativo" ? "um PEDIDO ADMINISTRATIVO DE ALONGAMENTO DE DÍVIDA RURAL dirigido ao banco/cooperativa de crédito" :
      tipo_peticao === "cautelar_antecedente" ? "uma PETIÇÃO DE TUTELA CAUTELAR EM CARÁTER ANTECEDENTE (art. 305 CPC) para forçar resposta do banco antes da ação principal" :
      tipo_peticao === "mandamental_alongamento" ? "uma AÇÃO DE OBRIGAÇÃO DE FAZER COM TUTELA MANDAMENTAL DE ALONGAMENTO de dívida rural" :
      tipo_peticao === "embargos_execucao" ? "uma petição de EMBARGOS À EXECUÇÃO de cédula de crédito rural (defesa do produtor), com desenvolvimento aprofundado das teses selecionadas" :
      tipo_peticao === "peticao_inicial" ? "uma PETIÇÃO INICIAL de Ação de Obrigação de Fazer c/c Tutela de Urgência" :
      tipo_peticao === "tutela_urgencia" ? "uma PETIÇÃO DE TUTELA DE URGÊNCIA ANTECIPADA" :
      "uma MANIFESTAÇÃO NOS AUTOS"
    }.

${contexto}
${contextoPrevio}

INSTRUÇÃO PARA ESTA SEÇÃO:
${secao.instrucao}

REGRAS:
- Escreva APENAS esta seção, sem cabeçalhos de outras seções
- Use linguagem jurídica formal brasileira, densa e profissional
- NÃO use formatação markdown (sem **, ##, etc.)
- Seja extenso e detalhado (mínimo 800 palavras para seções de fatos/direito)
- Cite legislação, jurisprudência e doutrina quando aplicável
- Mantenha coerência com as seções anteriores`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um advogado agrarista brasileiro de alto nível, especialista em crédito rural, MCR 2.6.4, Súmula 298 do STJ e legislação agrária. Redija seções de peças jurídicas com densidade técnica, fundamentação legislativa e jurisprudencial. Responda APENAS com o texto da seção, sem explicações. NÃO use markdown.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 8000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errText = await response.text();
      console.error("AI error:", status, errText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Aguarde e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Erro ao gerar seção com IA");
    }

    const aiData = await response.json();
    const conteudo = aiData.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({
        success: true,
        secao: {
          index: secao_index,
          titulo: secao.titulo,
          conteudo,
        },
      }),
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
