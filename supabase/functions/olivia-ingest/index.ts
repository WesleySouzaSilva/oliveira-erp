import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Decodifica base64 para Uint8Array
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Extrai texto puro de um DOCX (unzip + parse do word/document.xml)
async function extrairTextoDocx(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Arquivo DOCX inválido (word/document.xml ausente)");
  const xml = await docFile.async("string");
  // Junta o texto de <w:t>...</w:t>, insere quebras em <w:p>/<w:br>
  const withBreaks = xml
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n");
  const texts: string[] = [];
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withBreaks)) !== null) {
    texts.push(m[1]
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
  }
  // Recombina preservando quebras aproximadas dos parágrafos
  const raw = texts.join(" ");
  // Também extrai quebras de parágrafo diretas
  const paragrafos = withBreaks.split("\n")
    .map((linha) => {
      const parts: string[] = [];
      const rr = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let mm: RegExpExecArray | null;
      while ((mm = rr.exec(linha)) !== null) {
        parts.push(mm[1]
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
      }
      return parts.join("");
    })
    .filter((l) => l.trim().length > 0);
  const juntado = paragrafos.join("\n\n").trim();
  return juntado || raw.trim();
}

// Extrai texto de PDF usando o Claude (Anthropic) via bloco type:"document"
async function extrairTextoPdfViaClaude(arquivo_base64: string): Promise<string> {
  const ANTHROPIC_API_KEY = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Leitura de PDF requer ANTHROPIC_API_KEY configurada.");
  }
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8000,
      temperature: 0,
      system: "Você é um extrator de texto de PDFs. Devolva SOMENTE o texto integral do documento, sem comentários, sem markdown decorativo, preservando quebras de parágrafo naturais. Se o PDF for escaneado sem OCR e você não conseguir ler o conteúdo, responda exatamente: [PDF_SEM_TEXTO_LEGIVEL].",
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: arquivo_base64 } },
          { type: "text", text: "Extraia o texto integral deste PDF." },
        ],
      }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Falha ao ler PDF via IA (${resp.status}): ${err.slice(0, 200)}`);
  }
  const json = await resp.json();
  const txt: string = (json?.content || [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text || "")
    .join("\n")
    .trim();
  if (!txt || txt.includes("[PDF_SEM_TEXTO_LEGIVEL]")) {
    throw new Error("PDF sem texto legível (provavelmente escaneado sem OCR). Envie um PDF com texto ou copie o conteúdo manualmente.");
  }
  return txt;
}

// Quebra texto em chunks de ~1200 chars com overlap de 150
function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + size, clean.length);
    // tenta cortar em final de parágrafo/frase
    if (end < clean.length) {
      const slice = clean.slice(i, end);
      const lastBreak = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
      if (lastBreak > size * 0.5) end = i + lastBreak + 1;
    }
    chunks.push(clean.slice(i, end).trim());
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks.filter(c => c.length > 30);
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: inputs,
      dimensions: 1536,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Embedding falhou ${resp.status}: ${t}`);
  }
  const json = await resp.json();
  return json.data.map((d: any) => d.embedding);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      categoria, titulo, fonte, tags, organizacao_id,
      arquivo_base64, arquivo_mime, arquivo_nome,
    } = body;
    let { conteudo } = body as { conteudo?: string };

    // Se veio arquivo, extrai o texto antes de chunkar/embedar
    if (!conteudo && arquivo_base64) {
      if (typeof arquivo_base64 !== "string") {
        return new Response(JSON.stringify({ error: "arquivo_base64 inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // ~10MB base64 (arquivo real ~7.5MB)
      if (arquivo_base64.length > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Arquivo muito grande (limite ~7MB)." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mime = String(arquivo_mime || "").toLowerCase();
      const nome = String(arquivo_nome || "").toLowerCase();
      const isDocx = mime.includes("wordprocessingml") || nome.endsWith(".docx");
      const isPdf = mime === "application/pdf" || nome.endsWith(".pdf");
      try {
        if (isDocx) {
          conteudo = await extrairTextoDocx(b64ToBytes(arquivo_base64));
        } else if (isPdf) {
          conteudo = await extrairTextoPdfViaClaude(arquivo_base64);
        } else {
          return new Response(JSON.stringify({ error: "Formato não suportado. Envie PDF ou DOCX." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e?.message || "Falha ao extrair texto do arquivo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!conteudo || typeof conteudo !== "string" || conteudo.trim().length < 30) {
      return new Response(JSON.stringify({ error: "conteudo obrigatório (texto vazio ou muito curto)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let orgId = organizacao_id;
    if (!orgId) {
      const { data: m } = await supabase.from("membros").select("organizacao_id").eq("user_id", userId).maybeSingle();
      orgId = m?.organizacao_id;
    }
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Organização não identificada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chunks = chunkText(conteudo);
    if (chunks.length === 0) {
      return new Response(JSON.stringify({ error: "Conteúdo vazio após processamento" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Embedding em lotes de até 100
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 100) {
      const batch = chunks.slice(i, i + 100);
      const vecs = await embedBatch(batch);
      embeddings.push(...vecs);
    }

    const rows = chunks.map((c, idx) => ({
      organizacao_id: orgId,
      user_id: userId,
      categoria: categoria || "geral",
      titulo: titulo || arquivo_nome || null,
      fonte: fonte || null,
      conteudo: c,
      tags: Array.isArray(tags) ? tags : [],
      metadata: {
        chunk_index: idx, total_chunks: chunks.length,
        ...(arquivo_nome ? { arquivo_nome, arquivo_mime: arquivo_mime || null } : {}),
      },
      embedding: embeddings[idx] as any,
    }));

    const { error } = await supabase.from("olivia_conhecimento").insert(rows);
    if (error) {
      console.error("insert error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, chunks_inseridos: chunks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("olivia-ingest erro", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});