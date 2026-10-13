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
  /** Contrato do cliente a que a tarefa pertence (o contrato e o continente da timeline). */
  contratoId?: string | null;
  fase?: string | null;
  /** Alteracao de etapa processual (texto livre ate o modulo processo existir). */
  etapa?: string | null;
  responsavelId: string;
  titulo: string;
  descricao?: string | null;
  /** `yyyy-MM-dd` (o DTO devolve `LocalDate`). */
  dataVencimento: string;
  /** Data + hora do compromisso (a coluna "Data compromisso" do ADVBOX). */
  dataCompromisso?: string | null;
  /** Prazo limite (a coluna "Prazo fatal"); ausente = vale `dataVencimento`. */
  prazoFatal?: string | null;
  concluida: boolean;
  /** Coluna "Importante" (estrela). */
  importante: boolean;
  /** Coluna "Lido" (o "lens"). */
  lido: boolean;
  /** Cadeado do formulario ("tarefa privada"). */
  privada: boolean;
  /** "Tarefa futura": criada agora para valer depois. */
  tarefaFutura: boolean;
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
  /** Data + hora do compromisso (ISO-8601). */
  dataCompromisso?: string | null;
  prazoFatal?: string | null;
  responsavelId?: string | null;
  processoId?: string | null;
  contratoId?: string | null;
  fase?: string | null;
  etapa?: string | null;
  prioridade?: string | null;
  /** Nulo = falso (mesmo comportamento da API). */
  importante?: boolean | null;
  lido?: boolean | null;
  privada?: boolean | null;
  tarefaFutura?: boolean | null;
  nomeCliente?: string | null;
}

/**
 * Data que marca a tarefa no dia: prazo fatal, ou o vencimento quando não há prazo —
 * a mesma regra da coluna "Prazo fatal" da lista e dos badges do calendário, para o
 * número do dia e as linhas filtradas sempre baterem.
 */
export const prazoDaTarefa = (tarefa: Tarefa) => tarefa.prazoFatal ?? tarefa.dataVencimento;

/** PATCH: campos ausentes não mudam (contrato da API). */
export interface TarefaAtualizacao {
  titulo?: string;
  descricao?: string;
  dataVencimento?: string;
  dataCompromisso?: string;
  prazoFatal?: string;
  responsavelId?: string;
  processoId?: string;
  contratoId?: string;
  etapa?: string;
  prioridade?: string;
  concluida?: boolean;
  /** Marcadores da lista: `true`/`false` troca, omitido não muda. */
  importante?: boolean;
  lido?: boolean;
  privada?: boolean;
  tarefaFutura?: boolean;
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
