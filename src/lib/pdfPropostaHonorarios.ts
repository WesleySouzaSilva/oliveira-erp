import jsPDF from "jspdf";
import logoAdvogados from "@/assets/oliveira-advogados-horizontal-dark.png";

export interface PropostaHonorariosData {
  clienteNome: string;
  clienteDocumento?: string; // CPF ou CNPJ
  numeroProposta?: string;   // ex: PROP-2026-00042
  valorDivida: number;
  faixaId: number;
  complexidadeLabel: string;
  complexidadeMult: number;
  pctInicial: number; // ex: 0.05
  pctExito: number;   // ex: 0.05
  honorarioInicial: number;
  honorarioExito: number;
  total: number;
  operadorNome?: string;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtDataBR = (d: Date) => d.toLocaleDateString("pt-BR");
const fmtPct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

// ----- Dados fixos do escritório -----
const ESCRITORIO = {
  nome: "Oliveira Advogados",
  cnpj: "47.710.748/0001-41",
  oab: "OAB/PR",
  endereco: "Rua Heráclio Mendes de Camargo, 605 — Castro/PR",
  site: "www.advogadosoliveira.com.br",
  telefone: "0800 661 6161",
};

const DADOS_BANCARIOS = {
  banco: "Banco Sicredi",
  pixChave: "47.710.748/0001-41",
  pixTipo: "CNPJ",
  favorecido: "Oliveira Advogados",
};

const COR_VERDE: [number, number, number] = [27, 67, 50];      // verde-floresta
const COR_AMBAR: [number, number, number] = [217, 119, 6];     // âmbar
const COR_TEXTO: [number, number, number] = [33, 37, 41];
const COR_CINZA: [number, number, number] = [107, 114, 128];
const COR_FUNDO: [number, number, number] = [248, 250, 247];

async function carregarLogo(): Promise<string> {
  const res = await fetch(logoAdvogados);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function gerarPropostaHonorariosPDF(d: PropostaHonorariosData): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margem = 48;
  const contentW = pageW - margem * 2;
  const dataEmissao = new Date();
  const dataValidade = new Date(dataEmissao);
  dataValidade.setDate(dataValidade.getDate() + 15);
  const numProp =
    d.numeroProposta ??
    `PROP-${dataEmissao.getFullYear()}-${String(Date.now()).slice(-5)}`;

  // Helper local: garante que um bloco caiba na página, senão pula
  const ensure = (yAtual: number, alturaBloco: number, topoNovo = 60): number => {
    if (yAtual + alturaBloco > pageH - 80) {
      doc.addPage();
      return topoNovo;
    }
    return yAtual;
  };

  // ===== CABEÇALHO =====
  doc.setFillColor(...COR_VERDE);
  doc.rect(0, 0, pageW, 110, "F");

  try {
    const logo = await carregarLogo();
    // Logo horizontal — proporção real ~4.3:1 (1920x446)
    doc.addImage(logo, "PNG", margem, 38, 190, 44);
  } catch {
    /* segue sem logo se falhar */
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Proposta de Honorários", pageW - margem, 50, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Alongamento / Reestruturação de Dívida", pageW - margem, 68, { align: "right" });
  doc.text(`Nº ${numProp}`, pageW - margem, 84, { align: "right" });
  doc.text(
    `Emitida em ${fmtDataBR(dataEmissao)}   |   Válida até ${fmtDataBR(dataValidade)}`,
    pageW - margem,
    98,
    { align: "right" },
  );

  let y = 150;
  doc.setTextColor(...COR_TEXTO);

  // ===== DESTINATÁRIO =====
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COR_CINZA);
  doc.text("DESTINATÁRIO", margem, y);
  y += 16;
  doc.setTextColor(...COR_TEXTO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(d.clienteNome, margem, y);
  y += 16;
  if (d.clienteDocumento && d.clienteDocumento.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COR_CINZA);
    const docLabel = d.clienteDocumento.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF";
    doc.text(`${docLabel}: ${d.clienteDocumento}`, margem, y);
    y += 14;
  }
  y += 14;

  // ===== QUEM SOMOS =====
  y = sec(doc, "QUEM SOMOS", y, margem);
  y = paragrafo(
    doc,
    "A Oliveira Advogados é um escritório especializado em reestruturação de passivos rurais, com atuação dedicada ao produtor brasileiro. Combinamos análise técnica agronômica (MCR 2.6.4) e estratégia jurídica para alongar dívidas, contestar abusividades e preservar a continuidade da atividade rural. Sediados em Castro/PR, atendemos produtores em todo o território nacional.",
    y,
    margem,
    contentW,
  );
  y += 14;

