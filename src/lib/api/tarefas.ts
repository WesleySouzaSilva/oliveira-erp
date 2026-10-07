import { apiFetch } from "@/lib/api/http";
import type { Pagina } from "@/lib/api/pagina";

/**
 * Recursos de tarefa contra a API própria (`/api/v1/tarefas`) — módulo `tarefa` da
 * `oliveira-api`. Os nomes dos campos casam com `TarefaNovaDTO` / `TarefaAtualizacaoDTO` /
 * `TarefaDTO`, que por sua vez preservam as colunas do banco legado.
 *
 * Atribuir a outro membro ainda não sai daqui: a listagem de membros vem com o módulo
 * `identity/membro` (#22) — até lá `responsavelId` omitido significa "para mim".
 */

export interface Tarefa {
  id: string;
  organizacaoId?: string | null;
  processoId?: string | null;
  fase?: string | null;
  responsavelId: string;
  titulo: string;
  descricao?: string | null;
  /** `yyyy-MM-dd` (o DTO devolve `LocalDate`). */
  dataVencimento: string;
  concluida: boolean;
  prioridade: "normal" | "urgente" | string;
  nomeCliente?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TarefaNova {
  titulo: string;
  descricao?: string | null;
  dataVencimento: string;
  responsavelId?: string | null;
  processoId?: string | null;
  fase?: string | null;
  prioridade?: string | null;
  nomeCliente?: string | null;
}

/** PATCH: campos ausentes não mudam (contrato da API). */
export interface TarefaAtualizacao {
  titulo?: string;
  descricao?: string;
  dataVencimento?: string;
  responsavelId?: string;
  prioridade?: string;
  concluida?: boolean;
}

export interface FiltroTarefas {
  /** Recorte "Minhas tarefas" (o painel do próprio usuário). */
  minhas?: boolean;
  concluida?: boolean;
  busca?: string;
  processoId?: string;
  page?: number;
  size?: number;
}

export function listarTarefas(filtro: FiltroTarefas = {}): Promise<Pagina<Tarefa>> {
  return apiFetch<Pagina<Tarefa>>("/tarefas", {
    params: {
      minhas: filtro.minhas,
      concluida: filtro.concluida,
      busca: filtro.busca,
      processoId: filtro.processoId,
      page: filtro.page ?? 0,
      size: filtro.size ?? 50,
    },
  });
}

/** Cadastra uma tarefa (201). Responsável fora da organização → `ErroApi` 400. */
export function criarTarefa(dados: TarefaNova): Promise<Tarefa> {
  return apiFetch<Tarefa>("/tarefas", { method: "POST", body: dados });
}

/** Atualização parcial (PATCH): campos ausentes não mudam. */
export function atualizarTarefa(id: string, dados: TarefaAtualizacao): Promise<Tarefa> {
  return apiFetch<Tarefa>(`/tarefas/${id}`, { method: "PATCH", body: dados });
}

/** Marca como concluída/pendente — a conclusão grava a auditoria na API. */
export function concluirTarefa(id: string, concluida: boolean): Promise<Tarefa> {
  return atualizarTarefa(id, { concluida });
}
