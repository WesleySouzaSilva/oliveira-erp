// Edge function: gera relatório de atendimento (formal, para envio ao cliente)
// a partir das notas brutas digitadas pelo operador comercial.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callClaude, mensagemErroFriendly } from "../_shared/ia-claude.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
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

    const body = await req.json();
    const notas = String(body?.notas || "").trim();
    const clienteNome = String(body?.cliente_nome || "Cliente").trim();
    const contexto = String(body?.contexto || "").trim();
    const organizacao_id: string | null = body?.organizacao_id ?? null;

    if (notas.length < 20) {
      return new Response(JSON.stringify({ error: "Notas muito curtas. Escreva ao menos um parágrafo." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `Você é assistente da Oliveira Advogados / Oliveira Agro, escritório especializado em reestruturação de dívidas rurais e direito agro.

Sua tarefa: transformar anotações de atendimento (linguagem informal, fragmentada, telegráfica) em um RELATÓRIO PROFISSIONAL DE ATENDIMENTO destinado ao próprio cliente.

Diretrizes obrigatórias:
- Tom: cordial, formal, consultivo. Trate o cliente em segunda pessoa ("você", "sua propriedade").
- Estrutura fixa com markdown:
  **1. Resumo do atendimento** — 2 a 4 linhas situando o motivo do contato.
  **2. Pontos abordados** — bullets com cada tema discutido.
  **3. Análise preliminar** — interpretação técnica/jurídica do caso, sem afirmações conclusivas.
  **4. Próximos passos** — bullets com ações de cada parte (cliente e escritório).
  **5. Considerações finais** — agradecimento e canal aberto.
- NUNCA invente valores, datas, números de contrato, nomes de banco ou áreas que não estejam nas notas.
- Se a nota não cita algo, escreva "a ser confirmado" ou "a ser detalhado em próximo contato".
- Não prometa resultado. Use "buscaremos demonstrar", "tendemos a entender", "será analisada a viabilidade".
- Português brasileiro impecável. Sem jargão excessivo.
- Saída: APENAS o relatório em markdown, sem cabeçalho extra nem comentários.`;

    const userMsg = `Cliente: ${clienteNome}
${contexto ? `Contexto adicional: ${contexto}\n` : ""}
Notas brutas do atendimento:
"""
${notas}
"""

Gere o relatório completo seguindo a estrutura.`;

    const result = await callClaude({
      funcao: "gerar-relatorio-atendimento",
      system,
      messages: [{ role: "user", content: userMsg }],
      max_tokens: 2000,
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
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("gerar-relatorio-atendimento erro", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});