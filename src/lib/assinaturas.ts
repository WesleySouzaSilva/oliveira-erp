// Helpers do módulo Assinaturas (ZapSign).

export const STATUS_DOC: Record<string, { label: string; cor: string }> = {
  pending: { label: "Pendente", cor: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  signed: { label: "Assinado", cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  refused: { label: "Recusado", cor: "bg-destructive/15 text-destructive" },
  expired: { label: "Prazo vencido", cor: "bg-destructive/15 text-destructive" },
  deleted: { label: "Excluído", cor: "bg-muted text-muted-foreground" },
};

export const STATUS_SIGN: Record<string, string> = {
  pending: "Pendente",
  opened: "Visualizou",
  signed: "Assinou",
  refused: "Recusou",
};

export const TIPO_DOC: Record<string, string> = {
  contrato: "Contrato de honorários",
  procuracao: "Procuração",
  proposta: "Proposta",
  contrato_rh: "Contrato de trabalho/RH",
  contrato_fornecedor: "Contrato com fornecedor/parceiro",
  declaracao: "Declaração",
  outro: "Outro",
};

/** Tipos com um único signatário (contratante/outorgante) + opção de incluir o escritório. */
export const TIPOS_SIGNATARIO_UNICO = ["contrato", "procuracao"];

export const SETORES = ["Negócios", "Jurídico", "Pós-Venda", "Gestão de Pessoas e Recursos", "Administrativo"];

const ordenar = (set: Set<string>) =>
  [...set].sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

/** Lê word/document.xml de um .docx (zip) e procura <<assinatura_N>>. Retorna null se não conseguir ler. */
export async function detectarMarcadoresDocx(bytes: Uint8Array): Promise<string[] | null> {
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return null;
    const total = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    for (let n = 0; n < total; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) return null;
      const metodo = dv.getUint16(p + 10, true);
      const tamComp = dv.getUint32(p + 20, true);
      const lenNome = dv.getUint16(p + 28, true);
      const lenExtra = dv.getUint16(p + 30, true);
      const lenCom = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const nome = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + lenNome));
      if (nome === "word/document.xml") {
        const inicio = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
        const comp = bytes.slice(inicio, inicio + tamComp);
        let xml: string;
        if (metodo === 0) xml = new TextDecoder().decode(comp);
        else if (metodo === 8 && typeof DecompressionStream !== "undefined") {
          const stream = new Blob([comp]).stream().pipeThrough(new DecompressionStream("deflate-raw" as any));
          xml = await new Response(stream).text();
        } else return null;
        // Word quebra o texto em várias <w:t>; junta só o texto visível
        const texto = xml.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        const set = new Set<string>();
        for (const m of texto.matchAll(/<<assinatura_(\d+)>>/g)) set.add(`<<assinatura_${m[1]}>>`);
        return ordenar(set);
      }
      p += 46 + lenNome + lenExtra + lenCom;
    }
    return null;
  } catch {
    return null;
  }
}

export const somenteDigitos = (s?: string | null) => String(s ?? "").replace(/\D/g, "");

export function mascaraCpf(cpf?: string | null): string {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return cpf || "—";
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string) => {
    let s = 0;
    for (let i = 0; i < base.length; i++) s += Number(base[i]) * (base.length + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10]);
}

export function linkWhatsApp(telefone: string | null | undefined, nomeDoc: string, signUrl: string): string | null {
  const d = somenteDigitos(telefone);
  if (d.length < 10) return null;
  const msg = encodeURIComponent(`Olá! Segue o link para assinar o documento "${nomeDoc}": ${signUrl}`);
  return `https://wa.me/55${d}?text=${msg}`;
}

/** Procura marcadores <<assinatura_N>> no PDF (texto branco gravado pelos nossos geradores). */
export function detectarMarcadores(bytes: Uint8Array): string[] {
  let txt = "";
  const CHUNK = 65536;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    txt += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  const encontrados = new Set<string>();
  for (const m of txt.matchAll(/<<assinatura_(\d+)>>/g)) encontrados.add(`<<assinatura_${m[1]}>>`);
  return [...encontrados].sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
}

export function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || "");
      resolve(res.includes(",") ? res.split(",")[1] : res);
    };
    r.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    r.readAsDataURL(file);
  });
}

export const fmtData = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

export const fmtDataHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
