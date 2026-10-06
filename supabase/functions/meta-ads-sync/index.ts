import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_TOKEN = Deno.env.get("META_ADS_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GRAPH = "https://graph.facebook.com/v21.0";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function metaGet(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, access_token: META_TOKEN });
  const r = await fetch(`${GRAPH}/${path}?${qs}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Meta API erro ${r.status}`);
  return data;
}

async function listAdAccounts() {
  // Lista contas que o token (system user) tem acesso
  const data = await metaGet("me/adaccounts", {
    fields: "id,account_id,name,account_status,currency",
    limit: "100",
  });
  return data?.data ?? [];
}

async function listCampaigns(adAccountId: string) {
  const acc = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const data = await metaGet(`${acc}/campaigns`, {
    fields: "id,name,status,objective,effective_status",
    limit: "200",
  });
  return data?.data ?? [];
}

/**
 * Busca insights agregados da conta para uma data específica.
 * Se campaignIds for fornecido, filtra para apenas essas campanhas.
 * Retorna investimento/impressoes/alcance/cliques/leads.
 */
async function fetchInsightsForDate(
  adAccountId: string,
  date: string,
  campaignIds?: string[]
) {
  const acc = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const params: Record<string, string> = {
    fields: "spend,impressions,reach,clicks,actions",
    time_range: JSON.stringify({ since: date, until: date }),
  };
  if (campaignIds && campaignIds.length > 0) {
    params.level = "campaign";
    params.filtering = JSON.stringify([
      { field: "campaign.id", operator: "IN", value: campaignIds },
    ]);
  } else {
    params.level = "account";
  }
  const data = await metaGet(`${acc}/insights`, params);
  const rows: any[] = data?.data ?? [];
  const agg = { investimento: 0, impressoes: 0, alcance: 0, cliques: 0, leads: 0 };
  for (const row of rows) {
    agg.investimento += parseFloat(row.spend ?? "0");
    agg.impressoes += parseInt(row.impressions ?? "0", 10);
    agg.alcance += parseInt(row.reach ?? "0", 10);
    agg.cliques += parseInt(row.clicks ?? "0", 10);
    const actions: Array<{ action_type: string; value: string }> = row.actions ?? [];
    const lead =
      actions.find((a) => a.action_type === "lead") ||
      actions.find((a) => a.action_type === "onsite_conversion.lead_grouped") ||
      actions.find((a) => a.action_type?.includes("lead"));
    if (lead) agg.leads += parseInt(lead.value, 10);
  }
  return agg;
}

