import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Autorização: chamada de máquina (service role / segredo de cron) ou usuário autenticado
    const rawAuth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const maquina =
      (!!rawAuth && rawAuth === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ||
      (!!cronSecret && req.headers.get("x-cron-secret") === cronSecret);
    if (!maquina) {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      const { data: u } = rawAuth
        ? await authClient.auth.getUser(rawAuth)
        : { data: { user: null } };
      if (!u?.user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Rate limiting: max 10 calls per 60s
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _key: "gerar-acordos-recorrentes",
      _max_requests: 10,
      _window_seconds: 60,
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find recurring tasks that are due for regeneration
    const today = new Date().toISOString().split("T")[0];

    const { data: tarefasVencidas, error } = await supabase
      .from("acordos_tarefas")
      .select("*")
      .eq("recorrente", true)
      .eq("concluida", false)
      .lte("data_vencimento", today)
      .not("intervalo_recorrencia", "is", null);

    if (error) {
      console.error("Error fetching tasks:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;

    for (const tarefa of tarefasVencidas || []) {
      // Mark current as concluded with 'sem_resposta' if still pending
      await supabase
        .from("acordos_tarefas")
        .update({ concluida: true, status: "concluida", resultado_tentativa: "sem_resposta" })
        .eq("id", tarefa.id);

      // Calculate next date
      const nextDate = new Date(tarefa.data_vencimento);
      switch (tarefa.intervalo_recorrencia) {
        case "semanal": nextDate.setDate(nextDate.getDate() + 7); break;
        case "quinzenal": nextDate.setDate(nextDate.getDate() + 14); break;
        case "mensal": nextDate.setMonth(nextDate.getMonth() + 1); break;
      }

      // Calculate next proxima_geracao
      const proximaGeracao = new Date(nextDate);
      switch (tarefa.intervalo_recorrencia) {
        case "semanal": proximaGeracao.setDate(proximaGeracao.getDate() + 7); break;
        case "quinzenal": proximaGeracao.setDate(proximaGeracao.getDate() + 14); break;
        case "mensal": proximaGeracao.setMonth(proximaGeracao.getMonth() + 1); break;
      }

      const { error: insertError } = await supabase
        .from("acordos_tarefas")
        .insert({
          organizacao_id: tarefa.organizacao_id,
          contrato_id: tarefa.contrato_id,
          responsavel_id: tarefa.responsavel_id,
          titulo: tarefa.titulo,
          descricao: tarefa.descricao,
          nome_cliente: tarefa.nome_cliente,
          prioridade: tarefa.prioridade,
          data_vencimento: nextDate.toISOString().split("T")[0],
          recorrente: true,
          intervalo_recorrencia: tarefa.intervalo_recorrencia,
          proxima_geracao: proximaGeracao.toISOString().split("T")[0],
          tarefa_origem_id: tarefa.tarefa_origem_id || tarefa.id,
          created_by: tarefa.created_by,
        });

      if (!insertError) generated++;
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${tarefasVencidas?.length || 0} tasks, generated ${generated} new tasks`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