  // ===== APRESENTAÇÃO DO ESCRITÓRIO =====
  y = sec(doc, "APRESENTAÇÃO DO ESCRITÓRIO", y, margem);
  y = paragrafo(
    doc,
    "Nosso time é formado por advogados, engenheiros agrônomos e analistas financeiros com vivência no agronegócio. Atuamos com base em laudos técnicos próprios, fundamentação científica e jurisprudência consolidada — entregando ao produtor uma defesa robusta e tecnicamente sustentável diante de instituições financeiras.",
    y,
    margem,
    contentW,
  );
  y += 14;

  // ===== ESCOPO DA PROPOSTA =====
  y = sec(doc, "O QUE ENGLOBA ESTA PROPOSTA", y, margem);
  const itens = [
    "Diagnóstico completo da operação rural e dos contratos vigentes;",
    "Análise técnica e jurídica da dívida (MCR 2.6.4, frustração de safra, abusividade);",
    "Elaboração de laudo agronômico fundamentado, quando cabível;",
    "Negociação extrajudicial junto à instituição financeira;",
    "Atuação judicial — petição inicial, tutela de urgência e acompanhamento processual;",
    "Formalização do acordo de alongamento ou reestruturação;",
    "Suporte contínuo até a quitação ou homologação do acordo.",
  ];
  y = bullets(doc, itens, y, margem, contentW);
  y += 14;

  if (y > pageH - 320) { doc.addPage(); y = 60; }

  // ===== HONORÁRIOS =====
  y = ensure(y, 260);
  y = sec(doc, "HONORÁRIOS PROPOSTOS", y, margem);

  // Card cinza com valor da dívida
  doc.setFillColor(...COR_FUNDO);
  doc.roundedRect(margem, y, contentW, 56, 6, 6, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COR_CINZA);
  doc.text("Valor total da dívida", margem + 16, y + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COR_TEXTO);
  doc.text(fmtBRL(d.valorDivida), margem + 16, y + 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COR_CINZA);
  doc.text(`Faixa ${d.faixaId} aplicada`, pageW - margem - 16, y + 22, { align: "right" });
  y += 76;

