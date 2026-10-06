// Garantias, avalistas e estratégia — vocabulário único do sistema.

export const TIPOS_GARANTIA = [
  { value: "alienacao_fiduciaria", label: "Alienação fiduciária", sigla: "AF", identificacao: "Chassi, placa ou nº de série" },
  { value: "hipoteca", label: "Hipoteca", sigla: "HIP", identificacao: "Matrícula do imóvel e cartório", grau: true },
  { value: "penhor", label: "Penhor (safra, animais, produtos)", sigla: "PEN", identificacao: "Safra e área" },
  { value: "cpr_garantia", label: "CPR com garantia", sigla: "CPR", identificacao: "Número da CPR" },
  { value: "cessao_recebiveis", label: "Cessão ou trava de recebíveis", sigla: "REC", identificacao: "Origem dos recebíveis (laticínio, cartão…)" },
  { value: "seguro_proagro", label: "Seguro agrícola ou PROAGRO vinculado", sigla: "SEG", identificacao: "Apólice / nº do PROAGRO" },
  { value: "aval_fianca", label: "Aval ou fiança", sigla: "AVAL", identificacao: "Nome e CPF do avalista" },
  { value: "sem_garantia_real", label: "Sem garantia real", sigla: "—", identificacao: "" },
] as const;

export type TipoGarantia = (typeof TIPOS_GARANTIA)[number]["value"];

export const GRAUS_HIPOTECA = ["1ª", "2ª", "3ª", "4ª"] as const;

export const SITUACOES_GARANTIA = [
  { value: "livre", label: "Livre" },
  { value: "gravado", label: "Gravado" },
  { value: "em_consolidacao", label: "Em consolidação" },
  { value: "apreendido", label: "Apreendido" },
  { value: "liberado", label: "Liberado" },
] as const;

export const CONJUGE_ANUIU = [
  { value: "sim", label: "Cônjuge anuiu: sim" },
  { value: "nao", label: "Cônjuge anuiu: não" },
  { value: "nao_se_aplica", label: "Cônjuge anuiu: não se aplica" },
] as const;

export const ESTRATEGIAS = [
  { value: "prorrogacao_alongamento", label: "Prorrogação / alongamento" },
  { value: "repactuacao", label: "Repactuação" },
  { value: "revisional", label: "Revisional" },
  { value: "defesa_execucao", label: "Defesa em execução" },
  { value: "mp_1376", label: "MP 1.376" },
  { value: "recuperacao_judicial", label: "Recuperação judicial" },
  { value: "acordo", label: "Acordo" },
  { value: "encerrado", label: "Encerrado" },
] as const;

/** Só o Willian define ou muda a estratégia. */
export const QUEM_DEFINE_ESTRATEGIA = "willian";

export function podeMudarEstrategia(nome?: string | null, isAdmin?: boolean): boolean {
  if (isAdmin) return true;
  return (nome || "").toLowerCase().includes(QUEM_DEFINE_ESTRATEGIA);
}

export const labelTipoGarantia = (v?: string | null) =>
  TIPOS_GARANTIA.find((t) => t.value === v)?.label || v || "—";
export const siglaTipoGarantia = (v?: string | null) =>
  TIPOS_GARANTIA.find((t) => t.value === v)?.sigla || "";
export const labelSituacaoGarantia = (v?: string | null) =>
  SITUACOES_GARANTIA.find((s) => s.value === v)?.label || v || "—";
export const labelEstrategia = (v?: string | null) =>
  ESTRATEGIAS.find((e) => e.value === v)?.label || null;

/** Garantias que sobem a prioridade dentro da mesma faixa de dias. */
const TIPOS_PRIORITARIOS: string[] = ["alienacao_fiduciaria", "hipoteca", "cessao_recebiveis"];

export function garantiaPrioritaria(tipos: string[] = []): boolean {
  return tipos.some((t) => TIPOS_PRIORITARIOS.includes(t));
}

/** Etiquetas curtas para o radar: AF, HIP, PEN, AVAL, REC… */
export function etiquetasOperacao(tipos: string[] = [], temAvalista = false): string[] {
  const siglas = tipos.map((t) => siglaTipoGarantia(t)).filter((s) => s && s !== "—");
  if (temAvalista && !siglas.includes("AVAL")) siglas.push("AVAL");
  return Array.from(new Set(siglas));
}

export const etiquetaDestacada = (sigla: string) => ["AF", "HIP", "REC"].includes(sigla);

export interface Garantia {
  id: string;
  operacao_id: string;
  tipo: string;
  grau: string | null;
  descricao: string | null;
  identificacao: string | null;
  valor_avaliacao: number | null;
  onde_registrada: string | null;
  situacao: string;
  observacao: string | null;
}

export interface Avalista {
  id: string;
  operacao_id: string;
  pessoa_id: string | null;
  nome: string;
  cpf: string | null;
  conjuge_anuiu: string;
  observacao: string | null;
}
