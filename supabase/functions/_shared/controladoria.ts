// Utilidades da Controladoria (DJEN + D-5). Calendário próprio: sábado, domingo,
// linhas ATIVAS de `feriados` e feriados forenses ATIVOS. Não mexe no cálculo
// de dias úteis usado pelo ADVBOX (dias-uteis.ts).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Autentica: cron (x-cron-secret) ou usuário interno. Retorna orgs permitidas. */
export async function autenticar(req: Request, admin: ReturnType<typeof adminClient>) {
  const cron = req.headers.get("x-cron-secret");
  if (cron) {
    const { data } = await admin.from("app_secrets").select("value").eq("key", "controladoria_cron_secret").maybeSingle();
    if (data?.value && data.value === cron) {
      const { data: orgs } = await admin.from("controladoria_oabs").select("organizacao_id");
      const { data: orgs2 } = await admin.from("controladoria_membros").select("organizacao_id");
      const ids = [...new Set([...(orgs || []), ...(orgs2 || [])].map((o: any) => o.organizacao_id))];
      return { ok: true as const, origem: "cron", userId: null as string | null, orgIds: ids };
    }
    return { ok: false as const };
  }
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+/i.test(auth)) return { ok: false as const };
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await anon.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (error || !data?.user) return { ok: false as const };
  const uid = data.user.id;
  const { data: ms } = await admin.from("membros").select("organizacao_id").eq("user_id", uid);
  const { data: portal } = await admin.from("cliente_portal_usuarios").select("user_id").eq("user_id", uid).limit(1);
  const { data: portal2 } = await admin.from("empresa_portal_usuarios").select("user_id").eq("user_id", uid).limit(1);
  if ((portal || []).length || (portal2 || []).length) return { ok: false as const };
  const ids = (ms || []).map((m: any) => m.organizacao_id);
  if (!ids.length) return { ok: false as const };
  return { ok: true as const, origem: "manual", userId: uid, orgIds: ids };
}

