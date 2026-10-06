import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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
      _key: "verificar-prazos",
      _max_requests: 10,
      _window_seconds: 60,
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all contratos with data_notificacao set (notificação enviada)
    const { data: contratos, error: fetchError } = await supabase
      .from("contratos_vencimentos")
      .select("*")
      .not("data_notificacao", "is", null);

    if (fetchError) throw fetchError;
    if (!contratos || contratos.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum contrato com notificação ativa", alertas: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let alertasCriados = 0;

    for (const contrato of contratos) {
      const dataNotificacao = new Date(contrato.data_notificacao);
      dataNotificacao.setHours(0, 0, 0, 0);

      // Prazo de 15 dias a partir da notificação
      const dataLimite = new Date(dataNotificacao);
      dataLimite.setDate(dataLimite.getDate() + 15);

      const diffMs = dataLimite.getTime() - hoje.getTime();
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Determine alert type based on remaining days
      let tipo: string | null = null;
      let mensagem: string | null = null;

      if (diasRestantes === 7) {
        tipo = "alerta_prazo";
        mensagem = `⚠️ Prazo de 7 dias: O contrato de ${contrato.nome_cliente} (${contrato.banco || "banco não informado"}) vence em 7 dias. Valor: R$ ${contrato.valor_total_operacao?.toLocaleString("pt-BR") || "N/A"}.`;
      } else if (diasRestantes === 3) {
        tipo = "alerta_prazo";
        mensagem = `🔴 Prazo crítico: O contrato de ${contrato.nome_cliente} (${contrato.banco || "banco não informado"}) vence em 3 dias! Ação imediata necessária.`;
      } else if (diasRestantes <= 0) {
        tipo = "alerta_prazo";
        mensagem = `🚨 PRAZO VENCIDO: O contrato de ${contrato.nome_cliente} (${contrato.banco || "banco não informado"}) venceu${diasRestantes < 0 ? ` há ${Math.abs(diasRestantes)} dia(s)` : " hoje"}! Providências urgentes.`;
      }

      if (!tipo || !mensagem) continue;

      // Check if this exact alert was already created today
      const inicioHoje = new Date(hoje);
      const fimHoje = new Date(hoje);
      fimHoje.setDate(fimHoje.getDate() + 1);

      const { data: existente } = await supabase
        .from("notificacoes_sistema")
        .select("id")
        .eq("user_id", contrato.user_id)
        .eq("tipo", tipo)
        .gte("created_at", inicioHoje.toISOString())
        .lt("created_at", fimHoje.toISOString())
        .ilike("mensagem", `%${contrato.nome_cliente}%`)
        .limit(1);

      if (existente && existente.length > 0) continue;

      // Insert notification using service role (bypasses RLS)
      const { error: insertError } = await supabase
        .from("notificacoes_sistema")
        .insert({
          user_id: contrato.user_id,
          tipo,
          mensagem,
          lida: false,
        });

      if (insertError) {
        console.error(`Erro ao criar notificação para ${contrato.nome_cliente}:`, insertError);
        continue;
      }

      // Update contrato status_prazo
      let statusPrazo = "no_prazo";
      if (diasRestantes <= 0) statusPrazo = "vencido";
      else if (diasRestantes <= 3) statusPrazo = "critico";
      else if (diasRestantes <= 7) statusPrazo = "atencao";

      await supabase
        .from("contratos_vencimentos")
        .update({ status_prazo: statusPrazo })
        .eq("id", contrato.id);

      alertasCriados++;
    }

    return new Response(
      JSON.stringify({
        message: `Verificação concluída. ${alertasCriados} alerta(s) criado(s).`,
        alertas: alertasCriados,
        contratos_verificados: contratos.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na verificação de prazos:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
