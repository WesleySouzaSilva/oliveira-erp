import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    // valida JWT do chamador via getUser (NÃO getClaims)
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData } = await callerClient.auth.getUser();
    const caller = callerData?.user;
    if (!caller) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const { empresa_id, contato_id, email, nome } = body as {
      empresa_id?: string; contato_id?: string; email?: string; nome?: string;
    };
    if (!empresa_id || !email) return json({ error: "empresa_id e email são obrigatórios" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Empresa existe e pertence à org do chamador (que precisa ser membro admin/coordenador)
    const { data: empresa } = await admin
      .from("empresas_consultoria")
      .select("id, organizacao_id")
      .eq("id", empresa_id)
      .maybeSingle();
    if (!empresa) return json({ error: "Empresa não encontrada" }, 404);

    const { data: callerMembro } = await admin
      .from("membros")
      .select("papel")
      .eq("user_id", caller.id)
      .eq("organizacao_id", empresa.organizacao_id)
      .maybeSingle();
    if (!callerMembro) return json({ error: "Você não pertence à organização desta empresa" }, 403);
    if (!["admin", "coordenador"].includes(String(callerMembro.papel))) {
      return json({ error: "Apenas admin ou coordenador pode convidar usuários do portal" }, 403);
    }

    // 2. Acha ou cria o usuário no auth (NUNCA insere em membros)
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (existing) {
      userId = existing.id;
      // bloqueia se já for membro interno (não pode virar externo)
      const { data: jaMembro } = await admin
        .from("membros").select("id").eq("user_id", userId).limit(1);
      if (jaMembro && jaMembro.length > 0) {
        return json({ error: "Este e-mail já é de um membro interno do escritório e não pode ser usado no portal." }, 409);
      }
    } else {
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nome: nome || email, portal: true, empresa_id },
      });
      if (cErr || !created?.user) return json({ error: cErr?.message || "Erro ao criar usuário" }, 400);
      userId = created.user.id;
    }

    // 3. Insere/atualiza empresa_portal_usuarios. Idempotente.
    const { data: jaPortal } = await admin
      .from("empresa_portal_usuarios")
      .select("id, empresa_id, ativo")
      .eq("user_id", userId)
      .maybeSingle();

    if (jaPortal) {
      if (jaPortal.empresa_id !== empresa_id) {
        return json({ error: "Este e-mail já está vinculado a outra empresa do portal." }, 409);
      }
      if (!jaPortal.ativo) {
        await admin.from("empresa_portal_usuarios").update({ ativo: true }).eq("id", jaPortal.id);
      }
    } else {
      const { error: insErr } = await admin.from("empresa_portal_usuarios").insert({
        organizacao_id: empresa.organizacao_id,
        empresa_id,
        user_id: userId,
        contato_id: contato_id ?? null,
        convidado_por: caller.id,
        ativo: true,
      });
      if (insErr) return json({ error: insErr.message }, 400);
    }

    // 4. Envia recovery para o convidado definir a senha
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({ email }),
      });
    } catch (_) { /* não falha o fluxo */ }

    return json({ success: true, user_id: userId });
  } catch (e) {
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});