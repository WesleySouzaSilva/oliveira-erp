import { apiFetch } from "@/lib/api/http";

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
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContratoNovo {
  numero: string;
  banco?: string | null;
  descricao?: string | null;
  situacao?: string | null;
  dataInicio?: string | null;
  dataValidade?: string | null;
  observacoes?: string | null;
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
