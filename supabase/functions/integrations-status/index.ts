import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type Result = {
  id: string;
  name: string;
  category: string;
  description: string;
  configured: boolean;
  status: "ok" | "error" | "not_configured" | "skipped";
  message?: string;
  latency_ms?: number;
  docs_url?: string;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: string; ms: number }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { value, ms: Date.now() - t0 };
  } catch (e: any) {
    return { error: String(e?.message || e), ms: Date.now() - t0 };
  }
}

async function checkAdvbox(token?: string): Promise<Partial<Result>> {
  if (!token) return { configured: false, status: "not_configured" };
  const r = await timed(async () => {
    // /settings é o endpoint mais leve e é o mesmo usado pelo advbox-sync
    const res = await fetch("https://app.advbox.com.br/api/v1/settings", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Token Advbox inválido ou expirado (HTTP " +
          res.status +
          "). Gere um novo token em Advbox › Configurações › API e atualize o segredo ADVBOX_API_TOKEN."
      );
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  });
  return {
    configured: true,
    status: r.error ? "error" : "ok",
    message: r.error || "Token Advbox válido.",
    latency_ms: r.ms,
  };
}

async function checkMetaAds(token?: string): Promise<Partial<Result>> {
  if (!token) return { configured: false, status: "not_configured" };
  const r = await timed(async () => {
    // Usa a mesma versão e endpoint do meta-ads-sync (tokens de System User não
    // respondem a /me, mas respondem a /me/adaccounts).
    const qs = new URLSearchParams({
      fields: "id,account_id,name,account_status",
      limit: "1",
      access_token: token,
    });
    const res = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?${qs}`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) {
      const msg = j?.error?.message || `HTTP ${res.status}`;
      const code = j?.error?.code;
      if (code === 190) {
        throw new Error(
          "Token Meta Ads expirado/inválido. Gere um novo token de System User com as permissões ads_read + business_management e atualize META_ADS_ACCESS_TOKEN."
        );
      }
      throw new Error(
        `${msg} — verifique se o app Meta está em modo Live e se o token tem as permissões ads_read e business_management.`
      );
    }
    const n = Array.isArray(j?.data) ? j.data.length : 0;
    return n;
  });
  return {
    configured: true,
    status: r.error ? "error" : "ok",
    message: r.error || "Token Meta Ads válido.",
    latency_ms: r.ms,
  };
}

async function checkAnthropic(key?: string): Promise<Partial<Result>> {
  if (!key) return { configured: false, status: "not_configured" };
  const r = await timed(async () => {
    // Valida a chave sem depender de um modelo específico (a conta pode não ter
    // acesso a um modelo fixo). /v1/models lista os modelos disponíveis.
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    const t = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
    let ids: string[] = [];
    try {
      ids = (JSON.parse(t)?.data ?? []).map((m: any) => m.id);
    } catch { /* ignore */ }
    return ids;
  });
  const ids = (r.value as string[] | undefined) ?? [];
  const usados = ["claude-sonnet-4-5-20250929"];
  const faltando = usados.filter((m) => ids.length > 0 && !ids.includes(m));
  return {
    configured: true,
    status: r.error ? "error" : "ok",
    message:
      r.error ||
      (faltando.length
        ? `Chave válida, mas a conta não tem acesso a: ${faltando.join(", ")}.`
        : `Chave Anthropic válida (${ids.length} modelos disponíveis).`),
    latency_ms: r.ms,
  };
}

async function checkLovableAI(key?: string): Promise<Partial<Result>> {
  if (!key) return { configured: false, status: "not_configured" };
  const r = await timed(async () => {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 4,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    return true;
  });
  return {
    configured: true,
    status: r.error ? "error" : "ok",
    message: r.error || "Lovable AI Gateway ativo.",
    latency_ms: r.ms,
  };
}

async function checkFirecrawl(key?: string): Promise<Partial<Result>> {
  if (!key) return { configured: false, status: "not_configured" };
  // Firecrawl é gerenciado pelo connector; só validamos a presença.
  return {
    configured: true,
    status: "ok",
    message: "Conector Firecrawl ativo (gerenciado pelo Lovable).",
  };
}

async function checkINMET(): Promise<Partial<Result>> {
  // API pública — não requer chave
  const r = await timed(async () => {
    const res = await fetch("https://apitempo.inmet.gov.br/estacoes/T", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  });
  return {
    configured: true,
    status: r.error ? "error" : "ok",
    message: r.error || "API INMET respondendo.",
    latency_ms: r.ms,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Só administradores autenticados podem sondar as integrações
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: authData } = token
      ? await authClient.auth.getUser(token)
      : { data: { user: null } };
    if (!authData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: membrosCaller } = await admin
      .from("membros").select("papel").eq("user_id", authData.user.id);
    if (!(membrosCaller || []).some((m: { papel: string }) => m.papel === "admin")) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ADVBOX_API_TOKEN = Deno.env.get("ADVBOX_API_TOKEN");
    const META_ADS_ACCESS_TOKEN = Deno.env.get("META_ADS_ACCESS_TOKEN");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    const definitions: Array<{ meta: Result; check: () => Promise<Partial<Result>> }> = [
      {
        meta: {
          id: "advbox",
          name: "Advbox",
          category: "Jurídico",
          description: "Sincronização de clientes, processos, tarefas e agenda.",
          configured: false,
          status: "not_configured",
          docs_url: "https://app.advbox.com.br/",
        },
        check: () => checkAdvbox(ADVBOX_API_TOKEN),
      },
      {
        meta: {
          id: "meta_ads",
          name: "Meta Ads",
          category: "Marketing",
          description: "Importa métricas de campanhas Facebook/Instagram.",
          configured: false,
          status: "not_configured",
          docs_url: "https://business.facebook.com/",
        },
        check: () => checkMetaAds(META_ADS_ACCESS_TOKEN),
      },
      {
        meta: {
          id: "anthropic",
          name: "Anthropic Claude",
          category: "IA",
          description: "Modelos Claude para análises jurídicas avançadas.",
          configured: false,
          status: "not_configured",
          docs_url: "https://console.anthropic.com/",
        },
        check: () => checkAnthropic(ANTHROPIC_API_KEY),
      },
      {
        meta: {
          id: "lovable_ai",
          name: "Lovable AI Gateway",
          category: "IA",
          description: "Acesso a Gemini e GPT sem chave própria.",
          configured: false,
          status: "not_configured",
        },
        check: () => checkLovableAI(LOVABLE_API_KEY),
      },
      {
        meta: {
          id: "firecrawl",
          name: "Firecrawl",
          category: "Dados",
          description: "Web scraping de fontes agrícolas e jurídicas.",
          configured: false,
          status: "not_configured",
        },
        check: () => checkFirecrawl(FIRECRAWL_API_KEY),
      },
      {
        meta: {
          id: "inmet",
          name: "INMET",
          category: "Clima",
          description: "Dados climáticos oficiais (API pública).",
          configured: true,
          status: "ok",
        },
        check: () => checkINMET(),
      },
    ];

    const results = await Promise.all(
      definitions.map(async (d) => {
        const r = await d.check();
        return { ...d.meta, ...r } as Result;
      })
    );

    return new Response(JSON.stringify({ integrations: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[integrations-status]", e?.message || e);
    return new Response(
      JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});