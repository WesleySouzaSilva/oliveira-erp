// Edge function: agrega dados do cliente (processos, atendimentos, vencimentos,
// acordos, laudos) e gera, via Claude, um RELATÓRIO AO CLIENTE em linguagem
// acessível. Apenas devolve o rascunho — NÃO envia nada externo automaticamente.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callClaude, mensagemErroFriendly } from "../_shared/ia-claude.ts";

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const clientesNomesRaw: unknown = body?.clientes_nomes;
    const clienteNomeSingle = String(body?.cliente_nome || "").trim();
    const clientesNomes: string[] = Array.isArray(clientesNomesRaw)
      ? (clientesNomesRaw as unknown[]).map((s) => String(s || "").trim()).filter(Boolean)
      : clienteNomeSingle
        ? [clienteNomeSingle]
        : [];
    const organizacao_id: string | null = body?.organizacao_id ?? null;
    const observacoes = String(body?.observacoes || "").trim();

    if (clientesNomes.length === 0) {
      return new Response(JSON.stringify({ error: "Informe ao menos um cliente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (clientesNomes.length > 8) {
      return new Response(JSON.stringify({ error: "Máximo de 8 clientes por relatório familiar." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isFamilia = clientesNomes.length > 1;

    // Agrega por cliente (RLS continua filtrando por organização)
    const agregadosPorCliente = await Promise.all(clientesNomes.map(async (nome) => {
      const norm = nome;
      const [processosR, atendR, vencR, laudosR, clienteR] = await Promise.all([
        sb.from("processos").select("id,nome_cliente,banco,numero_contrato,fase_atual,datas_fases,status,created_at,kanban_coluna_id").ilike("nome_cliente", `%${norm}%`).limit(20),
        sb.from("atendimentos_notas").select("titulo,cliente_nome,notas_brutas,relatorio_cliente,status,created_at").ilike("cliente_nome", `%${norm}%`).order("created_at", { ascending: false }).limit(10),
        sb.from("contratos_vencimentos").select("nome_cliente,banco,numero_contrato,data_vencimento,status_prazo,valor_divida,data_notificacao").ilike("nome_cliente", `%${norm}%`).order("data_vencimento", { ascending: true }).limit(30),
        sb.from("laudos").select("id,nome_cliente,titulo,status,created_at").ilike("nome_cliente", `%${norm}%`).order("created_at", { ascending: false }).limit(10),
        sb.from("clientes").select("nome,cpf_cnpj,area_hectares,status_adimplencia,vip,observacoes").ilike("nome", `%${norm}%`).limit(1).maybeSingle(),
      ]);
      return {
        nome,
        cliente: (clienteR as any)?.data || null,
        processos: processosR.data || [],
        atendimentos: atendR.data || [],
        vencimentos: vencR.data || [],
        laudos: laudosR.data || [],
      };
    }));

    // Acordos: tabela sem filtro direto por nome — buscamos eventos recentes da org
    const acordosR = await sb.from("acordos_historico").select("acordo_id,evento,descricao,created_at").order("created_at", { ascending: false }).limit(30);
    const acordos = acordosR.data || [];

    // Resumo estruturado em texto para o prompt
    const blocosResumo: string[] = [];
    if (isFamilia) {
      blocosResumo.push(`# Grupo familiar (${clientesNomes.length} integrantes): ${clientesNomes.join(" + ")}`, "");
    }
    for (const agg of agregadosPorCliente) {
      const { nome, cliente, processos, atendimentos, vencimentos, laudos } = agg;
      blocosResumo.push(
        isFamilia ? `## Integrante: ${nome}` : `# Cliente: ${nome}`,
        cliente ? `Perfil: CPF/CNPJ ${cliente.cpf_cnpj ?? "—"} · Área ${cliente.area_hectares ?? "—"} ha · Status: ${cliente.status_adimplencia ?? "—"}${cliente.vip ? " · VIP" : ""}` : "Perfil: dados não cadastrados.",
        cliente?.observacoes ? `Observações internas: ${cliente.observacoes}` : "",
        "",
        `### Processos (${processos.length})`,
        ...processos.map((p: any) => `- ${p.banco ?? "Banco?"} · contrato ${p.numero_contrato ?? "—"} · fase ${p.fase_atual ?? "—"} · status ${p.status ?? "—"} · aberto em ${fmtDate(p.created_at)}`),
        "",
        `### Vencimentos e prazos (${vencimentos.length})`,
        ...vencimentos.map((v: any) => `- ${v.banco ?? "Banco?"} contrato ${v.numero_contrato ?? "—"} · venc ${fmtDate(v.data_vencimento)} · status ${v.status_prazo ?? "—"} · notif ${fmtDate(v.data_notificacao)} · R$ ${v.valor_divida ?? "—"}`),
        "",
        `### Atendimentos recentes (${atendimentos.length})`,
        ...atendimentos.map((a: any) => `- [${fmtDate(a.created_at)}] ${a.titulo ?? "(sem título)"} — ${(a.notas_brutas || "").slice(0, 280)}`),
        "",
        `### Laudos (${laudos.length})`,
        ...laudos.map((l: any) => `- ${l.titulo ?? "Laudo"} · ${l.status ?? "—"} · ${fmtDate(l.created_at)}`),
        "",
      );
    }
    blocosResumo.push(
      `## Acordos / eventos recentes da organização (${acordos.length})`,
      ...acordos.map((a: any) => `- [${fmtDate(a.created_at)}] ${a.evento ?? ""} — ${a.descricao ?? ""}`),
      "",
      observacoes ? `## Observações do operador para a IA\n${observacoes}` : "",
    );
    const resumo = blocosResumo.filter(Boolean).join("\n");

    const system = `Você é assistente da Oliveira Advogados / Oliveira Agro. Sua tarefa é redigir um RELATÓRIO DE ACOMPANHAMENTO destinado ${isFamilia ? "ao GRUPO FAMILIAR de produtores rurais" : "ao CLIENTE (produtor rural)"}, em linguagem CLARA e ACESSÍVEL — não use juridiquês.

Objetivo: dar transparência sobre tudo o que o escritório está fazendo ${isFamilia ? "pela família" : "pelo cliente"} até agora, de forma cordial e profissional.

Estrutura obrigatória (markdown):
**1. Visão geral ${isFamilia ? "do caso da família" : "do seu caso"}** — 2-4 linhas humanas, situando o momento atual.
**2. O que já foi feito** — bullets com marcos concretos (processos abertos, notificações enviadas, laudos, acordos negociados)${isFamilia ? ". Quando relevante, indique entre parênteses a qual integrante se refere." : "."}
**3. Situação dos contratos e prazos** — ${isFamilia ? "subseções por integrante (### Nome) com" : ""} quadro/bullets dos contratos e datas-chave, em linguagem simples.
**4. Próximos passos** — bullets do que o escritório fará e do que precisamos ${isFamilia ? "da família" : "do cliente"}.
**5. Estamos com você** — encerramento cordial, canais de contato.

Regras rígidas:
- NUNCA invente valores, datas, bancos, contratos ou números que não estejam nos dados fornecidos. Se faltar dado, escreva "a ser confirmado".
- Não prometa resultado. Use "buscamos demonstrar", "estamos pleiteando", "tendemos a entender".
- Trate ${isFamilia ? "a família em segunda pessoa plural (\"vocês\", \"a propriedade de vocês\"), citando integrantes pelo primeiro nome quando útil" : "o cliente em segunda pessoa (\"você\", \"sua propriedade\")"}.
- Português brasileiro impecável.
- Saída: APENAS o relatório em markdown, pronto para o advogado revisar.`;

    const userMsg = `Dados agregados ${isFamilia ? "do grupo familiar" : "do cliente"} (somente o que está abaixo é verdade):\n\n${resumo}\n\nGere o relatório completo ${isFamilia ? "à família" : "ao cliente"}.`;

    const result = await callClaude({
      funcao: "gerar-relatorio-cliente",
      system,
      messages: [{ role: "user", content: userMsg }],
      max_tokens: 3000,
      temperature: 0.4,
      user_id: user.id,
      organizacao_id,
    });

    if (!result.ok) {
      return new Response(JSON.stringify({ error: mensagemErroFriendly(result.status, result.erro) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      relatorio: result.text,
      provedor: result.provedor,
      modelo: result.modelo,
      clientes: clientesNomes,
      fontes: {
        processos: agregadosPorCliente.reduce((s, a) => s + a.processos.length, 0),
        vencimentos: agregadosPorCliente.reduce((s, a) => s + a.vencimentos.length, 0),
        atendimentos: agregadosPorCliente.reduce((s, a) => s + a.atendimentos.length, 0),
        laudos: agregadosPorCliente.reduce((s, a) => s + a.laudos.length, 0),
        acordos: acordos.length,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("gerar-relatorio-cliente erro", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});