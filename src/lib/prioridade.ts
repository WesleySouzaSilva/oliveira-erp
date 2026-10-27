/**
 * Cor da prioridade na lista e no kanban (pedido do titular 16/10/2026):
 * Urgente em vermelho, Alta em amarelo, Normal neutro (do jeito que já estava).
 */
export const corDePrioridade = (valor?: string | null): string =>
  valor === "urgente"
    ? "text-destructive font-semibold"
    : valor === "alta"
    ? "text-warning font-semibold"
    : "";
