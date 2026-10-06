export interface KanbanColumnDef {
  id: string;
  slug: string;
  titulo: string;
  cor: string;
  ordem: number;
  legacy_fase: string | null;
  arquivada: boolean;
}

export interface KanbanCardData {
  id: string;
  produtor: string;
  banco: string;
  valor: number | null;
  faseAtual: string;
  kanbanColunaId: string | null;
  kanbanOrdem: number | null;
  diasNaFase: number;
  prazoRestante: number | null;
  laudoId: string;
}

export interface KanbanColumnView extends KanbanColumnDef {
  cards: KanbanCardData[];
}

export interface ChecklistItem {
  id: string;
  texto: string;
  concluido: boolean;
  ordem: number;
}

export interface Checklist {
  id: string;
  titulo: string;
  ordem: number;
  itens: ChecklistItem[];
}

export interface CardMeta {
  processo_id: string;
  descricao: string | null;
  due_date: string | null;
  due_origem: string;
  sincroniza_prazo_15d: boolean;
}

export interface ChecklistTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  itens: Array<{ texto: string; ordem: number }>;
}

export interface Etiqueta {
  id: string;
  nome: string;
  cor: string;
  categoria: "banco" | "urgencia" | "tipo" | "livre";
}

export interface CardMembro {
  user_id: string;
  nome: string | null;
}