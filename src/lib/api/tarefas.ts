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
  /** Tipo de tarefa escolhido (V21): o NOME do tipo e' o que aparece em `titulo`. */
  tipoId?: string | null;
  tipoNome?: string | null;
  /** Cliente dona da tarefa (V21) — o nome tambem e' copiado para `nomeCliente`. */
  clienteId?: string | null;
  /** Recorrencia (V21): `unica` (padrao), `diaria`, `semanal` ou `mensal`. */
  recorrencia?: string | null;
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
  // ---- V21: tipos de tarefa, cliente vinculado e recorrencia ----
  /**
   * Tipo de tarefa: se vier, a API grava o NOME DO TIPO como `titulo` (o titulo enviado
   * e' ignorado — mas precisa continuar vindo preenchido, o `@NotBlank` do DTO vale).
   */
  tipoId?: string | null;
  /** Cliente dona da tarefa — valida na organizacao e copia o nome para `nomeCliente`. */
  clienteId?: string | null;
  /** Recorrencia: `unica` (padrao), `diaria`, `semanal` ou `mensal`. */
  recorrencia?: string | null;
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
  // ---- V21: tipos de tarefa, cliente vinculado e recorrencia (nulo nao muda) ----
  /** Tipo de tarefa: valida na organizacao e o NOME do tipo vira o titulo gravado. */
  tipoId?: string;
  /** Cliente dona da tarefa — valida na organizacao e copia o nome para `nomeCliente`. */
  clienteId?: string;
  /** Recorrencia: `unica`, `diaria`, `semanal` ou `mensal`. */
  recorrencia?: string;
}

/** Onde a busca de texto procura — o "tipo de busca" do select da tela de tarefas. */
export type BuscaTarefas = "titulo" | "descricao" | "cliente" | "processo";

/**
 * Catálogo de recorrência (V21): as chaves que a API aceita (`unica` é o padrão) e os
 * rótulos das telas — select do form de nova tarefa, do encaminhar do contrato e do
 * detalhe, para os três falarem a mesma língua.
 */
export const RECORRENCIAS_TAREFA = [
  { valor: "unica", rotulo: "Única" },
  { valor: "diaria", rotulo: "Diária" },
  { valor: "semanal", rotulo: "Semanal" },
  { valor: "mensal", rotulo: "Mensal" },
] as const;

export interface FiltroTarefas {
  /** Recorte "Minhas tarefas" (o painel do próprio usuário). */
  minhas?: boolean;
  concluida?: boolean;
  busca?: string;
  /** `titulo`, `descricao`, `cliente` ou `processo` (V21); sem ele a API procura em título OU cliente. */
  buscaEm?: BuscaTarefas;
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
      buscaEm: filtro.buscaEm,
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

// ------------------------------------------------------------ tipos de tarefa (V21)

/**
 * Tipo de tarefa da organização (`/tarefas/tipos`): o rotulo escolhido no form que vira
 * o TITULO gravado da tarefa. Leitura para qualquer autenticado; escrita só admin/ceo.
 */
export interface TarefaTipo {
  id: string;
  nome: string;
  /** Tipo desligado sai do seletor da tela (a lista devolve os dois). */
  ativo: boolean;
}

/** Todos os tipos da organização (inclusive desligados — filtrar por `ativo` na tela). */
export function listarTiposTarefa(): Promise<TarefaTipo[]> {
  return apiFetch<TarefaTipo[]>("/tarefas/tipos");
}

/** Cadastra um tipo (201). Só admin/ceo; nome repetido na organização → 409. */
export function criarTipoTarefa(dados: { nome: string }): Promise<TarefaTipo> {
  return apiFetch<TarefaTipo>("/tarefas/tipos", { method: "POST", body: dados });
}

/** Edição do tipo (PUT): campos nulos não mudam (nome e/ou ativo). Só admin/ceo. */
export function atualizarTipoTarefa(
  id: string,
  dados: { nome?: string; ativo?: boolean },
): Promise<TarefaTipo> {
  return apiFetch<TarefaTipo>(`/tarefas/tipos/${id}`, { method: "PUT", body: dados });
}

/** Apaga o tipo (204): as tarefas do tipo ficam com o título já gravado. Só admin/ceo. */
export function excluirTipoTarefa(id: string): Promise<void> {
  return apiFetch<void>(`/tarefas/tipos/${id}`, { method: "DELETE" });
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

// ------------------------------------------------------------ anexos da tarefa (V21)

/**
 * TODOS os anexos da tarefa (`GET /tarefas/{id}/arquivos`): inclusive os pendurados na
 * linha `criada` (os que subiram na criação). Mesmo gate do download da API.
 */
export function listarArquivosTarefa(tarefaId: string): Promise<TarefaAnexo[]> {
  return apiFetch<TarefaAnexo[]>(`/tarefas/${tarefaId}/arquivos`);
}

/**
 * Anexa arquivos a tarefa JÁ CRIADA (`POST /tarefas/{id}/arquivos`, multipart com o
 * campo `arquivos`): os registros ficam na linha `criada` da trilha e a API devolve a
 * lista ATUALIZADA de anexos. 400 se a lista vier vazia ou a tarefa estiver concluída;
 * o gate (responsável/admin/ceo) é checado na API.
 */
export function anexarArquivosTarefa(tarefaId: string, files: File[]): Promise<TarefaAnexo[]> {
  const form = new FormData();
  for (const arquivo of files) form.append("arquivos", arquivo);
  // multipart: o navegador monta o Content-Type (http.ts já trata FormData)
  return apiFetch<TarefaAnexo[]>(`/tarefas/${tarefaId}/arquivos`, { method: "POST", body: form });
}
