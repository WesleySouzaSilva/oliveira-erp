// Helper compartilhado: chama Claude com fallback automático para Lovable AI Gateway
// (Gemini Flash) em caso de 429/529/overloaded, e loga consumo em public.ia_consumo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type IaMsg = { role: "user" | "assistant"; content: any };

export type IaCallOpts = {
  funcao: string;
  modelo?: string;            // Claude model (default sonnet)
  fallbackModelo?: string;    // Lovable AI model
  system: string;
  messages: IaMsg[];
  max_tokens?: number;
  temperature?: number;
  tools?: any[];              // Anthropic-style; ignorado no fallback
  user_id?: string | null;
  organizacao_id?: string | null;
};

export type IaCallResult = {
  ok: boolean;
  text: string;
  raw: any;                   // resposta crua do provedor
  provedor: "anthropic" | "lovable";
  modelo: string;
  status: number;
  erro?: string;
  input_tokens: number;
  output_tokens: number;
};

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function logIaConsumo(params: {
  funcao: string;
  modelo: string;
  provedor: string;
  input_tokens?: number;
  output_tokens?: number;
  status: string;
  erro_codigo?: number | null;
  duracao_ms: number;
  user_id?: string | null;
  organizacao_id?: string | null;
  meta?: any;
}) {
  try {
    const sb = adminClient();
    const input = params.input_tokens || 0;
    const output = params.output_tokens || 0;
    await sb.from("ia_consumo").insert({
      funcao: params.funcao,
      modelo: params.modelo,
      provedor: params.provedor,
      input_tokens: input,
      output_tokens: output,
      total_tokens: input + output,
      status: params.status,
      erro_codigo: params.erro_codigo ?? null,
      duracao_ms: params.duracao_ms,
      user_id: params.user_id ?? null,
      organizacao_id: params.organizacao_id ?? null,
      meta: params.meta ?? null,
    });
  } catch (e) {
    console.error("logIaConsumo falhou", e);
  }
}

// Converte content blocks Anthropic em texto plano para o fallback Gemini
function flattenContentToText(c: any): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((b: any) => {
        if (typeof b === "string") return b;
        if (b?.type === "text") return b.text || "";
        if (b?.type === "tool_result") return `[resultado da ferramenta]: ${typeof b.content === "string" ? b.content : JSON.stringify(b.content)}`;
        if (b?.type === "tool_use") return `[chamou ferramenta ${b.name}]`;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

async function callLovableFallback(opts: IaCallOpts, startedAt: number): Promise<IaCallResult> {
  const LOVABLE_API_KEY = (Deno.env.get("LOVABLE_API_KEY") || "").trim();
  const modelo = opts.fallbackModelo || "google/gemini-3-flash-preview";
  if (!LOVABLE_API_KEY) {
    return {
      ok: false, text: "", raw: null, provedor: "lovable", modelo, status: 500,
      erro: "LOVABLE_API_KEY não configurada (fallback indisponível)",
      input_tokens: 0, output_tokens: 0,
    };
  }

  const msgs = opts.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: flattenContentToText(m.content) }))
    .filter((m) => m.content && m.content.length > 0);

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: "system", content: opts.system }, ...msgs],
      temperature: opts.temperature ?? 0.3,
      max_completion_tokens: opts.max_tokens ?? 2048,
    }),
  });

  const duracao = Date.now() - startedAt;

  if (!resp.ok) {
    const t = await resp.text();
    console.error("Lovable fallback falhou", resp.status, t.slice(0, 400));
    await logIaConsumo({
      funcao: opts.funcao, modelo, provedor: "lovable",
      status: "erro", erro_codigo: resp.status, duracao_ms: duracao,
      user_id: opts.user_id, organizacao_id: opts.organizacao_id,
      meta: { fallback: true, body: t.slice(0, 200) },
    });
    return { ok: false, text: "", raw: null, provedor: "lovable", modelo, status: resp.status, erro: t.slice(0, 300), input_tokens: 0, output_tokens: 0 };
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const usage = data?.usage || {};
  const input = usage.prompt_tokens || 0;
  const output = usage.completion_tokens || 0;

  await logIaConsumo({
    funcao: opts.funcao, modelo, provedor: "lovable",
    input_tokens: input, output_tokens: output,
    status: "fallback", duracao_ms: duracao,
    user_id: opts.user_id, organizacao_id: opts.organizacao_id,
  });

  return { ok: true, text, raw: data, provedor: "lovable", modelo, status: 200, input_tokens: input, output_tokens: output };
}

