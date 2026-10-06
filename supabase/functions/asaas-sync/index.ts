import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ASAAS_BASE = "https://api.asaas.com/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const asaasKey = Deno.env.get("ASAAS_API_KEY");

  if (!asaasKey) {
    return json({ error: "ASAAS_API_KEY não configurada no servidor." }, 500);
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const supabase = createClient(supabaseUrl, serviceRole);
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  // CEO check
  const { data: isCeoData, error: ceoErr } = await supabase.rpc("is_ceo", { uid: user.id });
  if (ceoErr) return json({ error: "Falha ao verificar autorização" }, 500);
  if (!isCeoData) return json({ error: "Acesso restrito ao CEO" }, 403);

  // Org do CEO
  const { data: membro, error: memErr } = await supabase
    .from("membros")
    .select("organizacao_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (memErr || !membro?.organizacao_id) {
    return json({ error: "Organização do CEO não encontrada" }, 400);
  }
  const orgId = membro.organizacao_id;

  // Pagina /payments
  let offset = 0;
  const limit = 100;
  let total = 0;
  let synced = 0;

  try {
    while (true) {
      const res = await fetch(`${ASAAS_BASE}/payments?limit=${limit}&offset=${offset}`, {
        headers: { access_token: asaasKey, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const txt = await res.text();
        return json({ error: "Falha no Asaas", status: res.status, detail: txt.slice(0, 200) }, 502);
      }
      const body = await res.json() as {
        data: any[]; hasMore?: boolean; totalCount?: number; limit?: number; offset?: number;
      };
      const payments = body.data || [];
      if (payments.length === 0) break;

      const rows = payments.map((p) => ({
        organizacao_id: orgId,
        asaas_payment_id: String(p.id),
        asaas_customer_id: p.customer ?? null,
        cliente_nome: p.customerName ?? p.clientName ?? null,
        valor: Number(p.value ?? 0),
        status: p.status ?? null,
        tipo: p.billingType ?? null,
        vencimento: p.dueDate ?? null,
        pago_em: p.paymentDate ?? p.clientPaymentDate ?? null,
        descricao: p.description ?? null,
        raw: p,
        sincronizado_em: new Date().toISOString(),
      }));

      const { error: upErr } = await supabase
        .from("financeiro_cobrancas")
        .upsert(rows, { onConflict: "organizacao_id,asaas_payment_id" });
      if (upErr) {
        return json({ error: "Falha ao gravar cobranças", detail: upErr.message }, 500);
      }
      synced += rows.length;
      total = body.totalCount ?? total;

      if (body.hasMore === false || payments.length < limit) break;
      offset += limit;
      if (offset > 50000) break; // hard safety cap
    }
    return json({ ok: true, synced, total });
  } catch (e) {
    return json({ error: "Erro inesperado na sincronização" }, 500);
  }
});