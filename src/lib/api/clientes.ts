import { apiFetch } from "@/lib/api/http";

/**
 * Recursos de cliente contra a API própria (`/api/v1/clientes`) — módulo `cliente` da
 * `oliveira-api`. Os nomes dos campos casam com o DTO da API (`ClienteNovoDTO` / `ClienteDTO`),
 * que por sua vez preservam as colunas do banco legado.
 */

/** Dados de cadastro/edição (POST e PUT são substituição total dos campos do formulário). */
export interface ClienteNovo {
  nome: string;
  cpfCnpj?: string | null;
  rg?: string | null;
  orgaoEmissor?: string | null;
  nacionalidade?: string | null;
  estadoCivil?: string | null;
  profissao?: string | null;
  endereco?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  nomePropriedade?: string | null;
  culturaPrincipal?: string | null;
  observacoes?: string | null;
  areaHectares?: number | null;
}

/** Cliente devolvido pela API (cadastro + estado). */
export interface Cliente extends ClienteNovo {
  id: string;
  organizacaoId?: string | null;
  userId?: string | null;
  vip: boolean;
  statusAdimplencia: string;
  situacao: string;
  situacaoMotivo?: string | null;
  risco?: string | null;
  nps?: number | null;
  grupo?: string | null;
  cadastradoPor?: string | null;
  cadastradoEm?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Página no contrato estável da API (`Page` → `content` + `page`) — mora em `pagina.ts`. */
export type { Pagina } from "@/lib/api/pagina";

export interface FiltroClientes {
  nome?: string;
  cpfCnpj?: string;
  situacao?: string;
  page?: number;
  size?: number;
}

export function listarClientes(filtro: FiltroClientes = {}): Promise<Pagina<Cliente>> {
  return apiFetch<Pagina<Cliente>>("/clientes", {
    params: {
      nome: filtro.nome,
      cpfCnpj: filtro.cpfCnpj,
      situacao: filtro.situacao,
      page: filtro.page ?? 0,
      size: filtro.size ?? 20,
    },
  });
}

export function buscarCliente(id: string): Promise<Cliente> {
  return apiFetch<Cliente>(`/clientes/${id}`);
}

/** Cadastra um cliente (201). Nome repetido na organização → `ErroApi` 409. */
export function criarCliente(dados: ClienteNovo): Promise<Cliente> {
  return apiFetch<Cliente>("/clientes", { method: "POST", body: dados });
}

/** Atualiza o cadastro (200). Substituição total: envie todos os campos do formulário. */
export function atualizarCliente(id: string, dados: ClienteNovo): Promise<Cliente> {
  return apiFetch<Cliente>(`/clientes/${id}`, { method: "PUT", body: dados });
}

/** Exclui o cliente (204). É exclusão lógica na API: sai das listagens, a linha fica para auditoria. */
export function excluirCliente(id: string): Promise<void> {
  return apiFetch<void>(`/clientes/${id}`, { method: "DELETE" });
}
