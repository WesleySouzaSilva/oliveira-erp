import { apiFetch } from "@/lib/api/http";

/**
 * Recursos de cliente contra a API própria (`/api/v1/clientes`) — módulo `cliente` da
 * `oliveira-api`. Os nomes dos campos casam com o DTO da API (`ClienteNovoDTO` / `ClienteDTO`),
 * que por sua vez preservam as colunas do banco legado.
 */

/** Um endereço do cliente — contrato 16/10/2026: o cliente passa a ter VÁRIOS. */
export interface ClienteEndereco {
  id?: string;
  /** `residencial` | `empresarial` | `escritorio` (texto livre no banco). */
  tipo: string;
  logradouro: string;
  municipio?: string;
  uf?: string;
  /** Códigos IBGE escolhidos no menu de cidades da linha (V16). */
  ibgeCidade?: string;
  ibgeEstado?: string;
  cep?: string;
  /** Um único endereço principal por cliente (o preenchido nas colunas legadas). */
  principal?: boolean;
}

/** Um telefone do cliente — contrato 16/10/2026. */
export interface ClienteTelefone {
  id?: string;
  /** `celular` | `fixo` | `comercial` (texto livre no banco). */
  tipo: string;
  numero: string;
  principal?: boolean;
}

/** Um e-mail do cliente — contrato 16/10/2026. */
export interface ClienteEmail {
  id?: string;
  email: string;
  principal?: boolean;
}

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
  /** Múltiplos contatos/endereços (contrato 16/10/2026): POST aceita as 3 listas embutidas e
   * `PUT/PATCH /clientes/{id}` substitui as listas quando vierem (ausente = não mexe). */
  telefones?: ClienteTelefone[];
  emails?: ClienteEmail[];
  enderecos?: ClienteEndereco[];
  /** Códigos IBGE da cidade/estado escolhidos no menu de localidade (V16). */
  ibgeCidade?: string | null;
  ibgeEstado?: string | null;
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

/** Onde a busca de texto procura — o "tipo de busca" do select da tela de clientes. */
export type BuscaClientes = "nome" | "cpf_cnpj" | "email";

export interface FiltroClientes {
  /** Texto digitado na busca (o campo em que ele é procurado vem em `buscaEm`). */
  busca?: string;
  /** `nome`, `cpf_cnpj` ou `email`; sem ele a API procura em nome OU CPF/CNPJ. */
  buscaEm?: BuscaClientes;
  nome?: string;
  cpfCnpj?: string;
  /** Filtro por coluna "Município" (Correção 6) — a API já aceita o parâmetro. */
  municipio?: string;
  /** Filtro por coluna "Telefone" (Correção 6) — a API já aceita o parâmetro. */
  telefone?: string;
  situacao?: string;
  page?: number;
  size?: number;
}

export function listarClientes(filtro: FiltroClientes = {}): Promise<Pagina<Cliente>> {
  return apiFetch<Pagina<Cliente>>("/clientes", {
    params: {
      busca: filtro.busca,
      buscaEm: filtro.buscaEm,
      nome: filtro.nome,
      cpfCnpj: filtro.cpfCnpj,
      municipio: filtro.municipio,
      telefone: filtro.telefone,
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
