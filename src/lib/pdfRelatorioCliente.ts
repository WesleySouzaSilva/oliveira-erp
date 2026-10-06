import jsPDF from "jspdf";
import logoAdvogados from "@/assets/oliveira-advogados-horizontal-dark.png";

const COR_VERDE: [number, number, number] = [27, 67, 50];
const COR_AMBAR: [number, number, number] = [217, 119, 6];
const COR_TEXTO: [number, number, number] = [33, 37, 41];
const COR_CINZA: [number, number, number] = [107, 114, 128];

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

export interface RelatorioClientePDFData {
  clienteNome: string;
  conteudoMarkdown: string;
  dataEmissao?: Date;
}

type Bloco =
  | { tipo: "h1" | "h2" | "h3" | "p"; texto: string }
  | { tipo: "ul"; itens: string[] };

// Converte markdown simples (#, ##, ###, -, *, parágrafos) em blocos
function parseMarkdown(md: string): Bloco[] {
  const linhas = md.replace(/\r\n/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  let buffParag: string[] = [];
  let buffLista: string[] = [];

  const flushParag = () => {
    if (buffParag.length) {
      blocos.push({ tipo: "p", texto: limparInline(buffParag.join(" ").trim()) });
      buffParag = [];
    }
  };
  const flushLista = () => {
    if (buffLista.length) {
      blocos.push({ tipo: "ul", itens: buffLista.map(limparInline) });
      buffLista = [];
    }
  };

  for (const raw of linhas) {
    const linha = raw.trimEnd();
    if (!linha.trim()) {
      flushParag();
      flushLista();
      continue;
    }
    const h3 = linha.match(/^###\s+(.*)/);
    const h2 = linha.match(/^##\s+(.*)/);
    const h1 = linha.match(/^#\s+(.*)/);
    const li = linha.match(/^\s*[-*•]\s+(.*)/);
    if (h1) { flushParag(); flushLista(); blocos.push({ tipo: "h1", texto: limparInline(h1[1]) }); continue; }
    if (h2) { flushParag(); flushLista(); blocos.push({ tipo: "h2", texto: limparInline(h2[1]) }); continue; }
    if (h3) { flushParag(); flushLista(); blocos.push({ tipo: "h3", texto: limparInline(h3[1]) }); continue; }
    if (li) { flushParag(); buffLista.push(li[1]); continue; }
    flushLista();
    buffParag.push(linha);
  }
  flushParag();
  flushLista();
  return blocos;
}

function limparInline(s: string): string {
  // remove **bold** e *italic* e `code` mantendo o texto
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|\s)\*(?!\s)(.+?)\*(?!\w)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}

export async function gerarRelatorioClientePDF(d: RelatorioClientePDFData): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margem = 48;
  const contentW = pageW - margem * 2;
  const dataEmissao = d.dataEmissao ?? new Date();

  let logoDataUrl: string | null = null;
  try { logoDataUrl = await carregarLogo(); } catch { /* ignore */ }

  const desenharCabecalho = () => {
    doc.setFillColor(...COR_VERDE);
    doc.rect(0, 0, pageW, 70, "F");
    if (logoDataUrl) {
      try { doc.addImage(logoDataUrl, "PNG", margem, 16, 140, 38); } catch { /* ignore */ }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Relatório ao Cliente", pageW - margem, 32, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(dataEmissao.toLocaleDateString("pt-BR"), pageW - margem, 48, { align: "right" });
  };

  const desenharRodape = (numPag: number, totalPag: number) => {
    doc.setDrawColor(...COR_AMBAR);
    doc.setLineWidth(0.6);
    doc.line(margem, pageH - 38, pageW - margem, pageH - 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COR_CINZA);
    doc.text("Oliveira Advogados — Se é Agro, começa aqui.", margem, pageH - 22);
    doc.text(`Página ${numPag} de ${totalPag}`, pageW - margem, pageH - 22, { align: "right" });
  };

  desenharCabecalho();
  let y = 96;

  // Bloco do cliente
  doc.setTextColor(...COR_TEXTO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Cliente:", margem, y);
  doc.setFont("helvetica", "normal");
  doc.text(d.clienteNome, margem + 50, y);
  y += 22;

  const ensure = (alturaBloco: number) => {
    if (y + alturaBloco > pageH - 60) {
      doc.addPage();
      desenharCabecalho();
      y = 96;
    }
  };

  const blocos = parseMarkdown(d.conteudoMarkdown);

  for (const bloco of blocos) {
    if (bloco.tipo === "h1" || bloco.tipo === "h2" || bloco.tipo === "h3") {
      const tamanho = bloco.tipo === "h1" ? 15 : bloco.tipo === "h2" ? 13 : 11;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(tamanho);
      doc.setTextColor(...COR_VERDE);
      const linhas = doc.splitTextToSize(bloco.texto, contentW);
      ensure(linhas.length * (tamanho + 4) + 8);
      y += 6;
      doc.text(linhas, margem, y);
      y += linhas.length * (tamanho + 4) + 4;
      doc.setTextColor(...COR_TEXTO);
    } else if (bloco.tipo === "p") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...COR_TEXTO);
      const linhas = doc.splitTextToSize(bloco.texto, contentW);
      for (const ln of linhas) {
        ensure(14);
        doc.text(ln, margem, y);
        y += 14;
      }
      y += 4;
    } else if (bloco.tipo === "ul") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...COR_TEXTO);
      for (const item of bloco.itens) {
        const linhas = doc.splitTextToSize(item, contentW - 16);
        ensure(linhas.length * 14);
        doc.setTextColor(...COR_AMBAR);
        doc.text("•", margem + 2, y);
        doc.setTextColor(...COR_TEXTO);
        doc.text(linhas, margem + 16, y);
        y += linhas.length * 14;
      }
      y += 4;
    }
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    desenharRodape(i, total);
  }

  return doc.output("blob");
}

export function nomeArquivoRelatorio(clienteNome: string, data = new Date()): string {
  const slug = clienteNome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "cliente";
  const d = data.toISOString().slice(0, 10);
  return `relatorio-${slug}-${d}.pdf`;
}