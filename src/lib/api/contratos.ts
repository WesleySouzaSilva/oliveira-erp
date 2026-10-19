import { apiFetch } from "@/lib/api/http";
import type { Pagina } from "@/lib/api/pagina";

/**
 * Recursos de contrato do cliente contra a API própria (`/api/v1/...`) — módulo
 * `cliente` da `oliveira-api`. O contrato e a 1a etapa do cliente (1..N por cliente);
 * os campos casam com `ContratoClienteDTO` / `ContratoClienteNovoDTO` /
 * `ContratoClienteAtualizacaoDTO`.
 *
 * Os arquivos vao por multipart (`FormData`) — o `apiFetch` nao seta `Content-Type`
 * quando o corpo e `FormData`, para o navegador montar o boundary.
 */

export interface Contrato {
  id: string;
  clienteId: string;
  numero: string;
  banco?: string | null;
  descricao?: string | null;
  /** `ativo` | `concluido` | `encerrado`. */
  situacao: string;
  /** `yyyy-MM-dd` (o DTO devolve `LocalDate`). */
  dataInicio?: string | null;
  /** Vazia = o contrato e "so registro", sem controle de prazo. */
  dataValidade?: string | null;
  observacoes?: string | null;
  /** Valor do contrato (opcional). */
  valor?: number | null;
  /** `yyyy-MM-dd` — preenchida AUTATICAMENTE no cadastro (o servidor grava). */
  dataAbertura?: string | null;
  /** Tipo de objeto (categoria, ex.: "Arroz") — FK para /tipo-objeto. */
  objetoId?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContratoNovo {
  /** Opcional: ausente/vazio o servidor gera o próximo sequencial (CT-01, CT-02...). */
  numero?: string;
  banco?: string | null;
  descricao?: string | null;
  situacao?: string | null;
  dataInicio?: string | null;
  dataValidade?: string | null;
  observacoes?: string | null;
  valor?: number | null;
  objetoId?: string | null;
  /**
   * Setores de envio (decisão 8 do plano): para cada um o servidor cria a tarefa do
   * contrato e grava o encaminhamento — quem recebe é resolvido pela faixa de valor.
   */
  setores?: string[];
  /** Dias para responder (padrão 5); a prioridade vem do prazo (até 5 = urgente). */
  prazoDias?: number | null;
}

/** PATCH: campos ausentes nao mudam (contrato da API). */
export interface ContratoAtualizacao {
  numero?: string;
  banco?: string;
  descricao?: string;
  situacao?: string;
  dataInicio?: string;
  dataValidade?: string;
  observacoes?: string;
  valor?: number;
  objetoId?: string;
}

export interface Arquivo {
  id: string;
  contratoId?: string | null;
  processoId?: string | null;
  nomeOriginal: string;
  arquivoPath: string;
  mimeTipo?: string | null;
  tamanhoBytes?: number | null;
  createdAt?: string;
}

export function listarContratos(clienteId: string): Promise<Contrato[]> {
  return apiFetch<Contrato[]>(`/clientes/${clienteId}/contratos`);
}

export function criarContrato(clienteId: string, dados: ContratoNovo): Promise<Contrato> {
  return apiFetch<Contrato>(`/clientes/${clienteId}/contratos`, { method: "POST", body: dados });
}

export function buscarContrato(id: string): Promise<Contrato> {
  return apiFetch<Contrato>(`/contratos/${id}`);
}

/** Atualizacao parcial (PATCH): campos ausentes nao mudam. */
export function atualizarContrato(id: string, dados: ContratoAtualizacao): Promise<Contrato> {
  return apiFetch<Contrato>(`/contratos/${id}`, { method: "PATCH", body: dados });
}

/** Exclui o contrato e apaga os arquivos da pasta (a trilha do cliente permanece). */
export function excluirContrato(id: string): Promise<void> {
  return apiFetch<void>(`/contratos/${id}`, { method: "DELETE" });
}

/** Anexa 1..N arquivos ao contrato (multipart, campo `arquivos`). */
export function anexarArquivos(contratoId: string, arquivos: File[]): Promise<Arquivo[]> {
  const dados = new FormData();
  arquivos.forEach((arquivo) => dados.append("arquivos", arquivo));
  return apiFetch<Arquivo[]>(`/contratos/${contratoId}/arquivos`, { method: "POST", body: dados });
}

export function listarArquivos(contratoId: string): Promise<Arquivo[]> {
  return apiFetch<Arquivo[]>(`/contratos/${contratoId}/arquivos`);
}

export function excluirArquivo(id: string): Promise<void> {
  return apiFetch<void>(`/arquivos/${id}`, { method: "DELETE" });
}

// ------------------------------------------------- lista geral (Contratos Clientes)

/**
 * Linha da lista geral de contratos (`GET /api/v1/contratos`) — o contrato resumido com
 * os NOMES junto (cliente, objeto, quem criou), para a tabela não precisar de uma consulta
 * por linha. Campos casam com `ContratoResumoDTO` da API.
 *
 * admin/ceo vê todos; quem não é admin vê só os contratos dos objetos que ele atende
 * (escopo por `membro_objetos` — decisão 3 do plano `docs/plano-contratos-e-timeline.md`).
 */
export interface ContratoResumo {
  id: string;
  clienteId: string;
  clienteNome?: string | null;
  numero: string;
  objetoId?: string | null;
  objetoNome?: string | null;
  valor?: number | null;
  /** `yyyy-MM-dd`. */
  dataAbertura?: string | null;
  situacao: string;
  descricao?: string | null;
  banco?: string | null;
  dataInicio?: string | null;
  dataValidade?: string | null;
  observacoes?: string | null;
  setorId?: string | null;
  createdBy?: string | null;
  criadoPorNome?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FiltroContratos {
  /** Numero, descricao ou nome do cliente (parcial). */
  busca?: string;
  clienteId?: string;
  objetoId?: string;
  situacao?: string;
  valorMin?: number;
  valorMax?: number;
  /** `yyyy-MM-dd` (abertura). */
  aberturaDe?: string;
  aberturaAte?: string;
  page?: number;
  size?: number;
}

/** Lista geral paginada da organização (a lista resumida da tela Contratos Clientes). */
export function listarContratosGeral(filtro: FiltroContratos = {}): Promise<Pagina<ContratoResumo>> {
  return apiFetch<Pagina<ContratoResumo>>("/contratos", {
    params: {
      busca: filtro.busca,
      clienteId: filtro.clienteId,
      objetoId: filtro.objetoId,
      situacao: filtro.situacao,
      valorMin: filtro.valorMin,
      valorMax: filtro.valorMax,
      aberturaDe: filtro.aberturaDe,
      aberturaAte: filtro.aberturaAte,
      page: filtro.page ?? 0,
      size: filtro.size ?? 50,
    },
  });
}
