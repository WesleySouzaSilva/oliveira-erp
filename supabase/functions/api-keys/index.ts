import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { encode as base64Encode } from "https://deno.land/std@0.192.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashKey(key: string): Promise<string> {
  const enc = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const b64 = base64Encode(arr).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `oa_live_${b64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Missing authorization header" }, 401);

  const supabase = createClient(supabaseUrl, supabaseServiceRole);

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: "Unauthorized", detail: userErr?.message }, 401);

  const url = new URL(req.url);
  const method = req.method;

  // GET /api-keys → listar chaves da org (excluindo revogadas)
  if (method === "GET") {
    const { data: membros, error: memErr } = await supabase
      .from("membros")
      .select("organizacao_id")
      .eq("user_id", user.id);
    if (memErr) return json({ error: memErr.message }, 500);
    const orgIds = membros?.map((m) => m.organizacao_id) || [];
    if (orgIds.length === 0) return json({ keys: [] });

    const { data: keys, error } = await supabase
      .from("api_keys")
      .select("id, nome, key_prefix, scopes, last_used_at, expires_at, created_at, revoked_at, organizacao_id")
      .in("organizacao_id", orgIds)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) return json({ error: error.message }, 500);
    return json({ keys });
  }

  // POST /api-keys → criar nova chave
  if (method === "POST") {
    const body = await req.json().catch(() => ({}));
    const nome = String(body.nome || "").trim();
    const scopes = Array.isArray(body.scopes) ? body.scopes : ["read"];
    const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;

    if (!nome || nome.length < 2) return json({ error: "Nome é obrigatório (mín. 2 caracteres)." }, 400);
    if (nome.length > 60) return json({ error: "Nome muito longo (máx. 60 caracteres)." }, 400);

    // Determina org do usuário
    const { data: membro, error: memErr } = await supabase
      .from("membros")
      .select("organizacao_id, papel")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (memErr || !membro) return json({ error: "Usuário não pertence a uma organização." }, 403);
    if (membro.papel !== "admin") {
      return json({ error: "Apenas administradores podem criar chaves de API." }, 403);
    }

    const rawKey = generateKey();
    const keyHash = await hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    const { data: inserted, error: insErr } = await supabase
      .from("api_keys")
      .insert({
        organizacao_id: membro.organizacao_id,
        user_id: user.id,
        nome,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes,
        expires_at: expiresAt,
      })
      .select("id, nome, key_prefix, scopes, expires_at, created_at")
      .single();

    if (insErr) return json({ error: insErr.message }, 500);

    return json({
      key: rawKey, // mostrado UMA VEZ
      record: inserted,
    });
  }

  // DELETE /api-keys?id=<uuid> → revogar
  if (method === "DELETE") {
    let id = url.searchParams.get("id");
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body?.id ?? null;
    }
    if (!id) return json({ error: "Parâmetro id obrigatório." }, 400);

    const { data: membro } = await supabase
      .from("membros")
      .select("organizacao_id, papel")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!membro) return json({ error: "Unauthorized" }, 403);

    const { data: keyRow } = await supabase
      .from("api_keys")
      .select("id, user_id, organizacao_id")
      .eq("id", id)
      .single();
    if (!keyRow) return json({ error: "Chave não encontrada." }, 404);

    const isAdmin = membro.papel === "admin";
    const isOwner = keyRow.user_id === user.id;
    const sameOrg = membro.organizacao_id === keyRow.organizacao_id;

    if (!sameOrg || (!isOwner && !isAdmin)) {
      return json({ error: "Sem permissão para revogar esta chave." }, 403);
    }

    const { error: updErr } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);

    if (updErr) return json({ error: updErr.message }, 500);
    return json({ revoked: true });
  }

  return json({ error: "Method not allowed" }, 405);
});