// Códigos da Anthropic em que vale a pena tentar fallback
function deveriaFazerFallback(status: number): boolean {
  return status === 429 || status === 529 || status === 503 || status === 500;
}

export async function callClaude(opts: IaCallOpts): Promise<IaCallResult> {
  const ANTHROPIC_API_KEY = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim().replace(/[^\x20-\x7E]/g, "");
  const modelo = opts.modelo || "claude-sonnet-4-5-20250929";
  const startedAt = Date.now();

  if (!ANTHROPIC_API_KEY) {
    // sem chave: vai direto pro fallback
    return await callLovableFallback(opts, startedAt);
  }

  const reqBody: any = {
    model: modelo,
    max_tokens: opts.max_tokens ?? 2048,
    temperature: opts.temperature ?? 0.3,
    system: opts.system,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (opts.tools && opts.tools.length > 0) reqBody.tools = opts.tools;

  let resp: Response;
  try {
    // Se algum bloco for "document" (PDF), adiciona header beta como precaução.
    const hasDocument = opts.messages.some((m) =>
      Array.isArray(m.content) && m.content.some((b: any) => b?.type === "document"),
    );
    const anthropicHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    };
    if (hasDocument) anthropicHeaders["anthropic-beta"] = "pdfs-2024-09-25";
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: anthropicHeaders,
      body: JSON.stringify(reqBody),
    });
  } catch (e: any) {
    console.error("Anthropic fetch network error, tentando fallback", e?.message);
    return await callLovableFallback(opts, startedAt);
  }

  const duracao = Date.now() - startedAt;

  if (!resp.ok) {
    const t = await resp.text();
    console.error("Anthropic erro", resp.status, t.slice(0, 400));
    await logIaConsumo({
      funcao: opts.funcao, modelo, provedor: "anthropic",
      status: "erro", erro_codigo: resp.status, duracao_ms: duracao,
      user_id: opts.user_id, organizacao_id: opts.organizacao_id,
      meta: { body: t.slice(0, 200) },
    });
    if (deveriaFazerFallback(resp.status)) {
      console.log("→ acionando fallback Lovable AI por", resp.status);
      return await callLovableFallback(opts, Date.now());
    }
    return { ok: false, text: "", raw: null, provedor: "anthropic", modelo, status: resp.status, erro: t.slice(0, 300), input_tokens: 0, output_tokens: 0 };
  }

  const data = await resp.json();
  const text = (data?.content || [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text || "")
    .join("");
  const usage = data?.usage || {};
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;

  await logIaConsumo({
    funcao: opts.funcao, modelo, provedor: "anthropic",
    input_tokens: input, output_tokens: output,
    status: "ok", duracao_ms: duracao,
    user_id: opts.user_id, organizacao_id: opts.organizacao_id,
  });

  return { ok: true, text, raw: data, provedor: "anthropic", modelo, status: 200, input_tokens: input, output_tokens: output };
}

// Mensagem amigável para retornar ao cliente quando tudo falhar
export function mensagemErroFriendly(status: number, erro?: string): string {
  if (status === 429) return "A IA está com muitas requisições agora. Tente novamente em alguns instantes.";
  if (status === 529 || status === 503) return "A IA está temporariamente sobrecarregada. Tente novamente em 30 segundos.";
  if (status === 401 || status === 403) return "Chave de IA inválida ou sem permissão. Contate o suporte.";
  if (status === 402) return "Crédito de IA esgotado. Adicione fundos no workspace.";
  return erro || "Falha ao consultar a IA. Tente novamente.";
}