  // Dois cards lado a lado
  const colW = (contentW - 12) / 2;
  // Inicial
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margem, y, colW, 86, 6, 6, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COR_CINZA);
  doc.text("Honorário inicial", margem + 14, y + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR_TEXTO);
  doc.text(
    `Percentual: ${fmtPct(d.pctInicial * d.complexidadeMult * 100)} sobre a dívida`,
    margem + 14,
    y + 40,
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COR_TEXTO);
  doc.text(fmtBRL(d.honorarioInicial), margem + 14, y + 66);

  // Êxito
  const x2 = margem + colW + 12;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x2, y, colW, 86, 6, 6, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COR_CINZA);
  doc.text("Honorário de êxito", x2 + 14, y + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR_TEXTO);
  doc.text("Devido apenas em caso de", x2 + 14, y + 38);
  doc.text("resultado positivo (alongamento", x2 + 14, y + 52);
  doc.text("ou reestruturação)", x2 + 14, y + 66);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(34, 139, 34);
  doc.text(fmtBRL(d.honorarioExito), x2 + 14, y + 66);
  y += 96;

  // Total
  y = ensure(y, 56);
  doc.setFillColor(...COR_VERDE);
  doc.roundedRect(margem, y, contentW, 56, 6, 6, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL DA PROPOSTA", margem + 16, y + 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(fmtBRL(d.total), pageW - margem - 16, y + 38, { align: "right" });
  y += 76;

  // ===== DADOS PARA PAGAMENTO =====
  y = ensure(y, 110);
  y = sec(doc, "DADOS PARA PAGAMENTO DO HONORÁRIO INICIAL", y, margem);
  doc.setFillColor(...COR_FUNDO);
  doc.roundedRect(margem, y, contentW, 58, 6, 6, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COR_TEXTO);
  doc.text(`Favorecido: ${DADOS_BANCARIOS.favorecido}`, margem + 14, y + 20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COR_VERDE);
  doc.text(`PIX (${DADOS_BANCARIOS.pixTipo}): ${DADOS_BANCARIOS.pixChave}`, margem + 14, y + 40);
  y += 76;

  // ===== CONDIÇÕES =====
  y = ensure(y, 140);
  y = sec(doc, "CONDIÇÕES", y, margem);
  y = bullets(
    doc,
    [
      "O honorário inicial é devido na contratação dos serviços;",
      "O honorário de êxito é devido somente em caso de resultado positivo (alongamento, reestruturação ou redução da dívida);",
      "Custas processuais e despesas com peritos, quando houver, correm por conta do contratante;",
      `Proposta válida até ${fmtDataBR(dataValidade)} (15 dias da emissão).`,
    ],
    y, margem, contentW,
  );
  y += 10;

  // ===== ACEITE =====
  y = ensure(y, 150);
  y = sec(doc, "ACEITE DA PROPOSTA", y, margem);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COR_TEXTO);
  doc.text(
    "Manifestando concordância com os termos acima, as partes assinam:",
    margem,
    y,
  );
  y += 40;

  const colAceite = (contentW - 30) / 2;
  // Cliente
  doc.setDrawColor(...COR_TEXTO);
  doc.setLineWidth(0.6);
  doc.line(margem, y, margem + colAceite, y);
  doc.setFontSize(9);
  doc.setTextColor(...COR_CINZA);
  doc.text("CONTRATANTE", margem, y + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COR_TEXTO);
  doc.text(d.clienteNome, margem, y + 28);
  if (d.clienteDocumento) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COR_CINZA);
    doc.text(d.clienteDocumento, margem, y + 40);
  }

  // Escritório
  const xAceite2 = margem + colAceite + 30;
  doc.setDrawColor(...COR_TEXTO);
  doc.line(xAceite2, y, xAceite2 + colAceite, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR_CINZA);
  doc.text("CONTRATADO", xAceite2, y + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COR_TEXTO);
  doc.text(ESCRITORIO.nome, xAceite2, y + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR_CINZA);
  doc.text(`${ESCRITORIO.oab} — Castro/PR`, xAceite2, y + 40);
  y += 60;

  doc.setFontSize(9);
  doc.setTextColor(...COR_CINZA);
  doc.text(
    `Castro/PR, ${fmtDataBR(dataEmissao)}`,
    pageW / 2,
    y,
    { align: "center" },
  );

  // ===== RODAPÉ =====
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COR_VERDE);
    doc.setLineWidth(0.5);
    doc.line(margem, pageH - 50, pageW - margem, pageH - 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COR_CINZA);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COR_VERDE);
    doc.text(`Oliveira Advogados — CNPJ ${ESCRITORIO.cnpj}`, margem, pageH - 34);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COR_CINZA);
    doc.text("Rua Heráclio Mendes de Camargo, 605 — Castro/PR", margem, pageH - 22);
    doc.text("www.advogadosoliveira.com.br   |   0800 661 6161", margem, pageH - 11);
    doc.text(`${i} / ${totalPaginas}`, pageW - margem, pageH - 11, { align: "right" });
    if (d.operadorNome) {
      doc.text(`Consultor: ${d.operadorNome}`, pageW - margem, pageH - 34, { align: "right" });
    }
  }

  return doc.output("blob");
}

// ---------- helpers ----------
function sec(doc: jsPDF, titulo: string, y: number, margem: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COR_VERDE);
  doc.text(titulo, margem, y);
  doc.setDrawColor(...COR_AMBAR);
  doc.setLineWidth(1.5);
  doc.line(margem, y + 4, margem + 32, y + 4);
  return y + 20;
}

function paragrafo(doc: jsPDF, texto: string, y: number, margem: number, largura: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...COR_TEXTO);
  const linhas = doc.splitTextToSize(texto, largura);
  doc.text(linhas, margem, y);
  return y + linhas.length * 14;
}

function bullets(doc: jsPDF, itens: string[], y: number, margem: number, largura: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...COR_TEXTO);
  for (const item of itens) {
    doc.setTextColor(...COR_AMBAR);
    doc.text("•", margem, y);
    doc.setTextColor(...COR_TEXTO);
    const linhas = doc.splitTextToSize(item, largura - 14);
    doc.text(linhas, margem + 12, y);
    y += linhas.length * 14 + 2;
  }
  return y;
}