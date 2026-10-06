import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callClaude, mensagemErroFriendly } from "../_shared/ia-claude.ts";

// CORS headers definidos inline para evitar problemas de ByteString em alguns runtimes
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function extractDocxText(base64: string): Promise<string> {
  try {
    const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const mammoth: any = await import('npm:mammoth@1.8.0');
    const result = await mammoth.extractRawText({ buffer: bin });
    return (result?.value as string) || '';
  } catch (e) {
    console.error('mammoth error', e);
    return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      cliente_nome,
      tipo_contrato,
      contexto_adicional,
      data_assinatura_presumida,
      // legado (1 arquivo)
      arquivo_base64,
      arquivo_mime,
      arquivo_nome,
      // novo (vários arquivos)
      arquivos,
    } = body;

    type Arq = { base64: string; mime?: string; nome?: string };
    const lista: Arq[] = Array.isArray(arquivos) && arquivos.length > 0
      ? arquivos
      : (arquivo_base64 ? [{ base64: arquivo_base64, mime: arquivo_mime, nome: arquivo_nome }] : []);

    if (!cliente_nome || lista.length === 0) {
      return new Response(JSON.stringify({ error: 'Dados insuficientes' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (lista.length > 5) {
      return new Response(JSON.stringify({ error: 'Máximo de 5 contratos por análise.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Você é um advogado especialista em direito bancário e crédito rural brasileiro, com profundo conhecimento em contratos de financiamento agrícola, CCB, CPR, cédulas rurais e contratos bancários em geral. Você também conhece as taxas médias históricas divulgadas pelo Banco Central do Brasil (SGS/BACEN).

Ao receber um contrato para análise, você deve produzir um parecer jurídico estruturado em dois níveis:

NÍVEL 1 — RESUMO EXECUTIVO

Retorne um JSON com a seguinte estrutura exata:
{
  "identificacao": {
    "tipo_contrato": "",
    "credor": "",
    "devedor": "",
    "valor_principal": "",
    "prazo": "",
    "taxa_juros": "",
    "cet": "",
    "data_assinatura": "",
    "iof": "",
    "tarifas": "",
    "garantias_resumo": "",
    "numero_contrato": ""
  },
  "comparativo_bacen": {
    "cet_contratado_mensal": "",
    "cet_medio_bacen_periodo": "",
    "diferenca_percentual": "",
    "avaliacao": "abaixo_media|alinhado|acima_media|muito_acima_media",
    "observacao": ""
  },
  "semaforo": {
    "clausulas_abusivas": "verde|amarelo|vermelho",
    "garantias": "verde|amarelo|vermelho",
    "encargos": "verde|amarelo|vermelho",
    "cet_vs_mercado": "verde|amarelo|vermelho"
  },
  "citacoes": [
    { "tipo": "lei|sumula|jurisprudencia|resolucao", "referencia": "", "ementa_ou_descricao": "" }
  ],
  "recomendacao_curta": "",
  "classificacao": "favoravel|atencao|risco_elevado"
}

Para o comparativo BACEN, use como referencial as taxas médias de mercado divulgadas pelo Banco Central na data de assinatura do contrato, conforme modalidade identificada (crédito rural, capital de giro, financiamento de investimento, etc). Caso não seja possível determinar a data exata, use a data mais próxima disponível e indique isso no campo "observacao".

Critério de avaliação:
- "abaixo_media": CET contratado pelo menos 10% abaixo da média BACEN
- "alinhado": variação de até 10% para mais ou para menos
- "acima_media": entre 10% e 30% acima da média
- "muito_acima_media": mais de 30% acima da média

NÍVEL 2 — PARECER COMPLETO

Após o JSON, insira o marcador ---PARECER--- e então produza o parecer jurídico completo em texto corrido com as seções:
1. Qualificação do instrumento
2. Análise das taxas e encargos (CET, IOF, seguros embutidos)
3. Comparativo com taxas médias BACEN do período
4. Análise das garantias
5. Cláusulas de vencimento antecipado
6. Cláusulas restritivas ou abusivas
7. Fundamentos legais aplicáveis
8. Conclusão e recomendação de conduta

Cite sempre a legislação aplicável: Lei 4.728/65, Lei 8.929/94, Res. CMN 4.966/2021, CDC quando aplicável, e jurisprudência relevante do STJ. Seja objetivo, técnico e direto. Não use linguagem genérica. Identifique cláusulas específicas pelo número quando possível.

QUALIDADE DO DOCUMENTO (CRÍTICO):
- Se o PDF/imagem estiver com escaneamento ruim, ilegível, cortado, ou se você não conseguir ler com confiança dados essenciais (valor, taxa, datas, partes), NÃO INVENTE valores. Deixe os campos correspondentes como "ilegível" e preencha o campo "observacao" do comparativo_bacen explicando a limitação.
- Acrescente no parecer completo, no início, um aviso explícito: "ATENÇÃO: documento com qualidade insuficiente para leitura confiável de [campos]. Recomenda-se reenvio em PDF nativo ou nova digitalização."
- Se o operador informou "data presumida da assinatura", use-a no comparativo BACEN apenas como referência, e deixe registrado no campo "observacao" que a data foi informada pelo operador (não extraída do documento).

ANÁLISE DE MÚLTIPLOS CONTRATOS:
- Quando receber mais de um contrato do mesmo cliente, analise cada um individualmente E produza uma seção consolidada comparativa.
- No JSON, "identificacao" deve refletir o contrato MAIS RECENTE (maior data de assinatura) e adicione um campo "contratos_analisados" com array de objetos resumindo cada contrato: { "arquivo": "", "data_assinatura": "", "valor_principal": "", "taxa_juros": "", "cet": "" }.
- No parecer completo, adicione ao final uma seção "9. Análise comparativa entre contratos" mostrando evolução da dívida, repactuações, mudanças de garantias, encargos cumulativos e eventual indício de novação/anatocismo entre os instrumentos.
- O "semaforo" e "classificacao" devem refletir o pior cenário consolidado entre os contratos.

IMPORTANTE: No campo "citacoes" do JSON, liste APENAS referências reais e verificáveis (lei, súmula STJ/STF com número, ou acórdão com número de processo). Não invente jurisprudência. Se não tiver certeza absoluta de um número de processo, omita.

IDENTIFICAÇÃO AUTOMÁTICA DO TIPO DE CONTRATO (OBRIGATÓRIO):
- O operador NÃO informa mais o tipo do contrato. Você deve detectá-lo a partir do documento e preencher "identificacao.tipo_contrato" com a denominação técnica correta (ex.: "CCB — Cédula de Crédito Bancário", "CPR Financeira", "Cédula Rural Pignoratícia", "Contrato de Abertura de Crédito em Conta Corrente", "Capital de Giro PJ", "Cartão de Crédito — Fatura parcelada", "Cheque Especial", etc.).
- Identifique também a MODALIDADE BACEN aplicável (rural custeio PF/PJ, rural investimento, capital de giro, cartão rotativo, etc.) e use-a no comparativo de taxas.

DESCLASSIFICAÇÃO DE CRÉDITO URBANO PARA RURAL (CRÍTICO):
Muitos produtores rurais contratam, na prática, instrumentos urbanos (CCB de capital de giro, cheque especial, conta garantida, antecipação de recebíveis, financiamento de cartão de crédito, leasing comum) para custear ou investir na atividade rural — frequentemente porque o gerente do banco vedou ou dificultou o crédito rural subsidiado. Quando isso ocorrer, você DEVE:
1. Identificar e registrar no parecer completo, em seção própria intitulada "Possibilidade de desclassificação para crédito rural", os indícios coletados (destinação dos recursos, atividade do tomador, garantias agrárias oferecidas, época da contratação coincidente com safra, etc.).
2. Fundamentar com: Lei 4.829/1965 (institui o crédito rural — definição de operação rural pela DESTINAÇÃO dos recursos, não pela denominação do contrato), Lei 8.171/1991 (Política Agrícola), Manual de Crédito Rural (MCR) capítulos 1 e 2, Resolução CMN aplicável, e jurisprudência consolidada do STJ que reconhece a primazia da destinação sobre a forma (citar tese, sem inventar número de processo).
3. Indicar o efeito prático da desclassificação: aplicação das taxas controladas do crédito rural (PRONAF/PRONAMP/demais), limitação de encargos, vedação à capitalização mensal de juros (Súmula 93/STJ quando aplicável), e eventual revisão do CET com restituição/compensação dos valores pagos a maior.
4. Adicionar uma citação no JSON do tipo "lei" referenciando a Lei 4.829/1965 sempre que o pedido de desclassificação for cabível.
5. Acrescentar no JSON o campo "desclassificacao_rural": { "cabivel": true|false, "fundamento_resumo": "", "efeito_pratico": "" } dentro do objeto raiz. Quando não houver indício, retorne "cabivel": false e justifique brevemente.

No endereçamento de petições, dirija sempre ao juízo, nunca ao juiz pessoalmente. Não use travessões longos no meio de frases — escreva de forma direta e natural.`;

    const dataPresStr = data_assinatura_presumida ? `\nData presumida da assinatura (informada pelo operador): ${data_assinatura_presumida}` : '';
    const multiHint = lista.length > 1
      ? `\n\nMÚLTIPLOS CONTRATOS (${lista.length}): analise cada um e produza a seção comparativa consolidada conforme instruções.`
      : '';
    const tipoInformado = (tipo_contrato && tipo_contrato !== 'auto')
      ? `\nTipo informado pelo operador (apenas referência — você deve confirmar/corrigir pela leitura): ${tipo_contrato}`
      : '\nTipo do contrato: NÃO informado — identifique automaticamente a partir do documento.';
    const userTextBase = `Cliente: ${cliente_nome}${tipoInformado}
Contexto adicional: ${contexto_adicional?.trim() || 'Nenhum'}${dataPresStr}${multiHint}

Observação importante: o cliente é produtor rural. Avalie sempre, ao final, se há fundamento para pedir a desclassificação do contrato para enquadramento como crédito rural (Lei 4.829/65), especialmente em contratos urbanos (capital de giro, cartão, cheque especial, conta garantida) cuja destinação tenha sido a atividade agropecuária.`;

    // Constrói o content combinando todos os arquivos
    const content: any[] = [];
    content.push({ type: 'text', text: userTextBase });

    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      const nomeLower = (a.nome || '').toLowerCase();
      const isPdf = (a.mime || '').includes('pdf') || nomeLower.endsWith('.pdf');
      const isDocx = nomeLower.endsWith('.docx') || (a.mime || '').includes('officedocument.wordprocessingml');
      const isDoc = nomeLower.endsWith('.doc') && !isDocx;
      const rotulo = `CONTRATO ${i + 1} de ${lista.length} — ${a.nome || 'arquivo'}`;

      if (isPdf) {
        content.push({ type: 'text', text: `\n=== ${rotulo} ===` });
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: a.base64 },
        });
      } else if (isDocx) {
        const texto = await extractDocxText(a.base64);
        if (!texto || texto.length < 50) {
          return new Response(JSON.stringify({ error: `Não foi possível extrair texto do DOCX (${a.nome}). Exporte como PDF.` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        content.push({ type: 'text', text: `\n=== ${rotulo} (texto extraído do DOCX) ===\n${texto.slice(0, 180000)}` });
      } else if (isDoc) {
        return new Response(JSON.stringify({ error: `Formato .doc legado não suportado (${a.nome}). Converta para PDF ou DOCX.` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ error: `Formato não suportado (${a.nome}). Envie PDF ou DOCX.` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Identifica usuário/org
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    let userId: string | null = null;
    let orgId: string | null = null;
    try {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) {
        const sb = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data: u } = await sb.auth.getUser();
        userId = u?.user?.id || null;
        if (userId) {
          const { data: m } = await sb.from('membros').select('organizacao_id').eq('user_id', userId).maybeSingle();
          orgId = (m as any)?.organizacao_id || null;
        }
      }
    } catch (_) {}

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cria o job em status "pending" e processa em background para evitar timeout do gateway
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: job, error: jobErr } = await admin
      .from('analise_contrato_jobs')
      .insert({
        operador_id: userId,
        organizacao_id: orgId,
        status: 'processing',
        cliente_nome: cliente_nome,
      })
      .select('id')
      .single();
    if (jobErr || !job) {
      console.error('Erro criando job', jobErr);
      return new Response(JSON.stringify({ error: 'Falha ao iniciar análise.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const jobId = (job as any).id as string;

    const work = (async () => {
      try {
        const result = await callClaude({
          funcao: 'analise-contrato',
          modelo: 'claude-sonnet-4-5-20250929',
          system: systemPrompt,
          messages: [{ role: 'user', content }],
          max_tokens: 8000,
          temperature: 0.2,
          user_id: userId,
          organizacao_id: orgId,
        });
        if (!result.ok) {
          const msg = mensagemErroFriendly(result.status, result.erro);
          await admin.from('analise_contrato_jobs').update({
            status: 'error', error: msg, updated_at: new Date().toISOString(),
          }).eq('id', jobId);
          return;
        }
        await admin.from('analise_contrato_jobs').update({
          status: 'done',
          result_raw: result.text,
          provedor: result.provedor,
          modelo: result.modelo,
          updated_at: new Date().toISOString(),
        }).eq('id', jobId);
      } catch (e: any) {
        console.error('Job falhou', e);
        await admin.from('analise_contrato_jobs').update({
          status: 'error',
          error: e?.message || 'Erro desconhecido',
          updated_at: new Date().toISOString(),
        }).eq('id', jobId);
      }
    })();

    // @ts-ignore EdgeRuntime existe no runtime do Supabase
    if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any)?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work);
    } else {
      // fallback: não bloqueia a resposta
      work.catch((e) => console.error(e));
    }

    return new Response(JSON.stringify({ jobId }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('analise-contrato error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});