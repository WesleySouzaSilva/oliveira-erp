import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callClaude, mensagemErroFriendly } from "../_shared/ia-claude.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ---- Auth obrigatória: evita uso anônimo da função (consome créditos IA) ----
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const sbAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userErr } = await sbAuth.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authedUserId = userData.user.id;

    const body = await req.json();
    const { cliente_nome, tipo_contrato, resumo, parecer, mensagens, analise_id, arquivo_hash } = body;

    if (!parecer || !Array.isArray(mensagens) || mensagens.length === 0) {
      return new Response(JSON.stringify({ error: 'Contexto ou mensagens ausentes.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identifica usuário/org pra logging e persistência de chat
    let userId: string | null = authedUserId;
    let orgId: string | null = null;
    try {
      const { data: m } = await sbAuth.from('membros').select('organizacao_id').eq('user_id', userId).maybeSingle();
      orgId = (m as any)?.organizacao_id || null;
    } catch (_) {}

    const systemPrompt = `Você é o mesmo advogado especialista em direito bancário e crédito rural que produziu o parecer abaixo. O operador está conversando com você para esclarecer dúvidas, pedir aprofundamento de pontos, redigir trechos para petição, estimar valores ou explorar teses.

REGRAS:
- Responda em português técnico-jurídico, objetivo e direto. Sem floreios. Sem repetir o parecer inteiro.
- Sempre considere o parecer e o resumo já produzidos como verdade-base. Não contradiga sem motivo factual novo.
- Quando o operador pedir um trecho redigido (tese, pedido, fundamento), entregue pronto para colar — formatado em parágrafos jurídicos, com fundamentos legais quando cabível.
- Cite leis, súmulas e jurisprudência APENAS se reais e verificáveis. Em dúvida, omita o número e descreva a tese.
- Se a pergunta exigir dado que não está no parecer (ex.: valor exato pago, número de parcelas), peça ao operador para fornecer.
- Use markdown leve (negrito, listas) para legibilidade. Não use travessões longos.

CONTEXTO DO CASO:
Cliente: ${cliente_nome || '-'}
Tipo de contrato (detectado): ${tipo_contrato || '-'}

RESUMO ESTRUTURADO (JSON):
${JSON.stringify(resumo || {}, null, 2)}

PARECER COMPLETO:
${(parecer as string).slice(0, 60000)}`;

    const apiMessages = mensagens
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: m.content }));

    // Chat usa Haiku (rápido e barato); fallback automático para Gemini Flash via Lovable AI
    const result = await callClaude({
      funcao: 'analise-contrato-chat',
      modelo: 'claude-haiku-4-5-20251001',
      system: systemPrompt,
      messages: apiMessages,
      max_tokens: 2500,
      temperature: 0.3,
      user_id: userId,
      organizacao_id: orgId,
    });

    if (!result.ok) {
      const msg = mensagemErroFriendly(result.status, result.erro);
      return new Response(JSON.stringify({ error: msg }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      reply: result.text,
      provedor: result.provedor,
      modelo: result.modelo,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('analise-contrato-chat error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});