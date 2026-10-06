/**
 * KanbanPipeline — wrapper fino sobre o novo KanbanBoard (Fase A do plano Trello-like).
 *
 * Mantido para preservar todos os importadores existentes (`Dashboard.tsx`, etc.).
 * O comportamento atual (DnD nativo com indicador, ghost custom, animação framer-motion,
 * tela cheia, badge de prazo 15d, atualização otimista, navegação para /processos/:id)
 * é 100% preservado dentro de KanbanBoard. Nada foi removido.
 */
import { KanbanBoard } from "./kanban/KanbanBoard";

export function KanbanPipeline() {
  return <KanbanBoard />;
}
