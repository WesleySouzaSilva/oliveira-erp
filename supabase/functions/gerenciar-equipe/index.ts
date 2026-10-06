import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, email, nome, papel, organizacao_id, membro_id, user_id } = await req.json();

    // Helper: caller must be admin of the given organization
    const assertAdmin = async (orgId: string) => {
      if (!orgId) return false;
      const { data } = await supabase
        .from("membros")
        .select("papel")
        .eq("user_id", caller.id)
        .eq("organizacao_id", orgId)
        .maybeSingle();
      return !!data && data.papel === "admin";
    };

    if (action === "list_accounts") {
      if (!(await assertAdmin(organizacao_id))) {
        return new Response(JSON.stringify({ error: "Apenas admins podem listar contas" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const users: any[] = [];
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        users.push(...(data?.users || []));
        if (!data?.users || data.users.length < 200) break;
      }

      const ids = users.map((u) => u.id);
      const [{ data: membros }, { data: profiles }, { data: portalCli }, { data: portalEmp }] = await Promise.all([
        supabase.from("membros").select("id, user_id, papel, organizacao_id, is_ceo").in("user_id", ids),
        supabase.from("profiles").select("id, nome, ativo").in("id", ids),
        supabase.from("cliente_portal_usuarios").select("user_id").in("user_id", ids),
        supabase.from("empresa_portal_usuarios").select("user_id").in("user_id", ids),
      ]);

      const byUser = <T extends { user_id?: string; id?: string }>(rows: T[] | null, key: "user_id" | "id") => {
        const m = new Map<string, T>();
        (rows || []).forEach((r) => m.set((r as any)[key], r));
        return m;
      };
      const memMap = byUser(membros as any, "user_id");
      const profMap = byUser(profiles as any, "id");
      const cliSet = new Set((portalCli || []).map((r: any) => r.user_id));
      const empSet = new Set((portalEmp || []).map((r: any) => r.user_id));

      const contas = users.map((u) => {
        const mem: any = memMap.get(u.id);
        const prof: any = profMap.get(u.id);
        const portal = cliSet.has(u.id) ? "cliente" : empSet.has(u.id) ? "empresa" : null;
        let situacao: string;
        if (mem && mem.organizacao_id === organizacao_id) situacao = "equipe";
        else if (mem) situacao = "outra_org";
        else if (portal) situacao = "portal";
        else situacao = "sem_vinculo";
        return {
          user_id: u.id,
          email: u.email,
          nome: prof?.nome || u.user_metadata?.nome || null,
          ativo: prof?.ativo !== false,
          email_confirmado: !!u.email_confirmed_at,
          criado_em: u.created_at,
          ultimo_acesso: u.last_sign_in_at || null,
          papel: mem?.papel || null,
          is_ceo: !!mem?.is_ceo,
          membro_id: mem?.id || null,
          portal,
          situacao,
        };
      });

      return new Response(JSON.stringify({ contas }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_ativo") {
      if (!(await assertAdmin(organizacao_id))) {
        return new Response(JSON.stringify({ error: "Apenas admins podem alterar contas" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!user_id) {
        return new Response(JSON.stringify({ error: "Conta obrigatória" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ativo = papel === "ativo";
      const { error: upErr } = await supabase.from("profiles").update({ ativo }).eq("id", user_id);
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "link") {
      if (!(await assertAdmin(organizacao_id))) {
        return new Response(JSON.stringify({ error: "Apenas admins podem vincular contas" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!user_id || !papel) {
        return new Response(JSON.stringify({ error: "Conta e cargo são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase
        .from("membros").select("id, organizacao_id").eq("user_id", user_id).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Esta conta já possui vínculo com uma organização" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: linkError } = await supabase
        .from("membros").insert({ user_id, organizacao_id, papel });
      if (linkError) {
        return new Response(JSON.stringify({ error: linkError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (nome) {
        await supabase.from("profiles").update({ nome }).eq("id", user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "setup_org") {
      const orgName = email;
      if (!orgName) {
        return new Response(JSON.stringify({ error: "Nome da organização é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingMembership } = await supabase
        .from("membros").select("id").eq("user_id", caller.id).limit(1);

      if (existingMembership && existingMembership.length > 0) {
        return new Response(JSON.stringify({ error: "Você já pertence a uma organização" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newOrg, error: orgError } = await supabase
        .from("organizacoes").insert({ nome: orgName }).select().single();

      if (orgError || !newOrg) {
        return new Response(JSON.stringify({ error: orgError?.message || "Erro ao criar organização" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: memError } = await supabase
        .from("membros").insert({ user_id: caller.id, organizacao_id: newOrg.id, papel: "admin" });

      if (memError) {
        await supabase.from("organizacoes").delete().eq("id", newOrg.id);
        return new Response(JSON.stringify({ error: memError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, organizacao_id: newOrg.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "invite") {
      // Check caller is admin of this org
      const { data: callerMembro } = await supabase
        .from("membros")
        .select("papel")
        .eq("user_id", caller.id)
        .eq("organizacao_id", organizacao_id)
        .single();

      if (!callerMembro || callerMembro.papel !== "admin") {
        return new Response(JSON.stringify({ error: "Apenas admins podem convidar membros" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === email);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create user with a random password (they'll set their own via reset link)
        const tempPassword = crypto.randomUUID() + "Aa1!";
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { nome: nome || email },
        });
        if (createError || !newUser.user) {
          return new Response(JSON.stringify({ error: createError?.message || "Erro ao criar usuário" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = newUser.user.id;

        // Set the name on the profile
        if (nome) {
          await supabase.from("profiles").update({ nome }).eq("id", userId);
        }
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("membros")
        .select("id")
        .eq("user_id", userId)
        .eq("organizacao_id", organizacao_id)
        .single();

      if (existingMember) {
        return new Response(JSON.stringify({ error: "Este usuário já é membro desta organização" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Add as member
      const { error: insertError } = await supabase.from("membros").insert({
        user_id: userId,
        organizacao_id,
        papel: papel || "agronomo",
      });

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send password reset email so the invited user can set their password (first access)
      const origin = req.headers.get("origin") || "https://pixel-perfect-replica-900.lovable.app";
      try {
        const recoveryRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
          },
          body: JSON.stringify({
            email,
            gotrue_meta_security: {},
            code_challenge: undefined,
            code_challenge_method: undefined,
          }),
        });
        if (!recoveryRes.ok) {
          const errText = await recoveryRes.text();
          console.error("Failed to send recovery email:", errText);
        }
      } catch (e) {
        console.error("Recovery email error:", e.message);
      }

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove") {
      // Check caller is admin
      const { data: callerMembro } = await supabase
        .from("membros")
        .select("papel")
        .eq("user_id", caller.id)
        .eq("organizacao_id", organizacao_id)
        .single();

      if (!callerMembro || callerMembro.papel !== "admin") {
        return new Response(JSON.stringify({ error: "Apenas admins podem remover membros" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Don't allow removing self
      const { data: targetMembro } = await supabase
        .from("membros")
        .select("user_id, organizacao_id")
        .eq("id", membro_id)
        .single();

      // O membro alvo precisa ser da MESMA organização do admin
      if (!targetMembro || targetMembro.organizacao_id !== organizacao_id) {
        return new Response(JSON.stringify({ error: "Membro não pertence a esta organização" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (targetMembro?.user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode se remover da organização" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await supabase
        .from("membros")
        .delete()
        .eq("id", membro_id)
        .eq("organizacao_id", organizacao_id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_account") {
      // Remove conta duplicada/inválida por completo (auth + profile).
      // Somente admin, nunca a si mesmo, e só contas sem vínculo operacional.
      const targetId = String(user_id ?? "");
      if (!targetId) {
        return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: orgs } = await supabase
        .from("membros").select("organizacao_id").eq("user_id", caller.id);
      const callerOrgs = (orgs ?? []).map((o: { organizacao_id: string }) => o.organizacao_id);
      let isAdmin = false;
      for (const o of callerOrgs) { if (await assertAdmin(o)) { isAdmin = true; break; } }
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas admins podem excluir contas" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (targetId === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode excluir a própria conta" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [{ count: cMembros }, { count: cTarefas }, { data: prof }] = await Promise.all([
        supabase.from("membros").select("id", { count: "exact", head: true }).eq("user_id", targetId),
        supabase.from("tarefas").select("id", { count: "exact", head: true }).eq("responsavel_id", targetId),
        supabase.from("profiles").select("ativo, nome").eq("id", targetId).maybeSingle(),
      ]);
      if (!prof) {
        return new Response(JSON.stringify({ error: "Conta não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if ((cMembros ?? 0) > 0 || (cTarefas ?? 0) > 0 || prof.ativo) {
        return new Response(JSON.stringify({ error: "Conta tem vínculos ou está ativa: desative e desvincule antes de excluir" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("profiles").delete().eq("id", targetId);
      const { error: delErr } = await supabase.auth.admin.deleteUser(targetId);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, removido: prof.nome }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "update_role") {
      const { data: callerMembro } = await supabase
        .from("membros")
        .select("papel")
        .eq("user_id", caller.id)
        .eq("organizacao_id", organizacao_id)
        .single();

      if (!callerMembro || callerMembro.papel !== "admin") {
        return new Response(JSON.stringify({ error: "Apenas admins podem alterar papéis" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: alvo } = await supabase
        .from("membros")
        .select("organizacao_id")
        .eq("id", membro_id)
        .maybeSingle();
      if (!alvo || alvo.organizacao_id !== organizacao_id) {
        return new Response(JSON.stringify({ error: "Membro não pertence a esta organização" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("membros")
        .update({ papel })
        .eq("id", membro_id)
        .eq("organizacao_id", organizacao_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
