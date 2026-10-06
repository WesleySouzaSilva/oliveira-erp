import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callClaude, mensagemErroFriendly } from "../_shared/ia-claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const systemPrompt = `Você extrai dados de contratos bancários/rurais (CCB, cédula rural, extrato, print) para preencher um formulário de controle de vencimentos.
Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem comentários) no shape:
{
  "nome_cliente": string | null,
  "cpf_cnpj": string | null,
  "banco": string | null,
  "numero_contrato": string | null,
  "primeiro_vencimento": "YYYY-MM-DD" | null,
  "vencimento_proxima_parcela": "YYYY-MM-DD" | null,
  "vencimento_ultima_parcela": "YYYY-MM-DD" | null,
  "data_limite_protocolo": "YYYY-MM-DD" | null,
  "valor_parcela": number | null,
  "valor_total_operacao": number | null,
  "parcelas_vencidas": boolean | null,
  "possui_laudo": boolean | null,
  "protocolo_realizado": boolean | null,
  "observacoes": string | null
}
REGRAS:
- Datas SEMPRE no formato ISO YYYY-MM-DD. Converta datas em português (ex: "15/03/2025" -> "2025-03-15").
- Valores numéricos puros em reais (ex: 12345.67), sem "R$" nem separadores de milhar.
- Se um campo NÃO estiver explícito ou você não tiver alta confiança, devolva null. NÃO invente.
- "nome_cliente": nome do EMITENTE/devedor/tomador/mutuário (pessoa física ou jurídica). SEMPRE procure — em CCBs aparece em "Emitente", "Devedor", "Mutuário", "Financiado" ou no quadro de qualificação das partes. Nunca devolva o nome do banco aqui.
- "cpf_cnpj": CPF ou CNPJ do emitente/devedor, só os dígitos (ex: "03281535836").
- VENCIMENTO é campo crítico: procure em TODO o documento por "Vencimento", "Data de vencimento", "Vencimento final", "Vencimento da 1ª parcela", quadro/tabela de parcelas, cronograma de pagamento ou plano de amortização.
  - "primeiro_vencimento": a primeira data de vencimento do plano de pagamento.
  - "vencimento_ultima_parcela": vencimento final / última parcela.
  - "vencimento_proxima_parcela": a próxima parcela a vencer relativa à data de hoje, se identificável; senão null.
  - Se houver uma única data de vencimento no documento, coloque-a em "primeiro_vencimento" E em "vencimento_ultima_parcela".
