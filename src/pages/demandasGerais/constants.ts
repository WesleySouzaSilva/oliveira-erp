import type { StatusTone } from "@/components/ui/status-badge";

export const MATERIAS: { value: string; label: string }[] = [
  { value: "trabalhista", label: "Trabalhista" },
  { value: "civel", label: "Cível" },
  { value: "familia", label: "Família" },
  { value: "previdenciario", label: "Previdenciário" },
  { value: "consumidor", label: "Consumidor" },
  { value: "outros", label: "Outros" },
];

export const MATERIA_LABEL: Record<string, string> = Object.fromEntries(
  MATERIAS.map((m) => [m.value, m.label]),
);

export const STATUS_LIST: { value: string; label: string; tone: StatusTone }[] = [
  { value: "novo", label: "Novo", tone: "info" },
  { value: "em_andamento", label: "Em andamento", tone: "gold" },
  { value: "aguardando", label: "Aguardando", tone: "warning" },
  { value: "concluido", label: "Concluído", tone: "success" },
  { value: "arquivado", label: "Arquivado", tone: "neutral" },
];

export const STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = Object.fromEntries(
  STATUS_LIST.map((s) => [s.value, { label: s.label, tone: s.tone }]),
);

export type CausaAvulsa = {
  id: string;
  organizacao_id: string;
  titulo: string;
  materia: string;
  cliente_nome: string;
  cliente_documento: string | null;
  cliente_contato: string | null;
  numero_processo: string | null;
  parte_contraria: string | null;
  valor_causa: number | null;
  status: string;
  responsavel_id: string | null;
  prazo: string | null;
  descricao: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CausaNota = {
  id: string;
  organizacao_id: string;
  causa_id: string;
  autor_id: string | null;
  conteudo: string;
  created_at: string;
};