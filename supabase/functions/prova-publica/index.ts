// Porta do candidato: sem JWT. Recebe apenas o token e nunca expõe outro dado do app.
// Privacidade: nenhum nome, e-mail ou telefone de candidato aparece em log ou em erro.
import { adminClient, corsHeaders, gravarECorrigir, json, questoesParaResponder } from "../_shared/provas.ts";

const GENERICO = { error: "Link inválido ou expirado" };
const MAX_TENTATIVAS = 20;

// Limite simples por IP, em memória da instância, para não virar porta de varredura.
const porIp = new Map<string, { n: number; ate: number }>();
function ipBloqueado(ip: string) {
  const agora = Date.now();
  const reg = porIp.get(ip);
  if (!reg || reg.ate < agora) { porIp.set(ip, { n: 1, ate: agora + 60_000 }); return false; }
  reg.n += 1;
  return reg.n > 30;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (ipBloqueado(ip)) return json({ error: "Muitas tentativas. Tente novamente em alguns minutos." }, 429);

  const url = new URL(req.url);
  let body: any = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { /* sem corpo */ } }
  const token: string = String(body?.token ?? url.searchParams.get("token") ?? "");
  if (token.length < 20) return json(GENERICO, 404);

  const { data: aplicacao } = await admin.from("prova_aplicacoes").select("*").eq("token", token).maybeSingle();
  if (!aplicacao) return json(GENERICO, 404);
  if (aplicacao.tentativas_token >= MAX_TENTATIVAS) return json(GENERICO, 404);
  await admin.from("prova_aplicacoes").update({ tentativas_token: aplicacao.tentativas_token + 1 }).eq("id", aplicacao.id);

  const expirado = aplicacao.token_expira_em && new Date(aplicacao.token_expira_em).getTime() < Date.now();
  const usado = aplicacao.status === "respondida" || aplicacao.status === "corrigida" || aplicacao.status === "expirada";
  if (expirado || usado) return json(GENERICO, 404);

  const { data: prova } = await admin.from("provas").select("*").eq("id", aplicacao.prova_id).is("deleted_at", null).maybeSingle();
  if (!prova || !prova.publicada) return json(GENERICO, 404);

  if (req.method !== "POST" || body?.acao === "abrir" || !Array.isArray(body?.respostas)) {
    if (aplicacao.status === "pendente") {
      await admin.from("prova_aplicacoes").update({ status: "em_andamento", iniciada_em: new Date().toISOString() }).eq("id", aplicacao.id);
    }
    const questoes = await questoesParaResponder(admin, prova);
    return json({
      candidato_nome: aplicacao.candidato_nome,
      prova: { titulo: prova.titulo, descricao: prova.descricao, tempo_limite_min: prova.tempo_limite_min },
      questoes,
    });
  }

  await gravarECorrigir(admin, aplicacao, prova, body.respostas);
  // O candidato não recebe nota nem gabarito: o retorno é dado pelo escritório.
  return json({ ok: true });
});
