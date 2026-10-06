// Webhook público do ZapSign. Protegido pelo header x-zapsign-secret (app_secrets).
// Grava o evento bruto (idempotente), reconsulta GET /docs/{token}/ e responde 200.
import { adminClient, adminsDaOrg, corsHeaders, garantirFinalizado, json, notificar, sha256Hex, sincronizarDocumento, zapsign, zapsignToken } from "../_shared/zapsign.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
  const admin = adminClient();

  const { data: sec } = await admin.from("app_secrets").select("value").eq("key", "zapsign_webhook_secret").maybeSingle();
  const recebido = req.headers.get("x-zapsign-secret");
  if (!sec?.value || recebido !== sec.value) return json({ error: "Não autorizado" }, 401);

  const bruto = await req.text();
  let payload: any;
  try { payload = JSON.parse(bruto); } catch { return json({ ok: true }); } // responde 200 mesmo com corpo ruim

  const tipo = String(payload?.event_type || payload?.event || "desconhecido");
  const token = payload?.token || payload?.doc_token || payload?.document?.token || null;
  const chave = await sha256Hex(bruto); // idempotência pelo corpo bruto

  // Localiza o documento (ou cria como externo)
  let doc: any = null;
  if (token) {
    const { data } = await admin.from("assinatura_documentos").select("*").eq("zapsign_token", token).maybeSingle();
    doc = data;
  }

  let orgId: string | null = doc?.organizacao_id || null;
  if (!doc && token) {
    // Documento enviado fora do app: entra como "externo", sem cliente
    const { data: orgs } = await admin.from("organizacoes").select("id").limit(1);
    orgId = orgs?.[0]?.id || null;
    if (orgId) {
      const { data: novo } = await admin.from("assinatura_documentos").insert({
        organizacao_id: orgId,
        zapsign_token: token,
        nome: payload?.name || payload?.document?.name || "Documento externo",
        origem: "externo",
        tipo: "outro",
        status: "pending",
        canal: "nenhum",
      }).select("*").single();
      doc = novo;
    }
  }

  // Grava o evento bruto, idempotente
  const { error: evErr } = await admin.from("assinatura_eventos").insert({
    organizacao_id: orgId,
    documento_id: doc?.id || null,
    zapsign_doc_token: token,
    tipo,
    payload,
    chave_idempotencia: chave,
  });
  if (evErr && String(evErr.code) === "23505") return json({ ok: true, duplicado: true });

  // Reconsulta o ZapSign antes de mudar qualquer status
  if (doc?.zapsign_token) {
    let det: any = null;
    try {
      zapsignToken();
      const r = await zapsign(`/docs/${doc.zapsign_token}/`);
      if (r.status >= 200 && r.status < 300) det = r.body;
    } catch { det = null; }
    if (det) {
      const antes = doc.status;
      const status = await sincronizarDocumento(admin, doc, det);
      if (status === "signed") {
        await garantirFinalizado(admin, doc, det, status, chave);
      } else if ((status === "refused" || status === "expired") && antes !== status) {
        const alvo = doc.enviado_por ? [doc.enviado_por] : (orgId ? await adminsDaOrg(admin, orgId) : []);
        const msg = status === "refused"
          ? `O documento "${doc.nome}" foi recusado por um signatário.`
          : `O prazo de assinatura do documento "${doc.nome}" venceu.`;
        await notificar(admin, alvo, "assinatura", msg);
      }
    }
  }
  if (tipo === "email_bounce" && orgId) {
    const alvo = doc?.enviado_por ? [doc.enviado_por] : await adminsDaOrg(admin, orgId);
    await notificar(admin, alvo, "assinatura", `E-mail de assinatura devolvido no documento "${doc?.nome || token}". Reenvie por outro canal.`);
  }

  await admin.from("assinatura_eventos").update({ processado_em: new Date().toISOString() }).eq("chave_idempotencia", chave);
  return json({ ok: true });
});
