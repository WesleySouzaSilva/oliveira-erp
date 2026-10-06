// OlivIA do PORTAL DO CLIENTE.
//
// Separada da OlivIA interna (assistente-ia) de propósito: a interna tem 13
// ferramentas que escrevem no sistema. Esta só LÊ o que o cliente já enxerga
// no portal (RLS com o JWT do próprio cliente) e executa uma única ação:
// abrir um chamado para a equipe. Nada de dados de outros clientes, nada de
// honorários, nada de nota interna.
//
// Streaming SSE para o front: event: meta | token | action | error.
// Modelo: Claude (Anthropic) com fallback para o Lovable AI Gateway.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logIaConsumo } from "../_shared/ia-claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

const MODELO_CLAUDE = "claude-opus-5";
const MODELO_FALLBACK = "google/gemini-3-flash-preview";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function sse(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "não informado";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const FASE_LABEL: Record<string, string> = {
  "1": "análise técnica (laudo)", "2": "notificação ao banco", "3": "aguardando resposta do banco", "4": "ação judicial", "5": "encerrado",
};

function fmtBRL(v: unknown): string {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return "não informado";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TOOL_ABRIR_CHAMADO = {
  name: "abrir_chamado",
  description:
    "Abre um chamado para a equipe do escritório em nome do cliente. Use quando o cliente pedir para falar com alguém, " +
    "relatar contato do banco (carta, ligação, proposta, cobrança), precisar enviar documento ou quando a pergunta " +
    "exigir decisão da equipe (prazo, estratégia, valores). Antes de chamar, confirme com o cliente em uma frase o que vai no chamado.",
  input_schema: {
    type: "object",
    properties: {
      tipo: { type: "string", enum: ["pos_venda", "banco", "documento", "duvida"] },
      titulo: { type: "string", description: "Título curto, até 100 caracteres." },
      descricao: { type: "string", description: "Resumo do que o cliente relatou, em português simples, com datas e nomes que ele deu." },
      banco: { type: "string", description: "Nome do banco, só quando tipo = banco. Vazio se não souber." },
    },
    required: ["tipo", "titulo", "descricao", "banco"],
    additionalProperties: false,
  },
  strict: true,
  eager_input_streaming: true,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ANTHROPIC_API_KEY = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim().replace(/[^\x20-\x7E]/g, "");
    const LOVABLE_API_KEY = (Deno.env.get("LOVABLE_API_KEY") || "").trim();

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    // Cliente Supabase com o JWT do usuário: TODA leitura passa pela RLS do portal.
    const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Não autenticado" }, 401);

    // Só usuário do PORTAL DO CLIENTE. Membro interno usa a OlivIA interna.
    const { data: vinculo } = await sb
      .from("cliente_portal_usuarios")
      .select("cliente_id, organizacao_id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .maybeSingle();
    if (!vinculo?.cliente_id) return json({ error: "Este assistente é exclusivo do portal do cliente." }, 403);
    const clienteId: string = vinculo.cliente_id;
    const orgId: string | null = vinculo.organizacao_id || null;

    // Rate limit: 20 mensagens/min por usuário
    try {
      const { data: allowed } = await sb.rpc("check_rate_limit", {
        _key: `olivia-portal:${user.id}`, _max_requests: 20, _window_seconds: 60,
      });
      if (allowed === false) {
        return json({ error: "Muitas mensagens em pouco tempo. Aguarde um instante." }, 429);
      }
    } catch (_) { /* fail-open */ }

    const body = await req.json().catch(() => ({}));
    const userMessage: string = String(body?.user_message || "").slice(0, 4000);
    const history: { role: string; content: string }[] = Array.isArray(body?.messages) ? body.messages : [];
    let conversaId: string | null = body?.conversa_id || null;
    if (!userMessage.trim()) return json({ error: "Mensagem vazia" }, 400);

    // ---------- Contexto do cliente (só o que a RLS libera) ----------
    const [cli, procs, andas, contratos, chamados, acordos, atendimentos] = await Promise.all([
      sb.from("clientes").select("nome, municipio, uf, nome_propriedade, cultura_principal").eq("id", clienteId).maybeSingle(),
      sb.from("processos").select("id, numero_processo, fase_atual, updated_at").is("deleted_at", null).order("updated_at", { ascending: false }).limit(10),
      sb.from("processo_andamentos").select("processo_id, data, descricao, tipo").order("data", { ascending: false }).limit(25),
      sb.from("portal_cliente_contratos_view").select("*").order("vencimento_proxima_parcela", { ascending: true }).limit(30),
      sb.from("portal_chamados").select("id, titulo, tipo, status, banco, ultima_mensagem_em").order("ultima_mensagem_em", { ascending: false }).limit(10),
      sb.from("portal_cliente_acordos_view").select("titulo, status, data_vencimento, concluida").order("data_vencimento", { ascending: true }).limit(15),
      sb.from("portal_cliente_atendimentos_view").select("titulo, status, relatorio_cliente, created_at").order("created_at", { ascending: false }).limit(5),
    ]);

    const nomeCliente = (cli.data as any)?.nome || "cliente";
    const primeiroNome = String(nomeCliente).trim().split(/\s+/)[0];
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const procMap = new Map<string, string>();
    (procs.data || []).forEach((p: any) => procMap.set(p.id, p.numero_processo || "sem número"));

    const ctxProcessos = (procs.data || []).length
      ? (procs.data || []).map((p: any) => `- Processo ${p.numero_processo || "sem número"} · fase atual: ${p.fase_atual ? (FASE_LABEL[String(p.fase_atual)] || p.fase_atual) : "não informada"}`).join("\n")
      : "- Nenhum processo vinculado no portal.";

    const ctxAndamentos = (andas.data || []).length
      ? (andas.data || []).map((a: any) => `- ${fmtData(a.data)} · processo ${procMap.get(a.processo_id) || "?"}${a.tipo ? ` · ${a.tipo}` : ""}: ${String(a.descricao || "").slice(0, 400)}`).join("\n")
      : "- Nenhuma movimentação liberada.";

    const ctxContratos = (contratos.data || []).length
      ? (contratos.data || []).map((c: any) => {
          const sit = c.resolvido ? "renegociado" : c.parcelas_vencidas ? "parcela em atraso" : c.protocolo_realizado ? "pedido de prorrogação protocolado" : "em dia";
          return `- ${c.banco || "Banco"} · contrato ${c.numero_contrato || "sem número"} · próximo vencimento ${fmtData(c.vencimento_proxima_parcela)} · parcela ${fmtBRL(c.valor_parcela)} · operação ${fmtBRL(c.valor_total_operacao)} · situação: ${sit}${c.data_notificacao ? ` · banco notificado em ${fmtData(c.data_notificacao)}` : ""}`;
        }).join("\n")
      : "- Nenhum contrato registrado no portal.";

    const ctxChamados = (chamados.data || []).length
      ? (chamados.data || []).map((c: any) => `- [${c.status}] ${c.titulo} (${c.tipo}${c.banco ? `, ${c.banco}` : ""})`).join("\n")
      : "- Nenhum chamado.";

    const ctxAcordos = (acordos.data || []).length
      ? (acordos.data || []).map((a: any) => `- ${a.titulo} · ${fmtData(a.data_vencimento)} · ${a.concluida ? "concluído" : a.status}`).join("\n")
      : "- Nenhum acordo liberado.";

    const ctxAtend = (atendimentos.data || []).length
      ? (atendimentos.data || []).map((a: any) => `- ${fmtData(a.created_at)} · ${a.titulo || "Atendimento"}: ${String(a.relatorio_cliente || "").slice(0, 300)}`).join("\n")
      : "- Nenhum atendimento liberado.";

    const systemPrompt = `Você é a OlivIA, assistente do escritório Oliveira Agro (Castro/PR), falando com ${primeiroNome}, cliente do escritório, dentro do Portal do Cliente. Hoje é ${hoje}.

O escritório atua em reestruturação de dívida rural: alongamento e prorrogação de contratos com bancos, revisão de encargos, defesa em cobranças e execuções.

COMO FALAR
- Português simples, direto, sem juridiquês. Quando usar um termo técnico, explique em meia frase.
- Respostas curtas (2 a 6 frases). Listas só quando ajudam a ler.
- Trate o cliente com respeito e calma. Muitos estão preocupados com o banco.
- Nunca use o travessão "—". Use vírgula, dois-pontos ou parênteses.

O QUE VOCÊ SABE
Só o que está nos DADOS DO CLIENTE abaixo, que são exatamente o que ele vê no portal. Se a informação não estiver lá, diga que não tem esse dado e ofereça abrir um chamado para a equipe confirmar. Nunca invente data, valor, prazo ou andamento.

O QUE VOCÊ NÃO FAZ
- Não dá parecer jurídico definitivo, não promete resultado, não fala de honorários nem de valores de acordo que não estejam nos dados.
- Não fala de outros clientes nem de assuntos internos do escritório.
- Não orienta o cliente a assinar, pagar ou aceitar proposta do banco por conta própria: nesses casos, oriente a NÃO assinar nada antes de falar com a equipe e abra um chamado.

QUANDO O BANCO ENTRA EM CONTATO (carta, ligação, proposta, cobrança, visita do gerente)
1. Acolha e peça os fatos: qual banco, quando, o que foi dito ou enviado, se deram prazo.
2. Oriente: não assinar nem pagar nada por impulso; guardar o documento; anotar nome de quem ligou.
3. Ofereça abrir um chamado do tipo "banco" com esse relato (ferramenta abrir_chamado). Se o cliente concordar ou já tiver dado os fatos, abra.

FERRAMENTA abrir_chamado
- Use quando o cliente pedir para falar com a equipe, relatar contato do banco, precisar enviar documento, ou quando a resposta exigir decisão da equipe.
- Antes de abrir, confirme em uma frase o que vai no chamado. Depois de abrir, diga que a equipe foi avisada e responde pelo próprio chamado, na aba Chamados.
- Não abra chamado repetido para o mesmo assunto se já existe um em aberto na lista; nesse caso, aponte o chamado existente.

DADOS DO CLIENTE
Nome: ${nomeCliente}${(cli.data as any)?.nome_propriedade ? ` · propriedade: ${(cli.data as any).nome_propriedade}` : ""}${(cli.data as any)?.municipio ? ` · ${(cli.data as any).municipio}/${(cli.data as any).uf || ""}` : ""}${(cli.data as any)?.cultura_principal ? ` · cultura: ${(cli.data as any).cultura_principal}` : ""}

Processos:
${ctxProcessos}

Movimentações liberadas (mais recentes primeiro):
${ctxAndamentos}

Contratos bancários:
${ctxContratos}

Chamados do cliente:
${ctxChamados}

Acordos e compromissos:
${ctxAcordos}

Últimos atendimentos:
${ctxAtend}`;

    // ---------- Conversa persistida (olivia_conversas / olivia_mensagens, RLS por dono) ----------
    if (!conversaId) {
      const { data: nova } = await sb.from("olivia_conversas").insert({
        user_id: user.id, organizacao_id: orgId, titulo: userMessage.slice(0, 60),
      }).select("id").maybeSingle();
      conversaId = nova?.id || null;
    }
    if (conversaId) {
      await sb.from("olivia_mensagens").insert({
        conversa_id: conversaId, user_id: user.id, role: "user", content: userMessage, rota_origem: "/portal",
      });
    }

    // Histórico: últimas 12 mensagens do front (já inclui a atual)
    const convo: { role: "user" | "assistant"; content: any }[] = history
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-12)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    if (!convo.length || convo[convo.length - 1].role !== "user") convo.push({ role: "user", content: userMessage });

    const startedAt = Date.now();
    let totalIn = 0, totalOut = 0;
    let provedor: "anthropic" | "lovable" = "anthropic";

    const stream = new ReadableStream({
      async start(controller) {
        sse(controller, "meta", { conversa_id: conversaId });
        let textoFinal = "";
        const acoes: any[] = [];

        async function executarChamado(input: any): Promise<string> {
          const tipo = ["pos_venda", "banco", "documento", "duvida"].includes(input?.tipo) ? input.tipo : "duvida";
          const titulo = String(input?.titulo || "").trim().slice(0, 120);
          const descricao = String(input?.descricao || "").trim().slice(0, 4000);
          if (!titulo || !descricao) return JSON.stringify({ erro: "titulo e descricao são obrigatórios" });
          const banco = tipo === "banco" ? String(input?.banco || "").trim().slice(0, 120) || null : null;
          const { data: ch, error } = await sb.from("portal_chamados").insert({
            cliente_id: clienteId, aberto_por: user!.id, aberto_por_tipo: "cliente",
            tipo, titulo, descricao, banco, status: "aberto", prioridade: tipo === "banco" ? "alta" : "normal",
          }).select("id").single();
          if (error || !ch) return JSON.stringify({ erro: error?.message || "falha ao abrir" });
          await sb.from("portal_chamado_mensagens").insert({
            chamado_id: ch.id, autor_id: user!.id, autor_tipo: "cliente",
            conteudo: `${descricao}\n\n(Chamado aberto pela OlivIA a pedido do cliente.)`, anexos: [],
          });
          acoes.push({ tipo: "chamado_aberto", chamado_id: ch.id, titulo });
          sse(controller, "action", { tipo: "chamado_aberto", chamado_id: ch.id, titulo });
          return JSON.stringify({ ok: true, chamado_id: ch.id, titulo });
        }

        try {
          let usouAnthropic = false;
          if (ANTHROPIC_API_KEY) {
            for (let iter = 0; iter < 4; iter++) {
              // Separa o texto de antes e de depois da ferramenta com um parágrafo
              if (iter > 0 && textoFinal && !/\s$/.test(textoFinal)) {
                textoFinal += "\n\n";
                sse(controller, "token", { text: "\n\n" });
              }
              const resp = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": ANTHROPIC_API_KEY,
                  "anthropic-version": "2023-06-01",
                  "anthropic-beta": "server-side-fallback-2026-07-01",
                },
                body: JSON.stringify({
                  model: MODELO_CLAUDE,
                  fallbacks: "default",
                  max_tokens: 1500,
                  thinking: { type: "adaptive" },
                  output_config: { effort: "low" },
                  system: systemPrompt,
                  messages: convo,
                  tools: [TOOL_ABRIR_CHAMADO],
                  stream: true,
                }),
              });
              if (!resp.ok || !resp.body) {
                const t = await resp.text().catch(() => "");
                console.error("[olivia-portal] anthropic", resp.status, t.slice(0, 300));
                if (iter === 0 && (resp.status === 429 || resp.status >= 500)) break; // vai pro fallback
                if (iter === 0) throw new Error("IA indisponível");
                break;
              }
              usouAnthropic = true;

              // ---- parse do SSE da Anthropic ----
              const reader = resp.body.getReader();
              const decoder = new TextDecoder();
              let buf = "";
              const blocks: Record<number, any> = {};
              let stopReason: string | null = null;
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = buf.indexOf("\n")) !== -1) {
                  let line = buf.slice(0, nl);
                  buf = buf.slice(nl + 1);
                  if (line.endsWith("\r")) line = line.slice(0, -1);
                  if (!line.startsWith("data:")) continue;
                  const js = line.slice(5).trim();
                  if (!js) continue;
                  let evt: any;
                  try { evt = JSON.parse(js); } catch { continue; }
                  const t = evt.type;
                  if (t === "message_start") {
                    totalIn += evt?.message?.usage?.input_tokens || 0;
                  } else if (t === "content_block_start") {
                    const cb = evt.content_block || {};
                    if (cb.type === "tool_use") blocks[evt.index] = { type: "tool_use", id: cb.id, name: cb.name, _buf: "", input: {} };
                    else if (cb.type === "text") blocks[evt.index] = { type: "text", text: "" };
                    // blocos de raciocínio precisam voltar intactos no próximo turno da mesma conversa
                    else if (cb.type === "thinking") blocks[evt.index] = { type: "thinking", thinking: "", signature: "" };
                    else if (cb.type === "redacted_thinking") blocks[evt.index] = { type: "redacted_thinking", data: cb.data || "" };
                    else blocks[evt.index] = { type: cb.type, _skip: true };
                  } else if (t === "content_block_delta") {
                    const d = evt.delta || {};
                    const b = blocks[evt.index];
                    if (d.type === "text_delta") {
                      if (!blocks[evt.index]) blocks[evt.index] = { type: "text", text: "" };
                      blocks[evt.index].text += d.text || "";
                      textoFinal += d.text || "";
                      sse(controller, "token", { text: d.text || "" });
                    } else if (d.type === "input_json_delta" && b?.type === "tool_use") {
                      b._buf += d.partial_json || "";
                    } else if (d.type === "thinking_delta" && b?.type === "thinking") {
                      b.thinking += d.thinking || "";
                    } else if (d.type === "signature_delta" && b?.type === "thinking") {
                      b.signature += d.signature || "";
                    }
                  } else if (t === "content_block_stop") {
                    const b = blocks[evt.index];
                    if (b?.type === "tool_use") {
                      try { b.input = b._buf ? JSON.parse(b._buf) : {}; } catch { b.input = null; }
                      delete b._buf;
                    }
                  } else if (t === "message_delta") {
                    if (evt?.delta?.stop_reason) stopReason = evt.delta.stop_reason;
                    totalOut += evt?.usage?.output_tokens || 0;
                  } else if (t === "error") {
                    console.error("[olivia-portal] sse error", JSON.stringify(evt.error || {}));
                  }
                }
              }

              const content = Object.keys(blocks).sort((a, b) => Number(a) - Number(b)).map((k) => blocks[Number(k)]).filter((b) => !b._skip);

              if (stopReason === "refusal") {
                textoFinal = "Não consigo ajudar com esse pedido por aqui. Se quiser, abro um chamado para a equipe olhar.";
                sse(controller, "token", { text: textoFinal });
                break;
              }

              const toolUses = content.filter((b) => b.type === "tool_use");
              if (stopReason !== "tool_use" || toolUses.length === 0) break;

              // Executa e devolve TODOS os tool_results numa única mensagem de usuário
              const results: any[] = [];
              for (const tu of toolUses) {
                if (tu.name === "abrir_chamado" && tu.input && typeof tu.input === "object") {
                  const r = await executarChamado(tu.input);
                  results.push({ type: "tool_result", tool_use_id: tu.id, content: r });
                } else {
                  results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ erro: "entrada inválida" }), is_error: true });
                }
              }
              convo.push({
                role: "assistant",
                content: content.map((b) =>
                  b.type === "text" ? { type: "text", text: b.text }
                  : b.type === "tool_use" ? { type: "tool_use", id: b.id, name: b.name, input: b.input || {} }
                  : b.type === "thinking" ? { type: "thinking", thinking: b.thinking, signature: b.signature }
                  : { type: "redacted_thinking", data: b.data }),
              });
              convo.push({ role: "user", content: results });
            }
          }

          // ---------- Fallback: Lovable AI Gateway (sem ferramenta) ----------
          if (!usouAnthropic) {
            if (!LOVABLE_API_KEY) throw new Error("IA indisponível no momento");
            provedor = "lovable";
            const fb = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: MODELO_FALLBACK,
                stream: true,
                temperature: 0.3,
                messages: [
                  { role: "system", content: systemPrompt + "\n\nNeste modo você NÃO consegue abrir chamado. Se precisar, oriente o cliente a abrir pela aba Chamados." },
                  ...convo.map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" })).filter((m) => m.content),
                ],
              }),
            });
            if (!fb.ok || !fb.body) throw new Error("IA indisponível no momento");
            const reader = fb.body.getReader();
            const decoder = new TextDecoder();
            let buf = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              let nl: number;
              while ((nl = buf.indexOf("\n")) !== -1) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (!line.startsWith("data:")) continue;
                const js = line.slice(5).trim();
                if (!js || js === "[DONE]") continue;
                try {
                  const evt = JSON.parse(js);
                  const delta = evt?.choices?.[0]?.delta?.content || "";
                  if (delta) { textoFinal += delta; sse(controller, "token", { text: delta }); }
                  if (evt?.usage) { totalIn += evt.usage.prompt_tokens || 0; totalOut += evt.usage.completion_tokens || 0; }
                } catch { /* noop */ }
              }
            }
          }

          if (conversaId && textoFinal.trim()) {
            await sb.from("olivia_mensagens").insert({
              conversa_id: conversaId, user_id: user!.id, role: "assistant",
              content: textoFinal, acoes: acoes.length ? acoes : null, rota_origem: "/portal",
            });
          }
          await logIaConsumo({
            funcao: "olivia-portal", modelo: provedor === "anthropic" ? MODELO_CLAUDE : MODELO_FALLBACK, provedor,
            input_tokens: totalIn, output_tokens: totalOut, status: "ok", duracao_ms: Date.now() - startedAt,
            user_id: user!.id, organizacao_id: orgId, meta: { cliente_id: clienteId, acoes: acoes.length },
          });
          sse(controller, "done", { ok: true });
        } catch (e) {
          console.error("[olivia-portal] erro", (e as Error)?.message);
          sse(controller, "error", { error: (e as Error)?.message || "Erro na OlivIA" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (e) {
    console.error("[olivia-portal] fatal", (e as Error)?.message);
    return json({ error: (e as Error)?.message || "Erro interno" }, 500);
  }
});
