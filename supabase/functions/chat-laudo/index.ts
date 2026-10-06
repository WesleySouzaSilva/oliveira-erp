import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um engenheiro agrônomo sênior assistente de IA, especialista em perícia rural e elaboração de laudos técnicos para renegociação de crédito rural (MCR 3-2, Resolução Bacen nº 5.097/2023).

## Sua função

Você ajuda agrônomos a gerar laudos técnicos de perda de safra e capacidade de pagamento de forma conversacional. Em vez de formulários longos, o agrônomo conversa com você descrevendo o caso, e você:

1. **Extrai dados automaticamente** de tudo que o agrônomo diz
2. **Busca dados externos** quando tem município/UF (clima INMET, decretos, preços CEPEA)
3. **Faz perguntas inteligentes** sobre dados faltantes — NUNCA pergunta tudo de uma vez, priorize o essencial
4. **Gera seções do laudo progressivamente** conforme recebe dados suficientes

## Fluxo ideal

- O agrônomo diz algo como "Preciso fazer um laudo pra soja do João em Maracaju-MS, safra 24/25"
- Você extrai: cultura=soja, município=Maracaju, UF=MS, safra=24/25, nome=João
- Responde confirmando os dados extraídos e faz 1-2 perguntas sobre o mais urgente (CPF, área, banco)
- Conforme recebe mais dados, vai montando o laudo internamente

## Regras de extração de dados

Quando o usuário mencionar dados, extraia e organize no campo "dados_extraidos" do metadata:
- Nome, CPF, telefone do produtor
- Nome da fazenda, município, UF, coordenadas GPS, área
- Culturas, cultivares, safra, datas de plantio/colheita
- Bancos, contratos, valores, vencimentos
- Produtividade histórica e atual
- Tipo de adversidade climática

## Regras de comportamento

- Seja eficiente: nunca repita dados que o agrônomo já deu
- Quando tiver município+UF+cultura, sugira buscar dados climáticos automaticamente
- Quando tiver dados suficientes para uma seção, ofereça gerar a prévia
- Use linguagem profissional mas amigável, como um colega agrônomo
- Nunca peça mais de 3 informações por mensagem
- Sempre confirme os dados extraídos de forma resumida

## Formato de resposta

Sempre responda em texto corrido conversacional. Quando extrair dados, mencione-os naturalmente na conversa.
Quando gerar uma seção do laudo, use blocos de citação (>) para destacar.

## Tipos de laudo

- **Perda de Safra (LP)**: Prova quebra de safra por adversidade climática. 20-25 páginas, altamente técnico.
- **Capacidade de Pagamento (LCP)**: Demonstra capacidade futura de pagamento. 9-12 páginas, projeção financeira.

Se o agrônomo não especificar, assuma Perda de Safra (é o mais comum).`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, laudoId } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      throw new Error("Campo 'messages' é obrigatório");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    // Prefer Lovable AI Gateway (auto-configured), fallback to Anthropic
    const useLovable = !!LOVABLE_API_KEY;
    const useAnthropic = !useLovable && !!ANTHROPIC_API_KEY;
    
    // Get auth token for saving messages
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId: string = user.id;

    // Load existing conversation from DB if laudoId provided
    let contextMessages: Array<{ role: string; content: string }> = [];
    if (laudoId && userId) {
      // O laudo precisa estar visível para o chamador (RLS resolve org/dono).
      const { data: laudoPermitido } = await supabase
        .from("laudos")
        .select("id")
        .eq("id", laudoId)
        .maybeSingle();
      if (!laudoPermitido) {
        return new Response(JSON.stringify({ error: "Laudo não encontrado ou sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceKey);
      
      const { data: existingMsgs } = await adminClient
        .from("laudo_conversas")
        .select("role, content")
        .eq("laudo_id", laudoId)
        .order("created_at", { ascending: true })
        .limit(50);
      
      if (existingMsgs && existingMsgs.length > 0) {
        contextMessages = existingMsgs.map((m: any) => ({
          role: m.role,
          content: m.content,
        }));
      }

      // Load memoria for context enrichment
      const { data: memorias } = await adminClient
        .from("laudo_memoria")
        .select("tipo, chave, dados")
        .eq("user_id", userId)
        .order("uso_count", { ascending: false })
        .limit(20);

      if (memorias && memorias.length > 0) {
        const memCtx = memorias.map((m: any) => `[${m.tipo}:${m.chave}] ${JSON.stringify(m.dados)}`).join("\n");
        contextMessages.unshift({
          role: "system",
          content: `Dados aprendidos de laudos anteriores deste agrônomo:\n${memCtx}`,
        });
      }
    }

    // Build final messages array
    const allMessages = [...contextMessages, ...messages];

    if (useLovable) {
      // Use Lovable AI Gateway with streaming (preferred)
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...allMessages,
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Lovable AI error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } else if (useAnthropic) {
      // Fallback to Anthropic Claude API
      const apiKey = (ANTHROPIC_API_KEY || "").replace(/[^\x00-\x7F]/g, "").trim();
      
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          temperature: 0.3,
          system: SYSTEM_PROMPT,
          stream: true,
          messages: allMessages.filter(m => m.role !== "system").map(m => ({
            role: m.role === "system" ? "user" : m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Anthropic error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Aguarde." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } else {
      throw new Error("Nenhuma chave de API de IA configurada.");
    }

  } catch (e) {
    console.error("chat-laudo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
