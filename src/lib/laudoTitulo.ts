/** Rótulos amigáveis de laudo: nome do cliente + tipo (frustração/capacidade). */

export type TipoLaudo = "perda" | "capacidade" | "ambos" | undefined;

export const TIPO_LABEL: Record<string, string> = {
  perda: "Frustração de Safra",
  capacidade: "Capacidade de Pagamento",
  ambos: "Frustração + Capacidade",
};

/** Detecta o tipo pelo campo salvo ou, na falta dele, pelos nomes dos arquivos anexados. */
export function detectarTipoLaudo(
  tipoSalvo?: string | null,
  nomesArquivos: string[] = [],
): TipoLaudo {
  if (tipoSalvo === "perda" || tipoSalvo === "capacidade" || tipoSalvo === "ambos") return tipoSalvo;
  const txt = nomesArquivos.join(" ").toLowerCase();
  const perda = /(perda|frustra|quebra\s*de\s*safra|sinistro)/.test(txt);
  const capacidade = /(capacidade|pagamento|solv)/.test(txt);
  if (perda && capacidade) return "ambos";
  if (perda) return "perda";
  if (capacidade) return "capacidade";
  return undefined;
}

export function tipoLaudoLabel(tipo: TipoLaudo): string {
  return tipo ? TIPO_LABEL[tipo] : "Laudo Técnico";
}

/** Título de exibição: "Nome do Cliente — Frustração de Safra". */
export function tituloLaudo(produtor: string | null | undefined, tipo: TipoLaudo): string {
  const nome = (produtor || "").trim();
  const label = tipoLaudoLabel(tipo);
  return nome && nome !== "Sem nome" ? `${nome} — ${label}` : label;
}
