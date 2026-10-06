/**
 * Instituições cooperativas têm dezenas de singulares. O nome genérico
 * ("Cresol", "Sicredi", "Sicoob") não identifica a parte contrária, e o ADVBOX
 * só aceita a parte contrária no momento da criação do processo.
 */
export const BANCOS_GENERICOS = ["cresol", "sicredi", "sicoob", "unicred", "cresol baser", "sistema cresol"];

export const MSG_BANCO_GENERICO =
  "Nome genérico: informe a cooperativa singular (ex.: Cresol Triunfo, Sicredi Campos Gerais). Sem isso o processo não pode ser aberto no ADVBOX.";

export const PENDENCIA_BANCO_GENERICO =
  "Identificar a instituição exata na cédula antes de abrir o processo no ADVBOX";

/** Nome de banco que não identifica a instituição exata. */
export function bancoGenerico(banco?: string | null): boolean {
  const b = (banco || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!b) return false;
  return BANCOS_GENERICOS.includes(b);
}
