import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADVBOX_BASE = "https://app.advbox.com.br/api/v1";

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let pass = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const byte of arr) pass += chars[byte % chars.length];
  return pass;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
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

    // Só admin da organização pode importar (cria contas e insere dados)
    const ORG_ID = "c937a42c-a30b-4c80-a595-7887926683fd"; // Oliveira Advogados
    const { data: callerMembro } = await supabase
      .from("membros")
      .select("papel")
      .eq("user_id", caller.id)
      .eq("organizacao_id", ORG_ID)
      .maybeSingle();
    if (!callerMembro || callerMembro.papel !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem importar do Advbox" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();

    if (action === "import_users") {
      const ADVBOX_TOKEN = Deno.env.get("ADVBOX_API_TOKEN")!;

      // Get Advbox users from settings
      const settingsRes = await fetch(`${ADVBOX_BASE}/settings`, {
        headers: {
          Authorization: `Bearer ${ADVBOX_TOKEN}`,
          Accept: "application/json",
          "User-Agent": "OliveiraAgroApp/1.0",
        },
      });
      const settings = await settingsRes.json();
      const advboxUsers = settings.users || [];

      // Get existing profiles
      const { data: existingProfiles } = await supabase
        .from("profiles")
        .select("id, nome");

      // Get existing auth users by listing all
      const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 100 });
      const existingEmails = new Set(
        (authUsers?.users || []).map((u: any) => u.email?.toLowerCase())
      );

      const orgId = ORG_ID;
      const results: Array<{ name: string; email: string; status: string; advbox_id: number }> = [];
      const userIdMap: Record<number, string> = {}; // advbox_id -> app user_id

      // Map existing users by matching email or name
      for (const advUser of advboxUsers) {
        if (advUser.email?.includes("@SUPORTEADVBOX.COM.BR")) continue;
        const email = advUser.email?.toLowerCase();

        const existingAuth = (authUsers?.users || []).find(
          (u: any) => u.email?.toLowerCase() === email
        );

        if (existingAuth) {
          userIdMap[advUser.id] = existingAuth.id;
          results.push({
            name: advUser.name,
            email: email,
            status: "já cadastrado",
            advbox_id: advUser.id,
          });
          continue;
        }

        // Create new user
        const password = generatePassword();
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: { nome: advUser.name },
        });

        if (createErr || !newUser?.user) {
          results.push({
            name: advUser.name,
            email: email,
            status: `erro: ${createErr?.message || "unknown"}`,
            advbox_id: advUser.id,
          });
          continue;
        }

        // Update profile name
        await supabase.from("profiles").update({ nome: advUser.name }).eq("id", newUser.user.id);

        // Add as member of org
        await supabase.from("membros").insert({
          organizacao_id: orgId,
          user_id: newUser.user.id,
          papel: "assessor_juridico",
        });

        userIdMap[advUser.id] = newUser.user.id;
        results.push({
          name: advUser.name,
          email: email,
          status: "criado — peça ao usuário para definir a senha em \"Esqueci minha senha\"",
          advbox_id: advUser.id,
        });
      }

      return new Response(JSON.stringify({ users: results, userIdMap }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import_tasks") {
      const ADVBOX_TOKEN = Deno.env.get("ADVBOX_API_TOKEN")!;
      const orgId = ORG_ID;

      // Get Advbox settings for user mapping
      const settingsRes = await fetch(`${ADVBOX_BASE}/settings`, {
        headers: {
          Authorization: `Bearer ${ADVBOX_TOKEN}`,
          Accept: "application/json",
          "User-Agent": "OliveiraAgroApp/1.0",
        },
      });
      const settings = await settingsRes.json();

      // Map advbox user IDs to app user IDs by email
      const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 100 });
      const emailToUserId: Record<string, string> = {};
      for (const u of authUsers?.users || []) {
        if (u.email) emailToUserId[u.email.toLowerCase()] = u.id;
      }

      const advboxIdToAppId: Record<number, string> = {};
      for (const advUser of settings.users || []) {
        const email = advUser.email?.toLowerCase();
        if (email && emailToUserId[email]) {
          advboxIdToAppId[advUser.id] = emailToUserId[email];
        }
      }

      // Fetch pending tasks from Advbox (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const dateStart = sixMonthsAgo.toISOString().split("T")[0];
      const dateEnd = new Date().toISOString().split("T")[0];

      const tasksRes = await fetch(
        `${ADVBOX_BASE}/posts?date_start=${dateStart}&date_end=${dateEnd}&limit=100&offset=0`,
        {
          headers: {
            Authorization: `Bearer ${ADVBOX_TOKEN}`,
            Accept: "application/json",
            "User-Agent": "OliveiraAgroApp/1.0",
          },
        }
      );
      const tasksData = await tasksRes.json();
      const advboxTasks = tasksData?.data || [];

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const task of advboxTasks) {
        // Skip system alerts
        if (task.task === "ALERTA DE TAREFA EXCLUÍDA" || task.task === "COMENTÁRIO") continue;

        // Find the first pending user (not completed)
        const pendingUsers = (task.users || []).filter((u: any) => !u.completed);
        if (pendingUsers.length === 0) {
          skipped++;
          continue;
        }

        // Map to app user
        const firstPendingUser = pendingUsers[0];
        const appUserId = advboxIdToAppId[firstPendingUser.user_id];
        if (!appUserId) {
          skipped++;
          continue;
        }

        // Determine priority
        let prioridade = "normal";
        if (firstPendingUser.urgent === 1) prioridade = "urgente";
        else if (firstPendingUser.important === 1) prioridade = "alta";

        // Use date or created_at for vencimento
        const dataVenc = task.date_deadline || task.date || task.created_at?.split(" ")[0] || new Date().toISOString().split("T")[0];

        // Build title
        const titulo = task.task || "Tarefa Advbox";

        // Build description
        let descricao = task.notes || "";
        if (task.lawsuit?.process_number) {
          descricao += `\nProcesso: ${task.lawsuit.process_number}`;
        }
        if (task.lawsuit?.customers?.[0]?.name) {
          descricao += `\nCliente: ${task.lawsuit.customers[0].name}`;
        }

        const nomeCliente = task.lawsuit?.customers?.[0]?.name || null;

        const { error: insertErr } = await supabase.from("tarefas").insert({
          organizacao_id: orgId,
          responsavel_id: appUserId,
          created_by: appUserId,
          titulo: titulo,
          descricao: descricao.trim() || null,
          data_vencimento: dataVenc,
          prioridade: prioridade,
          concluida: false,
          nome_cliente: nomeCliente,
        });

        if (insertErr) {
          errors.push(`${titulo}: ${insertErr.message}`);
        } else {
          imported++;
        }
      }

      // Log
      const callerId = caller.id;
      await supabase.from("advbox_sync_log").insert({
        user_id: callerId,
        tipo_sync: "import_tasks",
        registros_sincronizados: imported,
        status: errors.length > 0 ? "parcial" : "concluido",
        erro: errors.length > 0 ? errors.join("; ") : null,
      });

      return new Response(
        JSON.stringify({
          imported,
          skipped,
          errors: errors.slice(0, 10),
          total_advbox: advboxTasks.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("advbox-import error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