async function upsertLancamento(
  sb: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  nicho: string,
  date: string,
  metrics: { investimento: number; impressoes: number; alcance: number; cliques: number; leads: number }
) {
  // Marketing row = closer_id NULL e sdr_id NULL
  const { data: existing } = await sb
    .from("mkt_lancamentos_diarios")
    .select("id")
    .eq("organizacao_id", orgId)
    .eq("data", date)
    .eq("nicho", nicho)
    .is("closer_id", null)
    .is("sdr_id", null)
    .maybeSingle();

  const payload = {
    organizacao_id: orgId,
    user_id: userId,
    data: date,
    nicho,
    closer_id: null,
    sdr_id: null,
    investimento: metrics.investimento,
    impressoes: metrics.impressoes,
    alcance: metrics.alcance,
    cliques: metrics.cliques,
    leads_pagos: metrics.leads,
  };

  if (existing?.id) {
    const { error } = await sb
      .from("mkt_lancamentos_diarios")
      .update({
        investimento: payload.investimento,
        impressoes: payload.impressoes,
        alcance: payload.alcance,
        cliques: payload.cliques,
        leads_pagos: payload.leads_pagos,
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("mkt_lancamentos_diarios").insert(payload);
    if (error) throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error: userErr } = await authClient.auth.getUser(
      authHeader.replace(/^Bearer\s+/i, ""),
    );
    const callerId = userData?.user?.id;
    if (userErr || !callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Organizações do chamador — nenhuma ação pode sair delas
    const sbAuthz = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: membrosCaller } = await sbAuthz
      .from("membros").select("organizacao_id").eq("user_id", callerId);
    const callerOrgs = (membrosCaller ?? []).map((m: { organizacao_id: string }) => m.organizacao_id);
    if (callerOrgs.length === 0) {
      return new Response(JSON.stringify({ error: "Usuário não pertence a uma organização" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!META_TOKEN) throw new Error("META_ADS_ACCESS_TOKEN não configurado");

    const body = await req.json().catch(() => ({}));
    if (body.organizacao_id && !callerOrgs.includes(body.organizacao_id)) {
      return new Response(JSON.stringify({ error: "Sem permissão para esta organização" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const action: string = body.action || "sync_yesterday";
    const triggerTipo: "cron" | "manual" = body.trigger_tipo || "manual";
    const dataParam: string | undefined = body.data;

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // ---- ACTIONS ---------------------------------------------------------
    if (action === "test_connection") {
      const accounts = await listAdAccounts();
      return Response.json(
        { ok: true, total_accounts: accounts.length },
        { headers: corsHeaders }
      );
    }

    if (action === "list_ad_accounts") {
      const accounts = await listAdAccounts();
      return Response.json({ accounts }, { headers: corsHeaders });
    }

    if (action === "list_campaigns") {
      const adAccountId: string = body.ad_account_id;
      if (!adAccountId) throw new Error("ad_account_id é obrigatório");
      const campaigns = await listCampaigns(adAccountId);
      return Response.json({ campaigns }, { headers: corsHeaders });
    }

    // Agrega insights de um período (ex.: últimos 30/60/90 dias) somando todas as
    // contas/campanhas configuradas. Filtra por nicho se informado. NÃO grava nada.
    if (action === "aggregate_insights") {
      let since: string = body.since;
      const until: string = body.until;
      const nichoFilter: string | undefined = body.nicho;
      if (!since || !until) throw new Error("since e until são obrigatórios");

      let q = sb.from("mkt_meta_ads_config").select("*").eq("ativo", true)
        .in("organizacao_id", callerOrgs);
      if (body.organizacao_id) q = q.eq("organizacao_id", body.organizacao_id);
      if (nichoFilter) q = q.eq("nicho", nichoFilter);
      const { data: configs, error: cfgErr } = await q;
      if (cfgErr) throw cfgErr;

      // since === "auto" → descobre a data de criação mais antiga entre as contas envolvidas
      // (evita pedir "desde 2010" e estourar limites da API)
      if (since === "auto") {
        let mais_antiga: string | null = null;
        for (const cfg of configs ?? []) {
          try {
            const acc = String(cfg.ad_account_id).startsWith("act_")
              ? String(cfg.ad_account_id)
              : `act_${cfg.ad_account_id}`;
            const info = await metaGet(acc, { fields: "created_time" });
            const dt = info?.created_time ? String(info.created_time).slice(0, 10) : null;
            if (dt && (!mais_antiga || dt < mais_antiga)) mais_antiga = dt;
          } catch {
            // ignora — segue com fallback
          }
        }
        since = mais_antiga || "2015-01-01";
      }

      const agg = { investimento: 0, impressoes: 0, alcance: 0, cliques: 0, leads: 0 };
      const porConta: any[] = [];
      for (const cfg of configs ?? []) {
        try {
          const acc = String(cfg.ad_account_id).startsWith("act_")
            ? String(cfg.ad_account_id)
            : `act_${cfg.ad_account_id}`;
          const params: Record<string, string> = {
            fields: "spend,impressions,reach,clicks,actions",
            time_range: JSON.stringify({ since, until }),
          };
          const campIds = (cfg.campaign_ids ?? []) as string[];
          if (campIds.length > 0) {
            params.level = "campaign";
            params.filtering = JSON.stringify([
              { field: "campaign.id", operator: "IN", value: campIds },
            ]);
          } else {
            params.level = "account";
          }
          const data = await metaGet(`${acc}/insights`, params);
          const rows: any[] = data?.data ?? [];
          let inv = 0, imp = 0, alc = 0, cli = 0, ld = 0;
          for (const row of rows) {
            inv += parseFloat(row.spend ?? "0");
            imp += parseInt(row.impressions ?? "0", 10);
            alc += parseInt(row.reach ?? "0", 10);
            cli += parseInt(row.clicks ?? "0", 10);
            const actions: Array<{ action_type: string; value: string }> = row.actions ?? [];
            const lead =
              actions.find((a) => a.action_type === "lead") ||
              actions.find((a) => a.action_type === "onsite_conversion.lead_grouped") ||
              actions.find((a) => a.action_type?.includes("lead"));
            if (lead) ld += parseInt(lead.value, 10);
          }
          agg.investimento += inv;
          agg.impressoes += imp;
          agg.alcance += alc;
          agg.cliques += cli;
          agg.leads += ld;
          porConta.push({
            nicho: cfg.nicho,
            ad_account_id: cfg.ad_account_id,
            ad_account_nome: cfg.ad_account_nome,
            investimento: inv,
            impressoes: imp,
            alcance: alc,
            cliques: cli,
            leads: ld,
          });
        } catch (e: any) {
          porConta.push({
            nicho: cfg.nicho,
            ad_account_id: cfg.ad_account_id,
            erro: String(e?.message || e),
          });
        }
      }
      return Response.json(
        { ok: true, since, until, total: agg, contas: porConta },
        { headers: corsHeaders }
      );
    }

    // sync_yesterday | sync_date
    const refDate =
      dataParam ||
      ymd(new Date(Date.now() - 24 * 60 * 60 * 1000)); // ontem (BR ~ UTC-3, mas tudo bem para diário)

    // Busca todas as configs ativas
    let q = sb.from("mkt_meta_ads_config").select("*").eq("ativo", true)
      .in("organizacao_id", callerOrgs);
    if (body.organizacao_id) q = q.eq("organizacao_id", body.organizacao_id);
    const { data: configs, error: cfgErr } = await q;
    if (cfgErr) throw cfgErr;

    // Agrega métricas de várias contas por nicho (somando)
    const porNicho: Record<string, { investimento: number; impressoes: number; alcance: number; cliques: number; leads: number }> = {};
    const resultados: any[] = [];
    for (const cfg of configs ?? []) {
      try {
        const metrics = await fetchInsightsForDate(
          cfg.ad_account_id,
          refDate,
          (cfg.campaign_ids ?? []) as string[]
        );

        const key = `${cfg.organizacao_id}::${cfg.nicho}`;
        const acc = porNicho[key] ?? { investimento: 0, impressoes: 0, alcance: 0, cliques: 0, leads: 0 };
        acc.investimento += metrics.investimento;
        acc.impressoes += metrics.impressoes;
        acc.alcance += metrics.alcance;
        acc.cliques += metrics.cliques;
        acc.leads += metrics.leads;
        porNicho[key] = acc;

        await sb.from("mkt_meta_ads_sync_log").insert({
          organizacao_id: cfg.organizacao_id,
          nicho: cfg.nicho,
          ad_account_id: cfg.ad_account_id,
          campaign_ids: (cfg.campaign_ids ?? []) as string[],
          data_referencia: refDate,
          status: "sucesso",
          investimento: metrics.investimento,
          impressoes: metrics.impressoes,
          alcance: metrics.alcance,
          cliques: metrics.cliques,
          leads: metrics.leads,
          trigger_tipo: triggerTipo,
        });

        await sb
          .from("mkt_meta_ads_config")
          .update({ ultima_sync_at: new Date().toISOString() })
          .eq("id", cfg.id);

        resultados.push({ nicho: cfg.nicho, ad_account_id: cfg.ad_account_id, ok: true, metrics });
      } catch (e: any) {
        await sb.from("mkt_meta_ads_sync_log").insert({
          organizacao_id: cfg.organizacao_id,
          nicho: cfg.nicho,
          ad_account_id: cfg.ad_account_id,
          data_referencia: refDate,
          status: "erro",
          erro_mensagem: String(e?.message || e),
          trigger_tipo: triggerTipo,
        });
        resultados.push({ nicho: cfg.nicho, ad_account_id: cfg.ad_account_id, ok: false, erro: String(e?.message || e) });
      }
    }

    // Upsert agregado por nicho no mkt_lancamentos_diarios
    for (const key of Object.keys(porNicho)) {
      const [orgId, nicho] = key.split("::");
      const { data: adminRow } = await sb
        .from("membros")
        .select("user_id")
        .eq("organizacao_id", orgId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (adminRow?.user_id) {
        await upsertLancamento(sb, orgId, adminRow.user_id, nicho, refDate, porNicho[key]);
      }
    }

    return Response.json(
      { ok: true, data_referencia: refDate, resultados },
      { headers: corsHeaders }
    );
  } catch (e: any) {
    console.error("[meta-ads-sync] error:", e?.message || e, e?.stack);
    return Response.json(
      { ok: false, error: String(e?.message || e) },
      { status: 200, headers: corsHeaders }
    );
  }
});