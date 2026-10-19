import { apiFetch, baixarArquivo } from "@/lib/api/http";
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
  prioridade: "normal" | "alta" | "urgente" | string;
  nomeCliente?: string | null;
  /** Setor que ENVIOU a tarefa (rotulo, vem da formula da API) — coluna "Tarefa". */
  setorNome?: string | null;
  /** Número do contrato a que a tarefa pertence — coluna "Tarefa". */
  contratoNumero?: string | null;
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
  /**
   * Setor dono da tarefa (V11) — no encaminhamento na criação, o setor que recebe.
   * Com `responsavelId` preenchido, a tarefa já nasce com outro responsável.
   */
  setorId?: string | null;
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

// ------------------------------------------------------------ movimentação (timeline)

/**
 * Uma linha da trilha da tarefa (`GET /tarefas/{id}/historico`): quem fez, quando, de/para,
 * o que mudou (`campos`) e o IP do PC. Campos casam com `TarefaHistoricoDTO` da API.
 */
export interface TarefaHistorico {
  id: string;
  tarefaId?: string | null;
  /** `criada` | `editada` | `encaminhada` | `concluida` | `reaberta`. */
  acao: string;
  executadoPor?: string | null;
  executadoPorNome?: string | null;
  responsavelId?: string | null;
  deUsuarioId?: string | null;
  paraUsuarioId?: string | null;
  deUsuarioNome?: string | null;
  paraUsuarioNome?: string | null;
  setorId?: string | null;
  setorNome?: string | null;
  /** Diff da edição: `[{ campo, de, para }]`. */
  campos?: { campo: string; de?: string | null; para?: string | null }[] | null;
  titulo?: string | null;
  ipRegistro?: string | null;
  /** ISO-8601. */
  dataAcao?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Recado escrito junto da ação (V12 — ex.: o texto digitado ao encaminhar). */
  mensagem?: string | null;
  /** Anexos da ação (V12): só metadados; o download é `baixarAnexoTarefa`. */
  anexos?: TarefaAnexo[] | null;
}

/** Anexo de tarefa no JSON (V12): os bytes ficam na pasta do servidor da API. */
export interface TarefaAnexo {
  id: string;
  nomeOriginal: string;
  mimeTipo?: string | null;
  tamanhoBytes?: number | null;
}

/** Trilha da tarefa (mais recente primeiro). 403 se a pessoa não for admin/gestor/envolvida. */
export function listarHistoricoTarefa(id: string): Promise<TarefaHistorico[]> {
  return apiFetch<TarefaHistorico[]>(`/tarefas/${id}/historico`);
}

/** Encaminhamento: move para outro setor e/ou colaborador e grava a linha `encaminhada`. */
export function encaminharTarefa(
  id: string,
  dados: {
    setorId?: string | null;
    responsavelId?: string | null;
    /** Recado em texto junto do encaminhamento (V12). */
    mensagem?: string | null;
    /** Arquivos anexados (V12): vão em multipart e param na pasta do servidor da API. */
    anexos?: File[];
  },
): Promise<Tarefa> {
  const form = new FormData();
  if (dados.setorId) form.append("setorId", dados.setorId);
  if (dados.responsavelId) form.append("responsavelId", dados.responsavelId);
  if (dados.mensagem && dados.mensagem.trim()) form.append("mensagem", dados.mensagem.trim());
  for (const arquivo of dados.anexos ?? []) form.append("anexos", arquivo);
  // multipart: o navegador monta o Content-Type (http.ts já trata FormData)
  return apiFetch<Tarefa>(`/tarefas/${id}/encaminhar`, { method: "POST", body: form });
}

/** Baixa um anexo da tarefa (o banco guarda só o caminho; os bytes ficam no servidor). */
export function baixarAnexoTarefa(anexoId: string, nome: string): Promise<void> {
  return baixarArquivo(`/tarefas/anexos/${anexoId}/conteudo`, nome);
}
