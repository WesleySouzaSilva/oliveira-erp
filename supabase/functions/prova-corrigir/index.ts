// Correção pelo líder: pontos das dissertativas, recálculo da nota e ajuste manual.
import { adminClient, autenticar, corsHeaders, ehLider, json } from "../_shared/provas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const auth = await autenticar(req, admin);
  if (!auth.ok) return json({ error: "Não autorizado" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const aplicacaoId: string | undefined = body?.aplicacao_id;
  const pontos: Array<{ questao_id: string; pontos: number }> = Array.isArray(body?.pontos) ? body.pontos : [];
  const notaManual = body?.nota_manual === null || body?.nota_manual === undefined ? null : Number(body.nota_manual);
  const observacao: string = (body?.observacao ?? "").trim();
  if (!aplicacaoId) return json({ error: "Dados inválidos" }, 400);

  const { data: aplicacao } = await admin.from("prova_aplicacoes").select("*").eq("id", aplicacaoId).maybeSingle();
  if (!aplicacao) return json({ error: "Aplicação não encontrada" }, 404);
  if (!auth.orgIds.includes(aplicacao.organizacao_id) || !(await ehLider(admin, auth.userId, aplicacao.organizacao_id))) {
    return json({ error: "Não autorizado" }, 403);
  }

  const { data: prova } = await admin.from("provas").select("*").eq("id", aplicacao.prova_id).maybeSingle();
  if (!prova) return json({ error: "Prova não encontrada" }, 404);

  const { data: qs } = await admin.from("prova_questoes").select("id,peso,tipo").eq("prova_id", prova.id);
  const questoes = qs || [];
  for (const p of pontos) {
    const q = questoes.find((x: any) => x.id === p.questao_id);
    if (!q) continue;
    const valor = Math.max(0, Math.min(Number(q.peso), Number(p.pontos) || 0));
    await admin.from("prova_respostas").update({ pontos: valor })
      .eq("aplicacao_id", aplicacao.id).eq("questao_id", q.id);
  }

  const { data: resp } = await admin.from("prova_respostas").select("pontos").eq("aplicacao_id", aplicacao.id);
  const pesoTotal = questoes.reduce((s: number, q: any) => s + Number(q.peso), 0) || 1;
  const obtido = (resp || []).reduce((s: number, r: any) => s + Number(r.pontos ?? 0), 0);
  const calculada = Math.round((obtido / pesoTotal) * 10000) / 100;

  let nota = calculada;
  if (notaManual !== null && !Number.isNaN(notaManual) && notaManual !== calculada) {
    if (!observacao) return json({ error: "Informe a observação ao mudar a nota calculada" }, 400);
    nota = Math.max(0, Math.min(100, notaManual));
  }

  await admin.from("prova_aplicacoes").update({
    nota,
    aprovado: nota >= Number(prova.nota_minima),
    status: "corrigida",
    corrigida_por: auth.userId,
    corrigida_em: new Date().toISOString(),
    observacao_do_lider: observacao || aplicacao.observacao_do_lider,
  }).eq("id", aplicacao.id);

  return json({ ok: true, nota, calculada, aprovado: nota >= Number(prova.nota_minima) });
});
