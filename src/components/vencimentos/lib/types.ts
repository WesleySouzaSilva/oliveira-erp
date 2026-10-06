import type { Contrato, DuplicateGroup } from "@/hooks/useVencimentosData";

export type { Contrato, DuplicateGroup };

export type SortKey =
  | "nome_cliente"
  | "banco"
  | "numero_contrato"
  | "vencimento_proxima_parcela"
  | "valor_parcela"
  | "valor_total_operacao"
  | "status_prazo"
  | "parcelas_vencidas"
  | null;

export type SortDir = "asc" | "desc";

export const RESOLVE_REASONS = [
  "Já notificada",
  "Chegou vencida",
  "Renegociada",
  "Protocolo realizado",
  "Outro",
];

export const STATUS_OPTIONS = [
  { value: "Em dia", label: "Em dia", color: "text-success" },
  { value: "Em atraso", label: "Em atraso", color: "text-destructive" },
  { value: "Renegociado", label: "Renegociado", color: "text-accent" },
  { value: "pendente", label: "Pendente", color: "text-muted-foreground" },
];

export const emptyContrato: Omit<Contrato, "id"> = {
  nome_cliente: "",
  banco: "",
  numero_contrato: "",
  vencimento_proxima_parcela: null,
  primeiro_vencimento: null,
  vencimento_ultima_parcela: null,
  valor_parcela: null,
  valor_total_operacao: null,
  parcelas_vencidas: false,
  possui_laudo: false,
  data_limite_protocolo: "",
  protocolo_realizado: false,
  notificado_antes_vencimento: null,
  data_notificacao: null,
  canal_notificacao: "",
  responsavel_gestao: "",
  status_prazo: "pendente",
  observacoes: "",
};
