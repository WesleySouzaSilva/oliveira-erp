import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmt(v: any): string {
  const n = Number(v);
  return isNaN(n) ? "N/I" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtNum(v: any, suffix = ""): string {
  const n = Number(v);
  return isNaN(n) ? "N/I" : n.toLocaleString("pt-BR") + suffix;
}

const hipLabels: Record<string, string> = {
  a: "Dificuldade de comercialização dos produtos agropecuários",
  b: "Frustração de safra por evento climático adverso",
  c: "Ocorrência de pragas, doenças ou outros fatores prejudiciais à atividade",
  d: "Dificuldades de fluxo de caixa do mutuário",
};

/** Escapa HTML — impede injeção de script via dados do usuário. */
function escHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapa recursivamente strings de objetos/arrays vindos do banco. */
function deepEsc<T>(v: T): T {
  if (typeof v === "string") return escHtml(v) as unknown as T;
  if (Array.isArray(v)) return v.map(deepEsc) as unknown as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = deepEsc(val);
    return out as unknown as T;
  }
  return v;
}

function formatNarrative(rawText: string): string {
  const text = escHtml(rawText);
  if (!text) return "";
  let html = text
    .replace(/^### (.+)$/gm, '<h3 class="section-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="section-title">$1</h2>')
    .replace(/^# (\d+\..+)$/gm, '<h2 class="section-title">$1</h2>')
    .replace(/^# (.+)$/gm, '<h2 class="section-title">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="narrative-p">')
    .replace(/\n/g, '<br>');
  if (!html.startsWith('<')) html = '<p class="narrative-p">' + html;
  if (!html.endsWith('>')) html += '</p>';
  return html;
}

const CSS = `
@page { margin: 2.5cm 2.5cm 3cm 2.5cm; size: A4; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.7; margin: 0; padding: 0; }

.page-header { text-align: center; padding-bottom: 16px; border-bottom: 3px solid #1b5e20; margin-bottom: 24px; }
.prof-name { font-size: 16pt; font-weight: 700; color: #1b5e20; margin: 0; }
.prof-title { font-size: 10pt; color: #555; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0; }

.cover-title { text-align: center; font-size: 22pt; font-weight: 800; color: #1b5e20; margin: 40px 0 8px; letter-spacing: 1px; }
.cover-subtitle { text-align: center; font-size: 11pt; color: #555; margin-bottom: 30px; }

.info-box { background: #f1f8e9; border: 2px solid #a5d6a7; border-radius: 8px; padding: 20px 24px; margin: 20px 0; }
.info-box h3 { font-size: 11pt; color: #2e7d32; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px; }
.info-box p { margin: 4px 0; font-size: 10.5pt; color: #333; }

.section-title { font-size: 14pt; font-weight: 700; color: #1b5e20; border-bottom: 2px solid #c8e6c9; padding-bottom: 6px; margin: 32px 0 16px; page-break-after: avoid; }
.section-h3 { font-size: 12pt; font-weight: 600; color: #2e7d32; margin: 20px 0 10px; page-break-after: avoid; }

.narrative-p { text-align: justify; text-indent: 2em; margin: 0 0 12px; font-size: 11pt; line-height: 1.7; }

table { width: 100%; border-collapse: collapse; margin: 16px 0 20px; page-break-inside: avoid; }
th { background: #e8f5e9; font-weight: 600; font-size: 10pt; color: #1b5e20; padding: 8px 12px; text-align: left; border: 1px solid #a5d6a7; }
td { padding: 7px 12px; font-size: 10pt; border: 1px solid #c8e6c9; color: #333; }
tr:nth-child(even) td { background: #fafff5; }

.highlight-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px 16px; margin: 16px 0; font-size: 10.5pt; page-break-inside: avoid; }
.highlight-box.critical { background: #fce4ec; border-left-color: #e53935; }
.highlight-box.success { background: #e8f5e9; border-left-color: #43a047; }

.metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; page-break-inside: avoid; }
.metric-card { background: #f5f5f5; border-radius: 6px; padding: 12px; text-align: center; border: 1px solid #e0e0e0; }
.metric-value { font-size: 18pt; font-weight: 700; color: #1b5e20; }
.metric-label { font-size: 9pt; color: #666; margin-top: 4px; }
.metric-card.danger .metric-value { color: #c62828; }

.signature-block { text-align: center; margin-top: 60px; page-break-inside: avoid; }
.signature-line { border-top: 1px solid #333; width: 320px; margin: 0 auto 6px; }
.signature-block p { margin: 2px 0; font-size: 10pt; }
.signature-block .name { font-weight: 700; font-size: 11pt; }

.page-break { page-break-before: always; }
.part-divider { page-break-before: always; text-align: center; padding-top: 200px; }
.part-divider h1 { font-size: 28pt; color: #1b5e20; margin-bottom: 12px; }
.part-divider p { font-size: 12pt; color: #666; }

.photos-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; page-break-inside: avoid; }
.photo-item { text-align: center; }
.photo-item img { max-width: 100%; max-height: 280px; border: 1px solid #ccc; border-radius: 6px; object-fit: cover; }
.photo-item .caption { font-size: 9pt; color: #555; margin-top: 6px; font-style: italic; }

.evidence-section { margin: 20px 0; page-break-inside: avoid; }
.evidence-item { background: #fff8e1; border-left: 3px solid #ff9800; padding: 10px 14px; margin: 8px 0; font-size: 10pt; }
.evidence-item .title { font-weight: 600; color: #e65100; }
.evidence-item .detail { color: #555; font-size: 9.5pt; margin-top: 2px; }

.footer-info { text-align: center; margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; font-size: 8pt; color: #999; }

@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const { laudo_id } = await req.json();
    if (!laudo_id) throw new Error("laudo_id é obrigatório");

    const { data: laudo, error: laudoErr } = await supabase
      .from("laudos").select("*").eq("id", laudo_id).single();
    if (laudoErr || !laudo) throw new Error("Laudo não encontrado");

    const { data: profile } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();

    // Fetch photos and evidence documents
    const { data: allDocs } = await supabase
      .from("documentos")
      .select("*")
      .eq("laudo_id", laudo_id);

    const fotoDocs = (allDocs || []).filter((d: any) =>
      d.categoria === "foto_lavoura" || d.categoria === "foto_propriedade"
    );
    const evidenciaDocs = (allDocs || []).filter((d: any) =>
      d.categoria === "decreto_calamidade" || d.categoria === "recorte_noticia"
    );

    // Generate signed URLs for photos
    const fotoUrls: Array<{ url: string; nome: string; categoria: string }> = [];
    for (const foto of fotoDocs) {
      const { data: signedData } = await supabase.storage
        .from("laudos")
        .createSignedUrl(foto.storage_path, 3600);
      if (signedData?.signedUrl) {
        fotoUrls.push({
          url: signedData.signedUrl,
          nome: foto.nome_arquivo,
          categoria: foto.categoria === "foto_lavoura" ? "Foto da Lavoura" : "Foto da Propriedade",
        });
      }
    }

    const e1 = deepEsc((laudo.dados_etapa1 || {}) as Record<string, any>);
    const e3 = deepEsc((laudo.dados_etapa3 || {}) as Record<string, any>);
    const e4 = deepEsc((laudo.dados_etapa4 || {}) as Record<string, any>);
    const e5 = deepEsc((laudo.dados_etapa5 || {}) as Record<string, any>);
    const e6 = deepEsc((laudo.dados_etapa6 || {}) as Record<string, any>);
    const hipoteses = deepEsc(laudo.hipoteses_selecionadas || []);
    const narrativa = laudo.texto_analise_narrativa || "";
    const conclusao = laudo.texto_conclusao || "";

    const profNome = escHtml(profile?.nome || user.email || "N/I");
    const profEsp = escHtml(profile?.especialidade || "Engenheiro(a) Agrônomo(a)");
    const profCrea = escHtml(profile?.crea_numero || "N/I");
    const profCreaUf = escHtml(profile?.crea_uf || "");
    const profCidade = escHtml(profile?.cidade || "");
    const profUf = escHtml(profile?.uf || "");
    const profTel = escHtml(profile?.telefone || "");
    const profAssinatura = escHtml(profile?.assinatura_url || "");

    const today = new Date();
    const dateStr = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    const culturas = (e1.culturas || [e1.cultura]).filter(Boolean);
    const contratos = e1.contratos || [];
    const culturasReceita = e6.culturasReceita || [];

    // Productivity
    const prodEsperada = Number(e4.produtividadeEsperada) || 0;
    const prodRealizada = Number(e4.produtividadeRealizada) || 0;
    const perdaPct = prodEsperada > 0 ? Math.round(((prodEsperada - prodRealizada) / prodEsperada) * 100) : 0;

    // Financial projection
    const totalLucroBruto = culturasReceita.reduce((acc: number, c: any) => {
      return acc + (Number(c.areaHa) || 0) * (Number(c.sacasHa) || 0) * (Number(c.valorMedioSaca) || 0);
    }, 0);
    const custoProducao = Number(e6.custoMedioProducao) || 0;
    const despesasPessoais = Number(e6.despesasPessoais) || 0;
    const valorDivida = Number(e6.valorDivida) || 0;
    const prospeccaoPagamento = totalLucroBruto - custoProducao - despesasPessoais;

    // Generate AI narrative per culture if not present
    let aiNarrative = narrativa;
    let aiConclusion = conclusao;

    if (!aiNarrative || !aiConclusion) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const culturasInfo = culturas.map((c: string) => `- ${c}`).join("\n");
          const hipotesesInfo = hipoteses.map((h: string) => `${h} - ${hipLabels[h] || h}`).join("; ");

          const prompt = `Você é um engenheiro agrônomo perito em laudos técnicos para prorrogação de dívida rural (MCR 2.6.4).

Gere um LAUDO DE PERDA completo e detalhado seguindo EXATAMENTE esta estrutura:

DADOS:
- Produtor: ${e1.nome || "N/I"} (${e1.documento || "N/I"})
- Propriedade: ${e1.nomePropriedade || "N/I"} em ${e1.municipio || "N/I"}-${e1.uf || "N/I"}
- Área total: ${e1.areaTotal || "N/I"} ha | Área cultivada: ${e1.areaCultivada || "N/I"} ha
- Culturas: ${culturas.join(", ") || "N/I"}
- Safra: ${e1.safra || "N/I"}
- Hipóteses MCR: ${hipotesesInfo || "Nenhuma"}
- Justificativa: ${e3.justificativa || "N/I"}
- Produtividade esperada: ${prodEsperada} sc/ha | Realizada: ${prodRealizada} sc/ha
- Perda: ${perdaPct}%

ESTRUTURA OBRIGATÓRIA DO LAUDO DE PERDA:

1. Parágrafo de abertura identificando produtor e agrônomo (NÃO gere isso, será inserido automaticamente)

2. # INTRODUÇÃO - AGRICULTURA
Contextualização geral da importância da agricultura e das culturas específicas (${culturas.join(", ")}).

3. Para CADA cultura, gere uma seção separada:
${culturas.map((c: string) => `# CULTURA DO(A) ${c.toUpperCase()} - SAFRA ${e1.safra || "N/I"} - ${hipoteses.includes("b") ? "SECA" : hipoteses.includes("a") ? "DIFICULDADE MERCADOLÓGICA" : "ADVERSIDADE"}
Análise técnica detalhada dos impactos na cultura específica, com pelo menos 4 parágrafos.`).join("\n\n")}

4. Se aplicável, gere seções extras:
${hipoteses.includes("a") ? `# CULTURA DO(A) ${culturas[0]?.toUpperCase() || "PRODUTO"} - QUEDA DE PREÇO E DESVALORIZAÇÃO
Análise da queda de preços e impacto na rentabilidade.` : ""}
${hipoteses.includes("c") ? `# CUSTOS DE PRODUÇÃO
Análise do aumento dos custos de produção.` : ""}

===CONCLUSAO===

# CONCLUSÃO
Conclusão técnica formal confirmando as perdas do produtor, mencionando cada cultura e adversidade, e que os infortúnios geraram desequilíbrio financeiro configurando impedimento na quitação dos débitos. Finalize com "Certo de vossa compreensão, coloco-me à disposição para eventuais elucidações."

IMPORTANTE: Linguagem técnica formal, jurídica. Cada seção com pelo menos 3-4 parágrafos densos. Use "atesto que", "depreende-se que", "é irrefutável", "outrossim", "destarte".`;

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "Você é um engenheiro agrônomo perito judicial especializado em laudos técnicos rurais para prorrogação de dívida rural. Gere conteúdo extenso, técnico e detalhado." },
                { role: "user", content: prompt },
              ],
              stream: false,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            const content = result.choices?.[0]?.message?.content || "";
            const parts = content.split("===CONCLUSAO===");
            if (!aiNarrative && parts[0]) aiNarrative = parts[0].trim();
            if (!aiConclusion && parts[1]) aiConclusion = parts[1].trim();
          }
        } catch (aiErr) {
          console.error("AI generation error:", aiErr);
        }
      }
    }

    const narrativeHtml = formatNarrative(aiNarrative);
    const conclusionHtml = formatNarrative(aiConclusion);

    // Build header helper
    const header = () => `<div class="page-header"><p class="prof-name">${profNome}</p><p class="prof-title">${profEsp}</p></div>`;
    const signatureBlock = () => `
<p style="text-align:right;margin-top:24px;font-size:10pt;color:#555;">${profCidade}${profCidade && profUf ? "/" : ""}${profUf}, ${dateStr}</p>
<div class="signature-block">
  ${profAssinatura ? `<img src="${profAssinatura}" style="max-height:60px;margin:0 auto 8px;display:block;" alt="Assinatura"/>` : ""}
  <div class="signature-line"></div>
  <p class="name">${profNome.toUpperCase()}</p>
  <p>${profEsp}</p>
  <p>CREA: ${profCrea}/${profCreaUf}</p>
</div>`;

    const footerInfo = () => `<div class="footer-info"><p>Laudo técnico gerado por LaudoAgro — ${dateStr}${profCidade ? ` — ${profCidade}/${profUf}` : ""}${profTel ? ` — Fone: ${profTel}` : ""}</p></div>`;

    // Contratos table rows
    const contratosRows = contratos.length > 0
      ? contratos.map((c: any) => {
          const bancoStr = Array.isArray(c.banco) ? c.banco.join(", ") : (c.banco || "N/I");
          return `<tr>
            <td>${c.contrato || "N/I"}</td>
            <td>${fmt(c.valorOriginal)}</td>
            <td>${c.dataVencimento || "N/I"}</td>
            <td>${c.modalidade || "N/I"}</td>
            <td>${fmt(c.saldoDevedor)}</td>
            <td>${bancoStr}</td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="6" style="text-align:center;">Nenhum contrato informado</td></tr>`;

    // Culturas receita table rows
    const culturasReceitaRows = culturasReceita.map((c: any) => {
      const area = Number(c.areaHa) || 0;
      const sacas = Number(c.sacasHa) || 0;
      const valor = Number(c.valorMedioSaca) || 0;
      const totalSacas = area * sacas;
      const lucroBruto = totalSacas * valor;
      return `<tr>
        <td>${c.cultura || "N/I"}</td>
        <td style="text-align:right;">${fmtNum(area)}</td>
        <td style="text-align:right;">${fmtNum(sacas)}</td>
        <td style="text-align:right;">${fmtNum(totalSacas)}</td>
        <td style="text-align:right;">${fmt(valor)}</td>
        <td style="text-align:right;font-weight:600;">${fmt(lucroBruto)}</td>
      </tr>`;
    }).join("");

    // Build banco credor info (from first contract or e1)
    const bancoPrincipal = contratos.length > 0
      ? (Array.isArray(contratos[0].banco) ? contratos[0].banco.join(", ") : contratos[0].banco) || e1.banco || "N/I"
      : e1.banco || "N/I";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Laudo Técnico - ${escHtml(laudo.numero_laudo)}</title>
<style>${CSS}</style>
</head>
<body>

<!-- ============================================================ -->
<!-- PARTE 1 — LAUDO DE PERDA                                     -->
<!-- ============================================================ -->

${header()}

<h1 class="cover-title">LAUDO DE PERDA</h1>

<p class="narrative-p" style="margin-top:30px;">Conforme declaração do(a) produtor(a) rural: <strong>${e1.nome || "N/I"}</strong>, ${e1.estadoCivil || "brasileiro(a)"}, produtor(a) rural, residente e domiciliado(a) ${e1.endereco ? `a ${e1.endereco}` : `no Município de ${e1.municipio || "N/I"}, no Estado de ${e1.uf || "N/I"}`}, inscrito(a) no CPF/CNPJ sob nº ${e1.documento || "N/I"}, eu, <strong>${profNome}</strong>, ${profEsp}, CREA: ${profCrea}/${profCreaUf}, testifico as informações abaixo:</p>

<p class="narrative-p">Por meio do presente laudo, atesto que o(a) Sr(a). <strong>${e1.nome || "N/I"}</strong> foi severamente prejudicado(a) em suas produções das culturas de ${culturas.join(" e ").toLowerCase() || "N/I"} em razão do acometimento das lavouras ${hipoteses.includes("b") ? "pela adversidade climática" : ""}${hipoteses.includes("a") ? `${hipoteses.includes("b") ? ", bem como pela " : "pela "}dificuldade de comercialização dos produtos` : ""}${hipoteses.includes("c") ? `${hipoteses.length > 1 ? ", além de " : "pela "}ocorrência de pragas e doenças` : ""}. Desse modo, a conjugação desses fatores adversos resultou em perdas relevantes de produtividade nas lavouras.</p>

<!-- AI NARRATIVE (per-culture sections) -->
${aiNarrative ? `
<div class="page-break"></div>
${header()}
${narrativeHtml}
` : ""}

<!-- FOTOS DA LAVOURA / PROPRIEDADE -->
${fotoUrls.length > 0 ? `
<div class="page-break"></div>
${header()}
<h2 class="section-title">REGISTRO FOTOGRÁFICO</h2>
<p class="narrative-p">As fotografias a seguir foram obtidas durante a vistoria técnica na propriedade rural do(a) Sr(a). <strong>${e1.nome || "N/I"}</strong>, localizada no Município de ${e1.municipio || "N/I"}-${e1.uf || "N/I"}, e comprovam os danos causados pelas adversidades às lavouras.</p>
<div class="photos-grid">
${fotoUrls.map((f) => `
  <div class="photo-item">
    <img src="${escHtml(f.url)}" alt="${escHtml(f.nome)}" />
    <div class="caption">${escHtml(f.categoria)}: ${escHtml(f.nome)}</div>
  </div>
`).join("")}
</div>
` : ""}

<!-- EVIDÊNCIAS (Decretos e Notícias) -->
${evidenciaDocs.length > 0 ? `
<div class="evidence-section">
<h2 class="section-title">DOCUMENTOS COMPROBATÓRIOS</h2>
${evidenciaDocs.map((d: any) => `
  <div class="evidence-item">
    <div class="title">${d.categoria === "decreto_calamidade" ? "📋 Decreto de Calamidade" : "📰 Recorte de Notícia"}</div>
    <div class="detail">${escHtml(d.nome_arquivo)}</div>
  </div>
`).join("")}
</div>
` : ""}

<!-- CONCLUSION of Laudo de Perda -->
<div class="page-break"></div>
${header()}

<h2 class="section-title">CONCLUSÃO</h2>

${aiConclusion ? conclusionHtml : `
<p class="narrative-p">Por fim, confirmo neste laudo que, durante o exercício da safra ${e1.safra || "N/I"}, o(a) Sr(a). <strong>${e1.nome || "N/I"}</strong> foi severamente prejudicado(a) na produção das culturas de ${culturas.join(" e ").toLowerCase() || "N/I"} em razão das adversidades enfrentadas. A conjugação desses fatores adversos resultou em perdas relevantes, gerando desequilíbrio financeiro e configurando impedimento na quitação de seus débitos.</p>

<p class="narrative-p">Certo de vossa compreensão, coloco-me à disposição para eventuais elucidações.</p>
`}

<p style="text-align:center;margin-top:8px;font-size:10pt;color:#555;">Cordialmente,</p>

${signatureBlock()}

<!-- ============================================================ -->
<!-- PARTE 2 — LAUDO DE CAPACIDADE DE PAGAMENTO                   -->
<!-- ============================================================ -->

<div class="part-divider">
  <h1>PARTE II</h1>
  <p>Laudo de Capacidade de Pagamento</p>
</div>

<div class="page-break"></div>
${header()}

<h1 class="cover-title">LAUDO DE CAPACIDADE DE PAGAMENTO</h1>

<div class="info-box">
  <h3>Emitente</h3>
  <p><strong>${e1.nome || "N/I"}</strong>, ${e1.estadoCivil || "brasileiro(a)"}, produtor(a) rural, residente e domiciliado(a) ${e1.endereco ? `a ${e1.endereco}` : `no Município de ${e1.municipio || "N/I"}, no Estado de ${e1.uf || "N/I"}`}, inscrito(a) no CPF/CNPJ sob nº ${e1.documento || "N/I"}.</p>
</div>

<div class="info-box">
  <h3>Credor</h3>
  <p><strong>${bancoPrincipal}</strong></p>
</div>

<p class="narrative-p">No presente laudo estão apresentados os dados da operação de Crédito Rural realizada com: <strong>${bancoPrincipal}</strong>, pelo(a) tomador(a) descrito(a) acima para subsidiar o cálculo da sua capacidade de pagamento.</p>

<p class="narrative-p">Ademais, as informações apresentadas foram obtidas através de relatos e relatórios provenientes do(a) produtor(a) rural, quanto à operação existente a referência foi adquirida junto à instituição financeira.</p>

<!-- Dados da Operação -->
<div class="page-break"></div>
${header()}

<h2 class="section-title">Dados da Operação</h2>

<table>
  <tr>
    <th>Nº Operação</th>
    <th>Valor do Financiamento</th>
    <th>Vencimento</th>
    <th>Modalidade</th>
    <th>Saldo Devedor</th>
    <th>Instituição</th>
  </tr>
  ${contratosRows}
</table>

<p class="narrative-p">Desse modo, embora o valor mencionado acima se apresente como montante significativo, o(a) Sr(a). <strong>${e1.nome || "N/I"}</strong> não se abateu e com o objetivo de se reestabelecer economicamente e se comprometer de maneira fidedigna com a honraria de seu débito pendente partiu em busca de alternativa para que o potencial produtivo e econômico da propriedade se elevasse.</p>

<p class="narrative-p">Isto posto, o(a) agricultor(a) investiu em técnicas que facilitam o desenvolvimento das culturas em suas áreas, aumentam a produtividade e garantem mais rentabilidade ao agronegócio. Em suma, a partir dos cultivos de ${culturas.join(" e ").toLowerCase() || "N/I"} de qualidade, o avanço das lavouras se deu por intermédio das seguintes ações:</p>

<ol style="margin: 8px 0 16px 24px; font-size: 10.5pt; line-height: 1.7;">
  <li style="margin-bottom:8px;"><strong>Análise da Época e condições climáticas:</strong> o cronograma de plantio foi precedido pelos indicativos mensurados no Zoneamento Agrícola de Risco Climático (ZARC). Portanto, o(a) produtor(a) rural adotou o gerenciamento máximo dos riscos de forma a amenizar quaisquer impactos provindos das adversidades climáticas;</li>
  <li style="margin-bottom:8px;"><strong>Proteção antes da germinação:</strong> técnica utilizada no tratamento de sementes que protege a saúde da planta e aumenta a resistência garantindo maior rendimento de produtividade;</li>
  <li style="margin-bottom:8px;"><strong>Preparo do solo:</strong> o(a) produtor(a) reforçou o manejo das propriedades físicas, químicas e biológicas do solo, resultando em boa fertilidade e desenvolvimento radicular;</li>
  <li style="margin-bottom:8px;"><strong>Manejo de pragas, doenças e ervas daninhas:</strong> controle preventivo mecânico e químico das plantações, rotação de cultura e uso de cobertura de restos vegetais.</li>
</ol>

<!-- Receita por Cultura -->
<h2 class="section-title">Projeção de Receita por Cultura</h2>

<p class="narrative-p">Em destaque, os dados de receita anual do(a) Sr(a). <strong>${e1.nome || "N/I"}</strong> na propriedade localizada no Município de ${e1.municipio || "N/I"}, no Estado de ${e1.uf || "N/I"}. Vale mencionar que os dados das projeções futuras foram baseados nos históricos anteriores e na ocorrência dentro da normalidade de cada safra na propriedade:</p>

${culturasReceita.length > 0 ? `
<table>
  <tr>
    <th>Cultura</th>
    <th style="text-align:right;">Área (ha)</th>
    <th style="text-align:right;">Sacas/ha</th>
    <th style="text-align:right;">Total sacas</th>
    <th style="text-align:right;">Valor médio saca</th>
    <th style="text-align:right;">Lucro bruto (anual)</th>
  </tr>
  ${culturasReceitaRows}
  <tr style="background:#e8f5e9;font-weight:700;">
    <td colspan="5" style="text-align:right;border:1px solid #a5d6a7;">Total Lucro Bruto (Anual):</td>
    <td style="text-align:right;border:1px solid #a5d6a7;color:#1b5e20;">${fmt(totalLucroBruto)}</td>
  </tr>
</table>
<p style="font-size:9pt;color:#666;font-style:italic;margin-top:-12px;">Obs.: os valores médios podem oscilar conforme o mercado financeiro.</p>
` : ""}

<!-- Quadro Comparativo -->
<div class="page-break"></div>
${header()}

<h2 class="section-title">Quadro Comparativo — Capacidade de Pagamento</h2>

<p class="narrative-p">Por conseguinte, a fim de adequar seus débitos, para melhor atender ao interesse da instituição financeira, principalmente no que concerne ao adimplemento do débito, e considerar a dilação do início de quitação da dívida rural, elaborou-se o seguinte quadro comparativo (em valores atualizados):</p>

<table>
  <tr>
    <th style="text-align:center;">Valor Dívida</th>
    <th style="text-align:center;">Lucro Bruto (Anual)</th>
    <th style="text-align:center;">Custo Produções (Anual)</th>
    <th style="text-align:center;">Desp. Pessoais (Anual)</th>
    <th style="text-align:center;">Prospecção Pgto. (Anual)</th>
  </tr>
  <tr>
    <td style="text-align:center;font-weight:600;">${fmt(valorDivida)}</td>
    <td style="text-align:center;">${fmt(totalLucroBruto)}</td>
    <td style="text-align:center;">${fmt(custoProducao)}</td>
    <td style="text-align:center;">${fmt(despesasPessoais)}</td>
    <td style="text-align:center;font-weight:700;color:${prospeccaoPagamento >= 0 ? '#2e7d32' : '#c62828'};">${fmt(prospeccaoPagamento)}</td>
  </tr>
</table>

${prospeccaoPagamento > 0 ? `
<p class="narrative-p">A tabela acima tem como finalidade credenciar a realidade do(a) agricultor(a) de forma legítima, para o pagamento dos contratos em aberto. Portanto, de acordo com os cálculos e a análise técnica, foi possível mensurar a prospecção do(a) cliente, sob a qual podemos inferir uma capacidade de pagamento com margem de carência de aproximadamente <strong>${e6.carenciaSugerida || "2"} (${numberToWords(Number(e6.carenciaSugerida) || 2)}) ano(s)</strong> e com o prazo de pagamento para até <strong>${e6.prazoSugerido || "8"} (${numberToWords(Number(e6.prazoSugerido) || 8)}) ano(s)</strong>.</p>

<p class="narrative-p">Em suma, a previsão é que os benefícios proporcionados pela prorrogação sejam significativamente positivos, tornando possível que o(a) Sr(a). <strong>${e1.nome || "N/I"}</strong> possa honrar os seus compromissos financeiros, sem repercutir negativamente em seu próprio sustento.</p>
` : `
<div class="highlight-box critical">
  <strong>Análise:</strong> O resultado financeiro anual de ${fmt(prospeccaoPagamento)} é insuficiente para cobrir o saldo devedor de ${fmt(valorDivida)}, evidenciando a incapacidade de pagamento e a necessidade de condições especiais para a prorrogação.
</div>
`}

<p style="text-align:center;margin-top:16px;font-size:10pt;color:#555;">Certo de vossa compreensão, coloco-me à disposição para eventuais elucidações.</p>
<p style="text-align:center;font-size:10pt;color:#555;">Cordialmente,</p>

${signatureBlock()}

${footerInfo()}

</body>
</html>`;

    // Update laudo status
    await supabase.from("laudos").update({ status: "finalizado" }).eq("id", laudo_id);

    return new Response(JSON.stringify({ html, numero: laudo.numero_laudo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gerar-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function numberToWords(n: number): string {
  const words: Record<number, string> = {
    1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco",
    6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
    11: "onze", 12: "doze", 15: "quinze", 20: "vinte",
  };
  return words[n] || String(n);
}
