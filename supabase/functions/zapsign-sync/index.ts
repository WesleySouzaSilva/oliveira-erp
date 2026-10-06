// Reconsulta um documento no ZapSign (GET /docs/{token}/) e atualiza o app.
// Ações: sync (padrão), link (vincula documento externo a um cliente), link_novo (busca token externo pela 1ª vez).
import { ehAdmin, adminClient, autenticarInterno, garantirFinalizado, json, sincronizarDocumento, zapsign, zapsignToken, corsHeaders } from "../_shared/zapsign.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const auth = await autenticarInterno(req, admin);
  if (!auth.ok) return json({ error: "Não autorizado" }, 401);
  try { zapsignToken(); } catch { return json({ error: "Integração não configurada: cadastre o segredo ZAPSIGN_API_TOKEN." }, 412); }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido" }, 400); }
  const acao = body?.acao || "sync";
  // Visibilidade: só quem enviou + administradores (externos: só admins)
  const podeVer = async (doc: any) => doc.enviado_por === auth.userId || await ehAdmin(admin, auth.userId, doc.organizacao_id);

  // Vincular documento externo a um cliente (sem chamada ao ZapSign)
  if (acao === "link") {
    const { documento_id, cliente_id } = body || {};
    if (!documento_id || !cliente_id) return json({ error: "documento_id e cliente_id são obrigatórios" }, 400);
    const { data: doc } = await admin.from("assinatura_documentos").select("*").eq("id", documento_id).maybeSingle();
    if (!doc || !auth.orgIds.includes(doc.organizacao_id) || !(await podeVer(doc))) return json({ error: "Documento não encontrado" }, 404);
    await admin.from("assinatura_documentos").update({ cliente_id, updated_at: new Date().toISOString() }).eq("id", documento_id);
    return json({ ok: true });
  }

  // Primeira importação de um documento externo pelo token
  if (acao === "link_novo") {
    if (!(await ehAdmin(admin, auth.userId, auth.orgIds[0]))) return json({ error: "Só administradores importam documentos externos" }, 403);
    const token = String(body?.token || "").trim();
    if (!token) return json({ error: "token é obrigatório" }, 400);
    const { data: existe } = await admin.from("assinatura_documentos").select("id").eq("zapsign_token", token).maybeSingle();
    if (existe) return json({ ok: true, documento_id: existe.id, ja_existia: true });
    const r = await zapsign(`/docs/${token}/`);
    if (r.status === 404) return json({ error: "Documento não existe no ZapSign" }, 404);
    if (r.status < 200 || r.status >= 300) return json({ error: `ZapSign respondeu ${r.status}` }, 502);
    const det = r.body;
    const orgId = auth.orgIds[0];
    const { data: doc, error } = await admin.from("assinatura_documentos").insert({
      organizacao_id: orgId,
      zapsign_token: token,
      nome: det?.name || "Documento externo",
      referencia: det?.external_id || null,
      origem: "externo",
      tipo: "outro",
      status: String(det?.status || "pending").toLowerCase(),
      canal: "nenhum",
      ultimo_sync_em: new Date().toISOString(),
    }).select("*").single();
    if (error) return json({ error: error.message }, 500);
    const signers: any[] = Array.isArray(det?.signers) ? det.signers : [];
    if (signers.length) {
      await admin.from("assinatura_signatarios").insert(signers.map((s: any) => ({
        documento_id: doc.id,
        organizacao_id: orgId,
        zapsign_token: s?.token || null,
        nome: s?.name || "Signatário",
        email: s?.email || null,
        status: String(s?.status || "pending").toLowerCase(),
        sign_url: s?.sign_url || null,
      })));
    }
    return json({ ok: true, documento_id: doc.id });
  }

  // sync padrão
  const { documento_id } = body || {};
  if (!documento_id) return json({ error: "documento_id é obrigatório" }, 400);
  const { data: doc } = await admin.from("assinatura_documentos").select("*").eq("id", documento_id).maybeSingle();
  if (!doc || !auth.orgIds.includes(doc.organizacao_id) || !(await podeVer(doc))) return json({ error: "Documento não encontrado" }, 404);
  if (acao === "baixar" && doc.assinado_path) {
    const { data: su, error: suErr } = await admin.storage.from("cliente-drive").createSignedUrl(doc.assinado_path, 300);
    if (suErr || !su) return json({ error: "Falha ao gerar o link do assinado" }, 500);
    return json({ ok: true, url: su.signedUrl });
  }
  if (!doc.zapsign_token) return json({ error: "Documento sem token do ZapSign" }, 400);

  const r = await zapsign(`/docs/${doc.zapsign_token}/`);
  if (r.status < 200 || r.status >= 300) return json({ error: `ZapSign respondeu ${r.status}` }, 502);
  const status = await sincronizarDocumento(admin, doc, r.body);
  const fin = await garantirFinalizado(admin, doc, r.body, status);
  if (fin.tentou && !fin.ok) {
    return json({ ok: true, status, aviso: `Assinado, mas o PDF não foi salvo: ${fin.erro}` });
  }
  if (acao === "baixar") return json({ ok: true, status, url: r.body?.signed_file || null });
  return json({ ok: true, status });
});
