// Utilidades das Provas (Treinamentos). O gabarito nunca sai daqui:
// a correção é sempre feita no servidor com service_role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Usuário interno autenticado (getUser, nunca getClaims). */
export async function autenticar(req: Request, admin: ReturnType<typeof adminClient>) {
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+/i.test(auth)) return { ok: false as const };
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await anon.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (error || !data?.user) return { ok: false as const };
  const uid = data.user.id;
  const { data: portal } = await admin.from("cliente_portal_usuarios").select("user_id").eq("user_id", uid).limit(1);
  const { data: portal2 } = await admin.from("empresa_portal_usuarios").select("user_id").eq("user_id", uid).limit(1);
  if ((portal || []).length || (portal2 || []).length) return { ok: false as const };
  const { data: ms } = await admin.from("membros").select("organizacao_id").eq("user_id", uid);
  const orgIds = (ms || []).map((m: any) => m.organizacao_id);
  if (!orgIds.length) return { ok: false as const };
  return { ok: true as const, userId: uid, orgIds };
}

export async function ehLider(admin: ReturnType<typeof adminClient>, uid: string, org: string) {
  const { data } = await admin.rpc("prova_is_lider", { _uid: uid, _org: org });
  return data === true;
}

export function embaralhar<T>(lista: T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Questões e alternativas SEM nenhuma marca de resposta certa. */
export async function questoesParaResponder(admin: ReturnType<typeof adminClient>, prova: any) {
  const { data: qs } = await admin.from("prova_questoes")
    .select("id,enunciado,tipo,peso,ordem").eq("prova_id", prova.id).order("ordem");
  const questoes = qs || [];
  const ids = questoes.map((q: any) => q.id);
  const { data: alts } = ids.length
    ? await admin.from("prova_alternativas").select("id,questao_id,texto,ordem").in("questao_id", ids).order("ordem")
    : { data: [] as any[] };
  const saida = questoes.map((q: any) => {
    const lista = (alts || []).filter((a: any) => a.questao_id === q.id)
      .map((a: any) => ({ id: a.id, texto: a.texto }));
    return {
      id: q.id, enunciado: q.enunciado, tipo: q.tipo, peso: Number(q.peso),
      alternativas: prova.embaralhar_alternativas ? embaralhar(lista) : lista,
    };
  });
  return prova.embaralhar_questoes ? embaralhar(saida) : saida;
}

/**
 * Grava as respostas e corrige a múltipla escolha no servidor.
 * Nota ponderada pelo peso, em percentual de 0 a 100.
 */
export async function gravarECorrigir(
  admin: ReturnType<typeof adminClient>,
  aplicacao: any,
  prova: any,
  respostas: Array<{ questao_id: string; alternativa_id?: string | null; resposta_texto?: string | null }>,
) {
  const { data: qs } = await admin.from("prova_questoes").select("id,tipo,peso").eq("prova_id", prova.id);
  const questoes = qs || [];
  const ids = questoes.map((q: any) => q.id);
  const { data: alts } = ids.length
    ? await admin.from("prova_alternativas").select("id,questao_id,correta").in("questao_id", ids)
    : { data: [] as any[] };

  const linhas = [];
  for (const q of questoes) {
    const r = respostas.find((x) => x.questao_id === q.id);
    let pontos: number | null = null;
    let alternativaId: string | null = null;
    if (q.tipo === "multipla_escolha") {
      const alt = (alts || []).find((a: any) => a.id === r?.alternativa_id && a.questao_id === q.id);
      alternativaId = alt ? alt.id : null;
      pontos = alt?.correta ? Number(q.peso) : 0;
    }
    linhas.push({
      aplicacao_id: aplicacao.id,
      questao_id: q.id,
      alternativa_id: alternativaId,
      resposta_texto: q.tipo === "dissertativa" ? (r?.resposta_texto ?? null) : null,
      pontos,
    });
  }
  if (linhas.length) {
    await admin.from("prova_respostas").upsert(linhas, { onConflict: "aplicacao_id,questao_id" });
  }

  const temDissertativa = questoes.some((q: any) => q.tipo === "dissertativa");
  const pesoTotal = questoes.reduce((s: number, q: any) => s + Number(q.peso), 0) || 1;
  const obtido = linhas.reduce((s, l) => s + (l.pontos ?? 0), 0);
  const nota = Math.round((obtido / pesoTotal) * 10000) / 100;

  const patch: any = {
    status: temDissertativa ? "respondida" : "corrigida",
    enviada_em: new Date().toISOString(),
    nota,
  };
  if (!temDissertativa) patch.aprovado = nota >= Number(prova.nota_minima);
  await admin.from("prova_aplicacoes").update(patch).eq("id", aplicacao.id);
  return { nota, aguardando_correcao: temDissertativa };
}
