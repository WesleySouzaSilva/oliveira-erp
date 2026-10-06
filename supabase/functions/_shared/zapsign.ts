// Utilidades do módulo Assinaturas (ZapSign). Tudo aditivo; não mexe em nada existente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-zapsign-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Autentica usuário interno (membro da org, nunca portal do cliente). */
export async function autenticarInterno(req: Request, admin: ReturnType<typeof adminClient>) {
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+/i.test(auth)) return { ok: false as const };
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await anon.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (error || !data?.user) return { ok: false as const };
  const uid = data.user.id;
  const { data: ms } = await admin.from("membros").select("organizacao_id").eq("user_id", uid);
  const { data: p1 } = await admin.from("cliente_portal_usuarios").select("user_id").eq("user_id", uid).limit(1);
  const { data: p2 } = await admin.from("empresa_portal_usuarios").select("user_id").eq("user_id", uid).limit(1);
  if ((p1 || []).length || (p2 || []).length) return { ok: false as const };
  const ids = (ms || []).map((m: any) => m.organizacao_id);
  if (!ids.length) return { ok: false as const };
  return { ok: true as const, userId: uid, orgIds: ids as string[] };
}

export async function ehAdmin(admin: ReturnType<typeof adminClient>, userId: string, orgId: string) {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
  if ((data || []).length) return true;
  const { data: m } = await admin.from("membros").select("papel").eq("user_id", userId).eq("organizacao_id", orgId);
  return (m || []).some((r: any) => r.papel === "admin" || r.papel === "owner" || r.papel === "master");
}

export function zapsignToken() {
  const t = Deno.env.get("ZAPSIGN_API_TOKEN");
  if (!t) throw new Error("ZAPSIGN_API_TOKEN não configurado");
  return t;
}

/** Chamada à API ZapSign com backoff simples em 429. */
export async function zapsign(path: string, opts: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: any }> {
  const token = zapsignToken();
  for (let t = 1; t <= 4; t++) {
    const res = await fetch(`https://api.zapsign.com.br/api/v1${path}`, {
      method: opts.method || "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const txt = await res.text();
    if (res.status === 429 && t < 4) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (t - 1)));
      continue;
    }
    let body: any = null;
    try { body = JSON.parse(txt); } catch { body = txt; }
    return { status: res.status, body };
  }
  return { status: 429, body: null };
}

export const somenteDigitos = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");

export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string) => {
    let s = 0;
    for (let i = 0; i < base.length; i++) s += Number(base[i]) * (base.length + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10]);
}

/** Status do documento a partir da resposta de GET /docs/{token}/. */
export function statusDocumento(doc: any): string {
  const s = String(doc?.status || "").toLowerCase();
  if (["signed", "refused", "expired", "deleted", "pending"].includes(s)) return s;
  return "pending";
}

/** Atualiza documento + signatários a partir do detalhe do ZapSign. */
export async function sincronizarDocumento(admin: ReturnType<typeof adminClient>, docRow: any, det: any) {
  const status = statusDocumento(det);
  await admin.from("assinatura_documentos")
    .update({ status, ultimo_sync_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", docRow.id);
  const signers: any[] = Array.isArray(det?.signers) ? det.signers : [];
  for (const s of signers) {
    const st = String(s?.status || "pending").toLowerCase();
    const patch: any = {
      status: st,
      sign_url: s?.sign_url || undefined,
      visualizou_em: s?.times_viewed > 0 || st === "opened" ? (s?.last_view_at || new Date().toISOString()) : undefined,
      assinou_em: st === "signed" ? (s?.signed_at || new Date().toISOString()) : undefined,
      recusou_em: st === "refused" ? (s?.refused_at || new Date().toISOString()) : undefined,
    };
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
    if (s?.token) {
      await admin.from("assinatura_signatarios").update(patch)
        .eq("documento_id", docRow.id).eq("zapsign_token", s.token);
    }
  }
  return status;
}

/** Baixa o PDF assinado, grava no drive do cliente e notifica. */
export async function finalizarAssinado(admin: ReturnType<typeof adminClient>, docRow: any, det: any) {
  if (docRow.assinado_path) return; // já finalizado
  const url = det?.signed_file;
  if (!url) return;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download do assinado falhou: ${resp.status}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const path = `assinaturas/${docRow.organizacao_id}/${docRow.id}/assinado.pdf`;
  const up = await admin.storage.from("cliente-drive").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(`upload do assinado falhou: ${up.error.message}`);

  let arquivoId: string | null = null;
  if (docRow.cliente_id) {
    const { data: cli } = await admin.from("clientes").select("nome").eq("id", docRow.cliente_id).maybeSingle();
    if (cli?.nome) {
      const { data: arq } = await admin.from("arquivos_cliente").insert({
        user_id: docRow.enviado_por,
        organizacao_id: docRow.organizacao_id,
        nome_cliente: cli.nome,
        nome_arquivo: `${docRow.nome} (assinado).pdf`,
        storage_path: path,
        tamanho_bytes: bytes.length,
        pasta: "Contratos assinados",
        origem: "zapsign",
        status_aprovacao: "aprovado",
      }).select("id").single();
      arquivoId = arq?.id ?? null;
    }
  }
  await admin.from("assinatura_documentos")
    .update({ assinado_path: path, arquivo_cliente_id: arquivoId, updated_at: new Date().toISOString() })
    .eq("id", docRow.id);
}

export async function notificar(admin: ReturnType<typeof adminClient>, userIds: string[], tipo: string, mensagem: string) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  await admin.from("notificacoes_sistema").insert(ids.map((user_id) => ({ user_id, tipo, mensagem })));
}

export async function adminsDaOrg(admin: ReturnType<typeof adminClient>, orgId: string): Promise<string[]> {
  const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const { data: ms } = await admin.from("membros").select("user_id").eq("organizacao_id", orgId);
  const membros = new Set((ms || []).map((m: any) => m.user_id));
  return (data || []).map((r: any) => r.user_id).filter((id: string) => membros.has(id));
}

/**
 * Se o documento está "signed" e ainda não tem assinado_path, tenta finalizar.
 * Notifica "PDF no drive" só após sucesso; em falha grava o erro no evento (se houver) e avisa.
 */
export async function garantirFinalizado(
  admin: ReturnType<typeof adminClient>, docRow: any, det: any, status: string, eventoChave?: string,
): Promise<{ tentou: boolean; ok: boolean; erro?: string }> {
  if (status !== "signed" || docRow.assinado_path) return { tentou: false, ok: true };
  try {
    if (!det?.signed_file) throw new Error("ZapSign ainda não disponibilizou o PDF assinado");
    await finalizarAssinado(admin, docRow, det);
    if (docRow.enviado_por) {
      await notificar(admin, [docRow.enviado_por], "assinatura", `Documento "${docRow.nome}" foi assinado por todos. ${docRow.cliente_id ? "O PDF assinado já está no drive do cliente." : "Baixe o PDF assinado na tela Assinaturas."}`);
    }
    return { tentou: true, ok: true };
  } catch (e) {
    const erro = (e as Error).message;
    if (eventoChave) await admin.from("assinatura_eventos").update({ erro }).eq("chave_idempotencia", eventoChave);
    const alvo = docRow.enviado_por ? [docRow.enviado_por] : await adminsDaOrg(admin, docRow.organizacao_id);
    await notificar(admin, alvo, "assinatura", `Documento "${docRow.nome}" foi assinado, mas o PDF não foi salvo. Clique em Sincronizar.`);
    return { tentou: true, ok: false, erro };
  }
}

export async function sha256Hex(txt: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
