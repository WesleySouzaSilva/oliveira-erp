// Admin da organização: registra o webhook da conta no ZapSign e salva a configuração
// (signatário do escritório). Não duplica o webhook se já existir.
import { adminClient, autenticarInterno, corsHeaders, ehAdmin, json, somenteDigitos, zapsign, zapsignToken } from "../_shared/zapsign.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const auth = await autenticarInterno(req, admin);
  if (!auth.ok) return json({ error: "Não autorizado" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const orgId = body?.organizacao_id || auth.orgIds[0];
  if (!auth.orgIds.includes(orgId)) return json({ error: "Organização inválida" }, 403);
  if (!(await ehAdmin(admin, auth.userId!, orgId))) return json({ error: "Somente administradores" }, 403);

  // Salvar configuração (signatário do escritório) — não chama o ZapSign
  if (body?.acao === "salvar_config") {
    const { escritorio_nome, escritorio_email, escritorio_cpf } = body;
    if (escritorio_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(escritorio_email)) {
      return json({ error: "E-mail do escritório inválido" }, 400);
    }
    await admin.from("assinatura_config").upsert({
      organizacao_id: orgId,
      escritorio_nome: escritorio_nome || null,
      escritorio_email: escritorio_email || null,
      escritorio_cpf: somenteDigitos(escritorio_cpf) || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organizacao_id" });
    return json({ ok: true });
  }

  try { zapsignToken(); } catch { return json({ error: "Integração não configurada: cadastre o segredo ZAPSIGN_API_TOKEN." }, 412); }

  const { data: sec } = await admin.from("app_secrets").select("value").eq("key", "zapsign_webhook_secret").maybeSingle();
  if (!sec?.value) return json({ error: "Segredo do webhook não encontrado" }, 500);

  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/zapsign-webhook`;

  const { data: cfg } = await admin.from("assinatura_config").select("*").eq("organizacao_id", orgId).maybeSingle();
  if (cfg?.webhook_id) return json({ ok: true, webhook_id: cfg.webhook_id, ja_existia: true, url });

  const r = await zapsign("/user/company/webhook/", { method: "POST", body: { url, type: "" } });
  if (r.status < 200 || r.status >= 300) return json({ error: `ZapSign respondeu ${r.status}`, detalhe: r.body }, 502);
  const webhookId = r.body?.id ?? r.body?.webhook?.id ?? null;

  if (webhookId) {
    await zapsign("/user/company/webhook/header/", {
      method: "POST",
      body: { id: webhookId, headers: [{ name: "x-zapsign-secret", value: sec.value }] },
    });
  }

  await admin.from("assinatura_config").upsert({
    organizacao_id: orgId,
    webhook_id: webhookId ? String(webhookId) : null,
    webhook_registrado_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "organizacao_id" });

  return json({ ok: true, webhook_id: webhookId, url });
});
