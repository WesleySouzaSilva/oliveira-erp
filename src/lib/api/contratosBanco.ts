import { apiFetch } from "@/lib/api/http";
import type { Pagina } from "@/lib/api/pagina";

/**
 * Contratos do cliente com o BANCO (`/api/v1/contratos-banco`) — módulo `cliente` da
 * `oliveira-api` (Fase 3, correção 4 de `docs/plano-correcoes-comercial-contratos-tarefas.md`).
 * É o espelho do fonte antigo: operação de crédito/financiamento do cliente junto ao
 * banco (não confundir com `contratos.ts`, que é o contrato cliente × ESCRITÓRIO).
 *
 * Leitura: qualquer autenticado. Escritas (POST/PUT/DELETE): `authority 'clientes'` ou
 * papel admin/ceo — a API responde 403 para o resto.
 */

/** Um contrato do cliente com o banco — campos do DTO de visualização (camelCase). */
export interface ContratoBanco {
  id: string;
  clienteId: string;
  clienteNome: string;
  banco: string;
  numeroContrato?: string | null;
  /** Valor total da operação (BigDecimal → number no JSON). */
  valorTotalOperacao?: number | null;
  /** Valor de cada parcela. */
  valorParcela?: number | null;
  /** Datas no formato `yyyy-MM-dd` (string, como o resto das datas da API). */
  primeiroVencimento?: string | null;
  vencimentoProximaParcela?: string | null;
  vencimentoUltimaParcela?: string | null;
  observacoes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Dados de cadastro/edição (POST e PUT): só `clienteId` e `banco` são obrigatórios. */
export interface ContratoBancoNovo {
  clienteId: string;
  banco: string;
  numeroContrato?: string | null;
  valorTotalOperacao?: number | null;
  valorParcela?: number | null;
  primeiroVencimento?: string | null;
  vencimentoProximaParcela?: string | null;
  vencimentoUltimaParcela?: string | null;
  observacoes?: string | null;
}

/** Filtros da listagem — `banco` é parcial e `cliente` é trecho do NOME do cliente. */
export interface FiltroContratosBanco {
  /** UUID do cliente (dialog "Com o banco" da lista de clientes). */
  clienteId?: string;
  /** Trecho do nome do banco. */
  banco?: string;
  /** Trecho do nome do cliente. */
  cliente?: string;
  page?: number;
  size?: number;
}

/** Página no contrato estável da API (`Page` → `content` + `page`) — mora em `pagina.ts`. */
export type { Pagina } from "@/lib/api/pagina";

/** Lista os contratos com o banco (paginação; ordenação banco/número no servidor). */
export function listarContratosBanco(filtro: FiltroContratosBanco = {}): Promise<Pagina<ContratoBanco>> {
  return apiFetch<Pagina<ContratoBanco>>("/contratos-banco", {
    params: {
      clienteId: filtro.clienteId,
      banco: filtro.banco,
      cliente: filtro.cliente,
      page: filtro.page ?? 0,
      size: filtro.size ?? 50,
    },
  });
}

/** Busca um contrato pelo id. */
export function buscarContratoBanco(id: string): Promise<ContratoBanco> {
  return apiFetch<ContratoBanco>(`/contratos-banco/${id}`);
}

/** Cadastra um contrato com o banco (201). Sem banco → 400 com mensagem. */
export function criarContratoBanco(dados: ContratoBancoNovo): Promise<ContratoBanco> {
  return apiFetch<ContratoBanco>("/contratos-banco", { method: "POST", body: dados });
}

/** Atualiza o contrato (200). Substituição total dos campos do formulário. */
export function atualizarContratoBanco(id: string, dados: ContratoBancoNovo): Promise<ContratoBanco> {
  return apiFetch<ContratoBanco>(`/contratos-banco/${id}`, { method: "PUT", body: dados });
}

/** Exclui o contrato com o banco (204). */
export function excluirContratoBanco(id: string): Promise<void> {
  return apiFetch<void>(`/contratos-banco/${id}`, { method: "DELETE" });
}
