/**
 * Fórmulas puras do módulo de Métricas.
 * Nunca persistidas — calculadas em runtime.
 * Divisão por zero/null sempre retorna null (UI exibe "—").
 */

export type Nicho = "agro" | "empresarial" | "bpc" | "outros";

export const NICHOS: { value: Nicho; label: string }[] = [
  { value: "agro", label: "Agro / Crédito Rural" },
  { value: "empresarial", label: "Empresarial / Societário" },
  { value: "bpc", label: "BPC / Neurodivergentes" },
  { value: "outros", label: "Outros / Áreas diversas" },
];

export const ORIGENS_ORGANICAS = [
  { value: "instagram_organico", label: "Instagram Orgânico" },
  { value: "indicacao", label: "Indicação" },
  { value: "networking", label: "Networking" },
  { value: "ltv_cliente", label: "LTV (cliente recorrente)" },
  { value: "evento", label: "Evento" },
  { value: "palestra", label: "Palestra" },
  { value: "conteudo", label: "Conteúdo" },
  { value: "outro", label: "Outro" },
] as const;

export const MOTIVOS_PERDA = [
  { value: "preco", label: "Preço" },
  { value: "concorrencia", label: "Concorrência" },
  { value: "timing", label: "Timing" },
  { value: "sem_fit", label: "Sem Fit" },
  { value: "sem_resposta", label: "Sem Resposta" },
  { value: "outro", label: "Outro" },
] as const;

// Motivos de perda específicos para o nicho Agro / Crédito Rural
export const MOTIVOS_PERDA_AGRO = [
  { value: "negociou_banco", label: "Negociou direto com o banco" },
  { value: "outro_advogado", label: "Contratou outro advogado" },
  { value: "sem_resposta", label: "Não respondeu" },
] as const;

export function motivosPorNicho(nicho: Nicho) {
  if (nicho === "agro") return MOTIVOS_PERDA_AGRO;
  return MOTIVOS_PERDA;
}

function safeDiv(a: number, b: number): number | null {
  if (!b || !isFinite(b)) return null;
  const r = a / b;
  return isFinite(r) ? r : null;
}

export const calc = {
  cpc: (inv: number, cliques: number) => safeDiv(inv, cliques),
  ctr: (cliques: number, impressoes: number) => safeDiv(cliques, impressoes),
  cpm: (inv: number, impressoes: number) => {
    const r = safeDiv(inv, impressoes);
    return r == null ? null : r * 1000;
  },
  cpl: (inv: number, leadsPagos: number) => safeDiv(inv, leadsPagos),
  roas: (receita: number, inv: number) => safeDiv(receita, inv),
  ticketMedio: (receita: number, contratos: number) => safeDiv(receita, contratos),
  taxaQualificacao: (qualif: number, pagos: number, organicos: number) =>
    safeDiv(qualif, pagos + organicos),
  taxaAgendamento: (agendadas: number, qualif: number) => safeDiv(agendadas, qualif),
  taxaComparecimento: (realizadas: number, agendadas: number) => safeDiv(realizadas, agendadas),
  taxaProposta: (propostas: number, realizadas: number) => safeDiv(propostas, realizadas),
  taxaFechamento: (contratos: number, propostas: number) => safeDiv(contratos, propostas),
  taxaFechamentoTotal: (contratos: number, pagos: number, organicos: number) =>
    safeDiv(contratos, pagos + organicos),
  proporcaoPago: (pagos: number, organicos: number) => safeDiv(pagos, pagos + organicos),
  variacaoPct: (atual: number, anterior: number): number | "novo" | null => {
    if (!anterior) return atual ? "novo" : null;
    return ((atual - anterior) / anterior) * 100;
  },
};

export const fmt = {
  brl: (v: number | null | undefined) => {
    if (v == null || !isFinite(v)) return "—";
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  },
  num: (v: number | null | undefined) => {
    if (v == null || !isFinite(v)) return "—";
    return v.toLocaleString("pt-BR");
  },
  pct: (v: number | null | undefined) => {
    if (v == null || !isFinite(v)) return "—";
    return `${v.toFixed(2)}%`;
  },
  pctFrac: (v: number | null | undefined) => {
    // input is a fraction (0..1)
    if (v == null || !isFinite(v)) return "—";
    return `${(v * 100).toFixed(2)}%`;
  },
  roas: (v: number | null | undefined) => {
    if (v == null || !isFinite(v)) return "—";
    return `${v.toFixed(2).replace(".", ",")}x`;
  },
  data: (d: string | Date) => {
    const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
    return dt.toLocaleDateString("pt-BR");
  },
  variacao: (v: number | "novo" | null) => {
    if (v === "novo") return "novo";
    if (v == null || !isFinite(v as number)) return "—";
    const sign = (v as number) > 0 ? "+" : "";
    return `${sign}${(v as number).toFixed(1)}%`;
  },
};