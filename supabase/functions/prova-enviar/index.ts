// Recebe as respostas do funcionário e corrige no servidor.
import { adminClient, autenticar, corsHeaders, gravarECorrigir, json } from "../_shared/provas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const auth = await autenticar(req, admin);
  if (!auth.ok) return json({ error: "Não autorizado" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const aplicacaoId: string | undefined = body?.aplicacao_id;
  const respostas = Array.isArray(body?.respostas) ? body.respostas : null;
  if (!aplicacaoId || !respostas) return json({ error: "Dados inválidos" }, 400);

  const { data: aplicacao } = await admin.from("prova_aplicacoes").select("*").eq("id", aplicacaoId).maybeSingle();
  if (!aplicacao || aplicacao.user_id !== auth.userId) return json({ error: "Prova não encontrada" }, 404);
  if (aplicacao.status === "respondida" || aplicacao.status === "corrigida") {
    return json({ error: "Esta prova já foi enviada" }, 409);
  }

  const { data: prova } = await admin.from("provas").select("*").eq("id", aplicacao.prova_id).maybeSingle();
  if (!prova) return json({ error: "Prova não encontrada" }, 404);

  const r = await gravarECorrigir(admin, aplicacao, prova, respostas);
  return json({ ok: true, ...r });
});
