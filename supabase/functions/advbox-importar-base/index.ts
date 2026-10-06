import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCaller, unauthorized, forbidden } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const BASE = "https://app.advbox.com.br/api/v1";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const normNome = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

async function advGet(path: string, token: string) {
  let espera = 2000;
  for (let t = 0; t < 6; t++) {
    const r = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": UA },
    });
    if (r.status === 429) { await sleep(espera); espera *= 2; continue; }
    if (!r.ok) throw new Error(`ADVBOX ${r.status} em ${path.split("?")[0]}`);
    return await r.json();
  }
  throw new Error("ADVBOX limitou as requisições (429) repetidamente");
}

async function listarTudo(recurso: string, token: string) {
  const todos: any[] = [];
  for (let offset = 0; offset < 20000; offset += 100) {
    const d = await advGet(`/${recurso}?limit=100&offset=${offset}`, token);
    const itens = Array.isArray(d) ? d : d?.data ?? [];
    todos.push(...itens);
    if (itens.length < 100) break;
    await sleep(700);
  }
  return todos;
}

async function simular(admin: any, org: string, token: string) {
    const clientesAdv = await listarTudo("customers", token);

    const app: any[] = [];
    for (let de = 0; ; de += 1000) {
      const { data } = await admin.from("clientes").select("id, nome, cpf_cnpj, advbox_customers_id")
        .eq("organizacao_id", org).is("deleted_at", null).range(de, de + 999);
      app.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const porId = new Map(app.filter((c) => c.advbox_customers_id).map((c) => [String(c.advbox_customers_id), c]));
    const porDoc = new Map<string, any[]>();
    const porNome = new Map<string, any[]>();
    for (const c of app) {
      const d = digitos(c.cpf_cnpj);
      if (d.length === 11 || d.length === 14) porDoc.set(d, [...(porDoc.get(d) ?? []), c]);
      const n = normNome(c.nome);
      if (n) porNome.set(n, [...(porNome.get(n) ?? []), c]);
    }

    // duplicados de documento dentro do ADVBOX
    const docAdv = new Map<string, any[]>();
    for (const c of clientesAdv) {
      const d = digitos(c.identification);
      if (d.length === 11 || d.length === 14) docAdv.set(d, [...(docAdv.get(d) ?? []), c]);
    }
    const duplicados = [...docAdv.entries()].filter(([, l]) => l.length > 1).map(([doc, l]) => ({
      documento: doc,
      clientes: l.map((c) => ({ advbox_id: c.id, nome: c.name, criado: c.created_at })),
    }));
    const aliasIds = new Set<string>();
    for (const d of duplicados) {
      const ord = [...d.clientes].sort((a, b) => String(a.criado).localeCompare(String(b.criado)) || a.advbox_id - b.advbox_id);
      ord.slice(1).forEach((c) => aliasIds.add(String(c.advbox_id)));
    }

    const cont = { total_advbox: clientesAdv.length, por_id: 0, por_documento: 0, por_nome: 0, nome_ambiguo: 0, novos: 0, novos_sem_documento: 0, sem_documento_total: 0, alias_duplicados: aliasIds.size };
    const casamentosNome: any[] = [];
    const ambiguos: any[] = [];
    const idsAppUsados = new Set<string>();
    for (const c of clientesAdv) {
      const id = String(c.id);
      const doc = digitos(c.identification);
      const temDoc = doc.length === 11 || doc.length === 14;
      if (!temDoc) cont.sem_documento_total++;
      if (aliasIds.has(id)) continue;
      if (porId.has(id)) { cont.por_id++; idsAppUsados.add(porId.get(id).id); continue; }
      const cd = temDoc ? porDoc.get(doc) : undefined;
      if (cd?.length === 1) { cont.por_documento++; idsAppUsados.add(cd[0].id); continue; }
      const cn = porNome.get(normNome(c.name));
      if (cn?.length === 1 && !cn[0].advbox_customers_id) {
        cont.por_nome++;
        casamentosNome.push({ advbox_id: c.id, advbox_nome: c.name, advbox_doc: c.identification || null, cidade: c.city || null, app_id: cn[0].id, app_nome: cn[0].nome, app_doc: cn[0].cpf_cnpj || null });
        continue;
      }
      if ((cn?.length ?? 0) > 1 || (cd?.length ?? 0) > 1) { cont.nome_ambiguo++; ambiguos.push({ advbox_id: c.id, nome: c.name }); continue; }
      cont.novos++;
      if (!temDoc) cont.novos_sem_documento++;
    }
    const appSemAdvbox = app.filter((c) => !idsAppUsados.has(c.id) && !casamentosNome.some((x) => x.app_id === c.id))
      .map((c) => ({ id: c.id, nome: c.nome, doc: c.cpf_cnpj }));

    return { contagens: cont, duplicados, casamentos_por_nome: casamentosNome, ambiguos, app_sem_par_no_advbox: appSemAdvbox };
}

async function orgECaller(req: Request, admin: any, body: any) {
  const cron = req.headers.get("x-cron-secret");
  if (cron) {
    const { data } = await admin.from("app_secrets").select("value").eq("key", "advbox_sync_cron_secret").maybeSingle();
    if (!data?.value || data.value !== cron) return null;
    const { data: ex } = await admin.from("advbox_importacao_execucoes").select("organizacao_id, iniciado_por")
      .eq("modo", "clientes").eq("status", "concluido").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ex) return null;
    return { org: ex.organizacao_id as string, userId: ex.iniciado_por as string, origem: "cron" };
  }
  const caller = await getCaller(req);
  if (!caller) return null;
  const { data: m } = await admin.from("membros").select("organizacao_id").eq("user_id", caller.id).eq("papel", "admin").limit(1).maybeSingle();
  if (!m) return "forbidden" as const;
  return { org: m.organizacao_id as string, userId: caller.id, origem: "admin" };
}

