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

    // valida JWT via getUser (NÃO getClaims)
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData } = await callerClient.auth.getUser();
    const caller = callerData?.user;
    if (!caller) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const { cliente_id, email, nome, origin } = body as {
      cliente_id?: string; email?: string; nome?: string; origin?: string;
    };
    if (!cliente_id || !email) return json({ error: "cliente_id e email são obrigatórios" }, 400);

    // Para onde o link do e-mail leva: a tela de criar senha do PORTAL.
    // Só aceita origem http(s) enviada pelo app; o Supabase ainda valida contra
    // a lista de redirects permitidos do projeto.
    const origemOk = typeof origin === "string" && /^https?:\/\/[^\s/]+$/.test(origin);
    const redirectTo = origemOk ? `${origin}/portal/definir-senha` : undefined;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Cliente existe? Pega organizacao_id
    const { data: cliente } = await admin
      .from("clientes")
      .select("id, organizacao_id, email, nome")
      .eq("id", cliente_id)
      .maybeSingle();
    if (!cliente || !cliente.organizacao_id) {
      return json({ error: "Cliente não encontrado ou sem organização" }, 404);
    }

    // 2. Chamador é membro admin/coordenador da org do cliente?
    const { data: callerMembro } = await admin
      .from("membros")
      .select("papel")
      .eq("user_id", caller.id)
      .eq("organizacao_id", cliente.organizacao_id)
      .maybeSingle();
    if (!callerMembro) return json({ error: "Você não pertence à organização deste cliente" }, 403);
    if (!["admin", "coordenador"].includes(String(callerMembro.papel))) {
      return json({ error: "Apenas admin ou coordenador pode convidar clientes ao portal" }, 403);
    }

    // 3. Acha ou cria o usuário no auth (NUNCA insere em membros)
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (existing) {
      userId = existing.id;
      // bloqueia se já for membro interno
      const { data: jaMembro } = await admin
        .from("membros").select("id").eq("user_id", userId).limit(1);
      if (jaMembro && jaMembro.length > 0) {
        return json({ error: "Este e-mail já é de um membro interno do escritório e não pode ser usado no portal." }, 409);
      }
      // bloqueia se já for portal empresa
      const { data: jaEmpresa } = await admin
        .from("empresa_portal_usuarios").select("id").eq("user_id", userId).limit(1);
      if (jaEmpresa && jaEmpresa.length > 0) {
        return json({ error: "Este e-mail já está vinculado ao portal EMPRESARIAL." }, 409);
      }
    } else {
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nome: nome || cliente.nome || email, portal_cliente: true, cliente_id },
      });
      if (cErr || !created?.user) return json({ error: cErr?.message || "Erro ao criar usuário" }, 400);
      userId = created.user.id;
    }

    // 4. Insere/atualiza cliente_portal_usuarios. Idempotente.
    const { data: jaPortal } = await admin
      .from("cliente_portal_usuarios")
      .select("id, cliente_id, ativo")
      .eq("user_id", userId)
      .maybeSingle();

    if (jaPortal) {
      if (jaPortal.cliente_id !== cliente_id) {
        return json({ error: "Este e-mail já está vinculado a outro cliente do portal." }, 409);
      }
      if (!jaPortal.ativo) {
        await admin.from("cliente_portal_usuarios").update({ ativo: true }).eq("id", jaPortal.id);
      }
    } else {
      const { error: insErr } = await admin.from("cliente_portal_usuarios").insert({
        organizacao_id: cliente.organizacao_id,
        cliente_id,
        user_id: userId,
        convidado_por: caller.id,
        ativo: true,
      });
      if (insErr) return json({ error: insErr.message }, 400);
    }

    // 5. Link para o cliente criar a senha (primeiro acesso ou reenvio).
    //    Cai em /portal/definir-senha, que salva a senha e entra no portal.
    let emailEnviado = false;
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify(redirectTo ? { email, redirect_to: redirectTo } : { email }),
      });
      emailEnviado = r.ok;
      if (!r.ok) console.error("[portal-cliente-convidar] recover falhou", r.status, await r.text().catch(() => ""));
    } catch (e) {
      console.error("[portal-cliente-convidar] recover threw", (e as Error)?.message);
    }

    return json({ success: true, user_id: userId, email_enviado: emailEnviado, ja_existia: !!existing });
  } catch (e) {
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});