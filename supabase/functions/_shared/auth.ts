import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/**
 * Valida o JWT do chamador. Retorna o usuário ou null.
 * Usa supabase.auth.getUser(token) — NUNCA getClaims (não existe em todas as versões).
 */
export async function getCaller(req: Request) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export function unauthorized(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: "Não autorizado" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function forbidden(corsHeaders: Record<string, string>, msg = "Sem permissão") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** IDs das organizações do usuário. */
export async function orgIdsDoUsuario(userId: string): Promise<string[]> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await admin.from("membros").select("organizacao_id").eq("user_id", userId);
  return (data || []).map((m: { organizacao_id: string }) => m.organizacao_id);
}

/** Verifica se o usuário é admin em alguma (ou na dada) organização. */
export async function ehAdmin(userId: string, orgId?: string): Promise<boolean> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let q = admin.from("membros").select("papel, organizacao_id").eq("user_id", userId);
  if (orgId) q = q.eq("organizacao_id", orgId);
  const { data } = await q;
  return (data || []).some((m: { papel: string }) => m.papel === "admin");
}