const enxuto = (c: any) => ({
  id: c.id, name: c.name, identification: c.identification, cellphone: c.cellphone, phone: c.phone,
  email: c.email, city: c.city, state: c.state, notes: c.notes, created_at: c.created_at,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Headers": corsHeaders["Access-Control-Allow-Headers"] + ", x-cron-secret" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let execId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await orgECaller(req, admin, body);
    if (ctx === "forbidden") return forbidden(corsHeaders, "Apenas administradores");
    if (!ctx) return unauthorized(corsHeaders);
    const modo: string = ctx.origem === "cron" ? "sync" : (body?.modo ?? "simular");
    if (!["simular", "teste", "clientes", "processos", "sync"].includes(modo)) return json({ error: "Modo inválido" }, 400);
    const token = Deno.env.get("ADVBOX_TOKEN") || Deno.env.get("ADVBOX_API_TOKEN")!;
    const { data: exec } = await admin.from("advbox_importacao_execucoes")
      .insert({ organizacao_id: ctx.org, iniciado_por: ctx.userId, modo, etapa: modo === "processos" ? "processos" : "clientes" }).select("id").single();
    execId = exec!.id;
    const fim = async (rel: any) => {
      await admin.from("advbox_importacao_execucoes").update({ status: "concluido", contagens: rel?.contagens ?? rel, relatorio: rel, atualizado_em: new Date().toISOString() }).eq("id", execId);
      return json({ execucao_id: execId, ...rel });
    };

    if (modo === "simular") return await fim(await simular(admin, ctx.org, token));

    if (modo === "teste" || modo === "clientes" || modo === "sync") {
      let lista = (await listarTudo("customers", token)).map(enxuto);
      if (modo === "teste") {
        const { data: lig } = await admin.from("clientes").select("advbox_customers_id").eq("organizacao_id", ctx.org).not("advbox_customers_id", "is", null);
        const ja = new Set((lig ?? []).map((x: any) => String(x.advbox_customers_id)));
        const semDoc = lista.filter((c) => !ja.has(String(c.id)) && digitos(c.identification).length < 11).slice(0, 2);
        const comDoc = lista.filter((c) => !ja.has(String(c.id)) && digitos(c.identification).length >= 11).slice(0, 3);
        lista = [...comDoc, ...semDoc];
      }
      const { data: rc, error: ec } = await admin.rpc("advbox_importar_clientes", { _org: ctx.org, _user: ctx.userId, _dados: lista, _teste: modo === "teste" });
      if (ec) throw new Error(ec.message);
      if (modo !== "sync") return await fim(rc);
      const procs = await listarTudo("lawsuits", token);
      const { data: rp, error: ep } = await admin.rpc("advbox_importar_processos", { _org: ctx.org, _dados: procs });
      if (ep) throw new Error(ep.message);
      return await fim({ clientes: rc, processos: rp });
    }

    // processos
    const procs = await listarTudo("lawsuits", token);
    const { data: rp, error: ep } = await admin.rpc("advbox_importar_processos", { _org: ctx.org, _dados: procs });
    if (ep) throw new Error(ep.message);
    return await fim(rp);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (execId) await admin.from("advbox_importacao_execucoes").update({ status: "erro", erro: msg, atualizado_em: new Date().toISOString() }).eq("id", execId);
    return json({ error: msg }, 500);
  }
});
