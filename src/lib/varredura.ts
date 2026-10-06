/**
 * Varredura das pastas: leitura do CSV e limpeza do texto das instituições.
 * Tudo entra como SUGESTÃO — nada é aplicado sem alguém clicar.
 */

export interface LinhaVarredura {
  responsavel: string;
  cliente: string;
  tipo: "instituicao" | "protocolo";
  valor: string;
  codigo: string;
  data: string | null;
  vezes: number;
  arquivo: string;
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const normTexto = (s: string) =>
  semAcento(String(s || "")).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Divide uma linha de CSV respeitando aspas. */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let dentro = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (dentro && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else dentro = !dentro;
    } else if (c === sep && !dentro) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const parseData = (v: string): string | null => {
  const s = (v || "").trim();
  if (!s) return null;
  const br = s.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
};

export function lerCsvVarredura(texto: string): { linhas: LinhaVarredura[]; ignoradas: number } {
  const bruto = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (bruto.length === 0) return { linhas: [], ignoradas: 0 };
  const sep = (bruto[0].match(/;/g)?.length || 0) > (bruto[0].match(/,/g)?.length || 0) ? ";" : ",";
  const header = splitCsvLine(bruto[0], sep).map((h) => normTexto(h).toLowerCase());
  const idx = (nome: string) => header.indexOf(nome);
  const iResp = idx("responsavel");
  const iCli = idx("cliente");
  const iTipo = idx("tipo");
  const iVal = idx("valor");
  const iCod = idx("codigo");
  const iData = idx("data");
  const iVezes = idx("vezes");
  const iArq = idx("arquivo");

  const linhas: LinhaVarredura[] = [];
  let ignoradas = 0;
  for (let i = 1; i < bruto.length; i++) {
    const c = splitCsvLine(bruto[i], sep);
    const tipoBruto = normTexto(c[iTipo] || "").toLowerCase();
    const tipo = tipoBruto.startsWith("inst") ? "instituicao" : tipoBruto.startsWith("prot") ? "protocolo" : null;
    const cliente = (c[iCli] || "").trim();
    if (!tipo || !cliente) {
      ignoradas++;
      continue;
    }
    linhas.push({
      responsavel: (c[iResp] || "").trim(),
      cliente,
      tipo,
      valor: (c[iVal] || "").trim(),
      codigo: (c[iCod] || "").trim(),
      data: parseData(c[iData] || ""),
      vezes: Number((c[iVezes] || "1").replace(/\D/g, "")) || 1,
      arquivo: (c[iArq] || "").trim(),
    });
  }
  return { linhas, ignoradas };
}

const SISTEMAS = ["SICREDI", "SICOOB", "CRESOL", "UNICRED", "BANCO DO BRASIL", "BRADESCO", "CAIXA", "SANTANDER", "ITAU", "BANRISUL", "CNH", "JOHN DEERE"];

/**
 * Limpa o nome da instituição: tira o nome do cliente colado
 * ("SICREDI PIONEIRA RS CLEITON" -> "SICREDI PIONEIRA RS").
 */
export function limpaInstituicao(valor: string, cliente: string): string {
  let t = normTexto(valor);
  const palavrasCliente = new Set(normTexto(cliente).split(" ").filter((p) => p.length > 2));
  t = t
    .split(" ")
    .filter((p) => !palavrasCliente.has(p))
    .join(" ")
    .trim();
  return t;
}

/** Duas instituições são a mesma quando uma é prefixo/abreviação da outra ("SICREDI PLAN" ~ "SICREDI PLANALTO"). */
export function mesmaInstituicao(a: string, b: string): boolean {
  const x = normTexto(a);
  const y = normTexto(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const px = x.split(" ");
  const py = y.split(" ");
  const n = Math.min(px.length, py.length);
  for (let i = 0; i < n; i++) {
    const a1 = px[i];
    const b1 = py[i];
    if (a1 === b1) continue;
    if (a1.startsWith(b1) || b1.startsWith(a1)) continue;
    return false;
  }
  return true;
}

export interface SugestaoAgrupada {
  cliente: string;
  responsavel: string;
  tipo: "instituicao" | "protocolo";
  valor: string;
  codigo: string;
  data: string | null;
  vezes: number;
  arquivo: string;
  variantes: string[];
}

/** Agrupa sugestões parecidas do mesmo cliente, mantendo o texto mais completo. */
export function agrupaSugestoes(linhas: LinhaVarredura[]): SugestaoAgrupada[] {
  const porCliente = new Map<string, SugestaoAgrupada[]>();
  for (const l of linhas) {
    const chave = `${normTexto(l.cliente)}|${l.tipo}`;
    const grupo = porCliente.get(chave) || [];
    const valor = l.tipo === "instituicao" ? limpaInstituicao(l.valor, l.cliente) : l.valor;
    if (!valor) continue;
    const existente =
      l.tipo === "instituicao"
        ? grupo.find((g) => mesmaInstituicao(g.valor, valor))
        : grupo.find((g) => normTexto(g.valor) === normTexto(valor) && g.data === l.data);
    if (existente) {
      existente.vezes += l.vezes;
      if (valor.length > existente.valor.length) {
        existente.variantes.push(existente.valor);
        existente.valor = valor;
      } else if (!existente.variantes.includes(valor) && valor !== existente.valor) {
        existente.variantes.push(valor);
      }
      if (!existente.codigo && l.codigo) existente.codigo = l.codigo;
      if (!existente.data && l.data) existente.data = l.data;
      if (!existente.arquivo && l.arquivo) existente.arquivo = l.arquivo;
    } else {
      grupo.push({
        cliente: l.cliente,
        responsavel: l.responsavel,
        tipo: l.tipo,
        valor,
        codigo: l.codigo,
        data: l.data,
        vezes: l.vezes,
        arquivo: l.arquivo,
        variantes: [],
      });
    }
    porCliente.set(chave, grupo);
  }
  const todas: SugestaoAgrupada[] = [];
  porCliente.forEach((g) => todas.push(...g));
  // Instituição reconhecida de um sistema conhecido aparece primeiro.
  return todas.sort(
    (a, b) =>
      a.cliente.localeCompare(b.cliente) ||
      (SISTEMAS.some((s) => normTexto(b.valor).startsWith(s)) ? 1 : 0) -
        (SISTEMAS.some((s) => normTexto(a.valor).startsWith(s)) ? 1 : 0) ||
      b.vezes - a.vezes,
  );
}

export const ORIGEM_VARREDURA = "Sugestão vinda da varredura das pastas";
