// Inicia ou retoma a prova de um funcionário. Devolve as questões SEM gabarito.
import { adminClient, autenticar, corsHeaders, json, questoesParaResponder } from "../_shared/provas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const auth = await autenticar(req, admin);
  if (!auth.ok) return json({ error: "Não autorizado" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const provaId: string | undefined = body?.prova_id;
  const aplicacaoId: string | undefined = body?.aplicacao_id;
  if (!provaId && !aplicacaoId) return json({ error: "Informe a prova" }, 400);

  let aplicacao: any = null;
  if (aplicacaoId) {
    const { data } = await admin.from("prova_aplicacoes").select("*").eq("id", aplicacaoId).maybeSingle();
    if (!data || data.user_id !== auth.userId) return json({ error: "Prova não encontrada" }, 404);
    aplicacao = data;
  }

  const idProva = aplicacao?.prova_id ?? provaId;
  const { data: prova } = await admin.from("provas").select("*").eq("id", idProva).is("deleted_at", null).maybeSingle();
  if (!prova || !auth.orgIds.includes(prova.organizacao_id)) return json({ error: "Prova não encontrada" }, 404);
  if (!prova.publicada) return json({ error: "Prova não está publicada" }, 403);

  if (!aplicacao) {
    const { data: minhas } = await admin.from("prova_aplicacoes")
      .select("*").eq("prova_id", prova.id).eq("user_id", auth.userId).order("created_at");
    const lista = minhas || [];
    aplicacao = lista.find((a: any) => a.status === "pendente" || a.status === "em_andamento") ?? null;
    if (!aplicacao) {
      if (lista.length >= Number(prova.tentativas_permitidas)) {
        return json({ error: "Você já usou todas as tentativas desta prova" }, 403);
      }
      const { data: nova, error } = await admin.from("prova_aplicacoes")
        .insert({ prova_id: prova.id, user_id: auth.userId, organizacao_id: prova.organizacao_id, status: "em_andamento", iniciada_em: new Date().toISOString() })
        .select("*").single();
      if (error) return json({ error: "Não foi possível iniciar a prova" }, 500);
      aplicacao = nova;
    }
  }

  if (aplicacao.status === "pendente") {
    await admin.from("prova_aplicacoes").update({ status: "em_andamento", iniciada_em: new Date().toISOString() }).eq("id", aplicacao.id);
    aplicacao.iniciada_em = new Date().toISOString();
    aplicacao.status = "em_andamento";
  }
  if (aplicacao.status === "respondida" || aplicacao.status === "corrigida") {
    return json({ error: "Esta prova já foi enviada" }, 409);
  }

  const questoes = await questoesParaResponder(admin, prova);
  return json({
    aplicacao: { id: aplicacao.id, iniciada_em: aplicacao.iniciada_em, status: aplicacao.status },
    prova: { id: prova.id, titulo: prova.titulo, descricao: prova.descricao, tempo_limite_min: prova.tempo_limite_min },
    questoes,
  });
});