export const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const nd = (iso: string) => new Date(`${iso}T12:00:00Z`);
export const somaDias = (iso: string, n: number) => {
  const d = nd(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDia(d);
};
/** Hoje no fuso de Brasília. */
export const hojeBR = () => isoDia(new Date(Date.now() - 3 * 3600 * 1000));

export type CalCtrl = {
  ehDiaUtil: (iso: string) => boolean;
  proximoDiaUtil: (iso: string) => string; // o próprio dia se útil
  diaUtilSeguinte: (iso: string) => string; // estritamente depois
  somaUteis: (iso: string, n: number) => string;
};

export async function calendarioControladoria(admin: ReturnType<typeof adminClient>, orgId: string): Promise<CalCtrl> {
  const fer = new Set<string>();
  const { data: f1 } = await admin.from("feriados").select("data, ativo, organizacao_id");
  for (const r of (f1 as any[]) || []) {
    if (r.ativo !== false && (!r.organizacao_id || r.organizacao_id === orgId)) fer.add(String(r.data).slice(0, 10));
  }
  const { data: f2 } = await admin.from("controladoria_feriados_forenses").select("data").eq("organizacao_id", orgId).eq("ativo", true);
  for (const r of (f2 as any[]) || []) fer.add(String(r.data).slice(0, 10));
  const ehDiaUtil = (iso: string) => {
    const dow = nd(iso).getUTCDay();
    return dow !== 0 && dow !== 6 && !fer.has(iso);
  };
  const diaUtilSeguinte = (iso: string) => {
    let d = iso;
    for (let i = 0; i < 400; i++) {
      d = somaDias(d, 1);
      if (ehDiaUtil(d)) return d;
    }
    return d;
  };
  const proximoDiaUtil = (iso: string) => (ehDiaUtil(iso) ? iso : diaUtilSeguinte(iso));
  const somaUteis = (iso: string, n: number) => {
    let d = iso;
    for (let i = 0; i < n; i++) d = diaUtilSeguinte(d);
    return d;
  };
  return { ehDiaUtil, proximoDiaUtil, diaUtilSeguinte, somaUteis };
}

export const normaliza = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Chamada ao ADVBOX com backoff em 429 e User-Agent de navegador após 403. */
export async function advbox(path: string, token: string): Promise<{ status: number; body: any }> {
  let ua = "OliveiraAgroApp/1.0";
  for (let t = 1; t <= 5; t++) {
    const res = await fetch(`https://app.advbox.com.br/api/v1${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": ua },
    });
    const txt = await res.text();
    if (res.status === 403 && ua.startsWith("Oliveira")) {
      ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
      continue;
    }
    if (res.status === 429 && t < 5) {
      const ra = Number(res.headers.get("Retry-After"));
      await espera(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 30000) : 2000 * 2 ** (t - 1));
      continue;
    }
    let body: any = null;
    try { body = JSON.parse(txt); } catch { body = txt; }
    return { status: res.status, body };
  }
  return { status: 429, body: null };
}

/** Usuários do app (id, email, nome) da organização. */
export async function usuariosDaOrg(admin: ReturnType<typeof adminClient>, orgId: string) {
  const { data: ms } = await admin.from("membros").select("user_id").eq("organizacao_id", orgId);
  const ids = new Set((ms || []).map((m: any) => m.user_id));
  const out: { id: string; email: string; nome: string }[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const us = data?.users || [];
    for (const u of us) {
      if (ids.has(u.id)) out.push({ id: u.id, email: (u.email || "").toLowerCase(), nome: String((u.user_metadata as any)?.full_name || (u.user_metadata as any)?.nome || "") });
    }
    if (us.length < 200) break;
  }
  const { data: profs } = await admin.from("profiles").select("id, nome").in("id", [...ids]);
  for (const p of (profs as any[]) || []) {
    const u = out.find((o) => o.id === p.id);
    if (u && !u.nome) u.nome = p.nome || "";
  }
  return out;
}

export async function adminsControladoria(admin: ReturnType<typeof adminClient>, orgId: string): Promise<string[]> {
  const { data } = await admin.from("controladoria_membros").select("user_id").eq("organizacao_id", orgId).eq("papel", "admin");
  return (data || []).map((r: any) => r.user_id);
}

// Vínculo usuários ADVBOX × app (Controladoria). Sincroniza a partir de GET /settings:
// e-mail que casa -> origem 'email'; vínculos 'manual' nunca são sobrescritos.
// Retorna Map advbox_user_id -> user_id do app (tabela primeiro; e-mail como reserva).
export async function mapaUsuariosAdvbox(
  admin: ReturnType<typeof adminClient>, orgId: string, token: string | undefined,
  usuarios: { id: string; email: string }[],
) {
  const porEmail = new Map(usuarios.map((u) => [u.email, u.id]));
  const { data: atuais } = await admin.from("controladoria_advbox_usuarios").select("*").eq("organizacao_id", orgId);
  const tab = new Map<string, any>(((atuais as any[]) || []).map((r) => [String(r.advbox_user_id), r]));
  const emails = new Map<string, string>();
  if (token) {
    const s = await advbox("/settings", token);
    const us: any[] = s.status === 200 ? (s.body?.users ?? s.body?.data?.users ?? []) : [];
    const linhas: any[] = [];
    for (const u of us) {
      if (u?.id == null) continue;
      const id = String(u.id);
      const email = String(u.email ?? "").toLowerCase() || null;
      if (email) emails.set(id, email);
      const ex = tab.get(id);
      const linha: any = { organizacao_id: orgId, advbox_user_id: id, advbox_nome: u.name ?? null, advbox_email: email, atualizado_em: new Date().toISOString() };
      if (ex?.origem === "manual") { linha.user_id = ex.user_id; linha.origem = "manual"; }
      else {
        const uid = email ? porEmail.get(email) ?? null : null;
        linha.user_id = uid; linha.origem = uid ? "email" : null;
      }
      linhas.push(linha);
      tab.set(id, linha);
    }
    if (linhas.length) await admin.from("controladoria_advbox_usuarios").upsert(linhas, { onConflict: "organizacao_id,advbox_user_id" });
  }
  const mapa = new Map<string, string>();
  for (const [id, r] of tab) {
    const uid = r.user_id ?? (r.advbox_email ? porEmail.get(r.advbox_email) : undefined) ?? (emails.get(id) ? porEmail.get(emails.get(id)!) : undefined);
    if (uid) mapa.set(id, uid);
  }
  return mapa;
}
