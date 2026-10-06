// Via de urgência: cliente que chega com o vencimento em cima, sem contrato e sem laudo.
import { diasRestantes } from "@/hooks/useOperacoesCredito";

/** Vence em até 15 dias. */
export const DIAS_URGENCIA = 15;
/** Ou já venceu há menos de 30 dias. */
export const DIAS_VENCIDA_URGENTE = 30;

/** A operação entra como urgente no cadastro? */
export function urgenteNoCadastro(vence_em?: string | null): boolean {
  if (!vence_em) return false;
  const d = diasRestantes(vence_em);
  return d <= DIAS_URGENCIA && d > -DIAS_VENCIDA_URGENTE;
}

/** Texto da etiqueta vermelha. */
export function rotuloUrgencia(vence_em?: string | null): string {
  if (!vence_em) return "Urgente";
  const d = diasRestantes(vence_em);
  if (d < 0) return `Urgente — venceu há ${Math.abs(d)} dias`;
  if (d === 0) return "Urgente — vence hoje";
  return `Urgente — vence em ${d} dias`;
}

/** O que pode faltar no momento de um protocolo em regime de urgência. */
export const FALTAS_PROTOCOLO = [
  { key: "cedula", label: "Cédula ou contrato", chave: "cedula_contrato" },
  { key: "extrato", label: "Extrato / saldo devedor", chave: "saldo_devedor" },
  { key: "laudo", label: "Laudo", chave: null as string | null },
  { key: "numero", label: "Número da operação", chave: "identificacao_operacao" },
] as const;

export const labelFalta = (k: string) => FALTAS_PROTOCOLO.find((f) => f.key === k)?.label || k;

/** Prazo padrão para completar a documentação de um protocolo de urgência. */
export const PRAZO_COMPLETAR_DIAS = 15;

export function prazoCompletar(base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + PRAZO_COMPLETAR_DIAS);
  return d.toISOString().slice(0, 10);
}

export const DECISOES_VENCIDA = [
  { value: "cabe_pedido", label: "Ainda cabe pedido administrativo" },
  { value: "via_judicial", label: "Partiu para a via judicial" },
  { value: "mudou_estrategia", label: "O caso mudou de estratégia" },
] as const;

export const labelDecisao = (v?: string | null) =>
  DECISOES_VENCIDA.find((d) => d.value === v)?.label || null;