- "banco": instituição credora (ex: "Banco do Brasil", "Sicredi", "Sicoob", "Cresol", "Bradesco").
- "observacoes": resumo curto (máx 300 chars) com info útil que não cabe nos outros campos (modalidade, garantias, taxas).
- NUNCA inclua texto fora do JSON.`;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: u, error: authErr } = await sb.auth.getUser();
    const userId = u?.user?.id || null;
    if (authErr || !userId) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let orgId: string | null = null;
    try {
      const { data: m } = await sb.from("membros").select("organizacao_id").eq("user_id", userId).maybeSingle();
      orgId = (m as any)?.organizacao_id || null;
    } catch (_) {}

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Payload inválido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { arquivo_base64, arquivo_mime, arquivo_nome } = body as {
      arquivo_base64?: string; arquivo_mime?: string; arquivo_nome?: string;
    };
    if (!arquivo_base64 || typeof arquivo_base64 !== "string") {
      return new Response(JSON.stringify({ error: "Arquivo não enviado." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limite real do gateway de Edge Functions ~10MB no body; base64 cresce ~33%.
    // Mantemos ≤ 8MB base64 (≈ 6MB de arquivo) para evitar rejeição na borda.
    if (arquivo_base64.length > 8 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Arquivo muito grande (máx 6MB). Reduza/recorte o documento e tente novamente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nomeLower = (arquivo_nome || "").toLowerCase();
    const mime = (arquivo_mime || "").toLowerCase();
    const isPdf = mime.includes("pdf") || nomeLower.endsWith(".pdf");
    const isJpeg = mime.includes("jpeg") || mime.includes("jpg") || nomeLower.endsWith(".jpg") || nomeLower.endsWith(".jpeg");
    const isPng = mime.includes("png") || nomeLower.endsWith(".png");
    const isWebp = mime.includes("webp") || nomeLower.endsWith(".webp");

    if (!isPdf && !isJpeg && !isPng && !isWebp) {
      return new Response(JSON.stringify({ error: "Formato não suportado. Envie PDF, JPG ou PNG." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caminho ativo: Claude (Anthropic direto) suporta PDF nativamente via bloco
    // type:"document". Sem lib de parse no Edge — evita falha de boot.
    // Para imagem, usamos bloco type:"image". Se cair no fallback Lovable
    // (gateway só-texto), só imagens com OCR no provedor funcionariam; para
    // PDF nesse cenário pedimos ao usuário enviar foto/print.
    const hasAnthropic = !!(Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
    if (isPdf && !hasAnthropic) {
      return new Response(JSON.stringify({
        error: "Leitura de PDF temporariamente indisponível. Envie uma foto ou print das páginas principais do contrato.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const content: any[] = [{
      type: "text",
      text: "Extraia os dados deste contrato e responda APENAS com o JSON especificado.",
    }];

    if (isPdf) {
      // PDF direto para o Claude (Anthropic).
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: arquivo_base64,
        },
      });
    } else {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg",
          data: arquivo_base64,
        },
      });
    }

    const result = await callClaude({
      funcao: "extrair-contrato-vencimento",
      system: systemPrompt,
      messages: [{ role: "user", content }],
      max_tokens: 1500,
      temperature: 0.1,
      user_id: userId,
      organizacao_id: orgId,
    });

    if (!result.ok) {
      // Se o PDF caiu no fallback Lovable (que descarta blocos não-texto),
      // o usuário precisa enviar imagem.
      if (isPdf && result.provedor === "lovable") {
        return new Response(JSON.stringify({
          error: "A IA principal está indisponível e o leitor de PDF do fallback não suporta este formato. Envie uma foto/print das páginas principais do contrato.",
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: mensagemErroFriendly(result.status, result.erro) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenta extrair JSON do texto retornado
    let parsed: any = null;
    const txt = (result.text || "").trim();
    try {
      parsed = JSON.parse(txt);
    } catch {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (_) {}
      }
    }
    if (!parsed || typeof parsed !== "object") {
      return new Response(JSON.stringify({
        error: "Não foi possível interpretar a resposta da IA. Tente novamente ou preencha manualmente.",
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const norm = (v: any) => (v === undefined || v === "" || v === "null") ? null : v;
    const dados = {
      nome_cliente: norm(parsed.nome_cliente),
      cpf_cnpj: typeof parsed.cpf_cnpj === "string" ? parsed.cpf_cnpj.replace(/\D/g, "") || null : null,

      banco: norm(parsed.banco),
      numero_contrato: norm(parsed.numero_contrato),
      primeiro_vencimento: norm(parsed.primeiro_vencimento),
      vencimento_proxima_parcela: norm(parsed.vencimento_proxima_parcela),
      vencimento_ultima_parcela: norm(parsed.vencimento_ultima_parcela),
      data_limite_protocolo: norm(parsed.data_limite_protocolo),
      valor_parcela: typeof parsed.valor_parcela === "number" ? parsed.valor_parcela : null,
      valor_total_operacao: typeof parsed.valor_total_operacao === "number" ? parsed.valor_total_operacao : null,
      parcelas_vencidas: typeof parsed.parcelas_vencidas === "boolean" ? parsed.parcelas_vencidas : null,
      possui_laudo: typeof parsed.possui_laudo === "boolean" ? parsed.possui_laudo : null,
      protocolo_realizado: typeof parsed.protocolo_realizado === "boolean" ? parsed.protocolo_realizado : null,
      observacoes: norm(parsed.observacoes),
    };

    return new Response(JSON.stringify({ ok: true, dados, provedor: result.provedor }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("extrair-contrato-vencimento erro", e?.message);
    return new Response(JSON.stringify({ error: "Erro ao processar o documento." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});