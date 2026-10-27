/**
 * "1536" -> "1,5 KB" — a régua de tamanho dos anexos em UM lugar só: a trilha da tarefa,
 * a expansão do contrato e a fila de anexos do formulário falam a mesma língua.
 *
 * Fica em `lib/` porque não é de componente nenhum em especial: era código copiado em
 * `TarefaMovimentacao` e `ContratosClienteDialog` até as correções de contratos (Fase 1).
 */
export const formatarTamanho = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
};
