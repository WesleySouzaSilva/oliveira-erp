import { apiFetch } from "@/lib/api/http";

/**
 * Integrações externas (Invertexto: CEP + CNPJ) — API própria (`/api/v1/integracoes`).
 * A configuração (url, apikey, limite/mês) é de admin; o proxy de CEP/CNPJ é aberto a
 * qualquer autenticado (quem cadastra cliente usa). A apikey NUNCA passa por aqui: o
 * front só manda o CEP/CNPJ e a API faz a chamada com a chave gravada.
 */

/** Chave usada hoje (uma integração por organização). */
export const INVERTEXO = "invertexto";

/** Configuração atual — `apikeyMascarada` são só os últimos 4; `temApikey` diz se já tem. */
export interface Integracao {
  id: string | null;
  chave: string;
  descricao: string;
  urlBase: string;
  temApikey: boolean;
  apikeyMascarada: string;
  limiteMes: number | null;
  ativa: boolean;
}

/** Resultado do teste de conexão de uma integração. */
export interface Teste {
  chave: string;
  ok: boolean;
  mensagem: string;
  latenciaMs: number | null;
}

/** Dados para salvar (apikey em branco na edição mantém a gravada). */
export interface IntegracaoSalvar {
  urlBase: string;
  apikey?: string | null;
  limiteMes: number | null;
  ativa: boolean;
}

/** Consumo do mês corrente (`restantes` = -1 quando sem limite). */
export interface Consumo {
  chave: string;
  limite: number | null;
  usados: number;
  restantes: number;
  mes: string;
}

/** Endereço devolvido pela consulta de CEP (o front resolve o código IBGE). */
export interface CepResposta {
  cep: string | null;
  logradouro: string | null;
  bairro: string | null;
  localidade: string | null;
  uf: string | null;
}

/** Dados da empresa devolvidos pela consulta de CNPJ (nome + endereço). */
export interface CnpjResposta {
  cnpj: string | null;
  razaoSocial: string | null;
  situacao: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  cnae: string | null;
  capitalSocial: string | null;
  /** `telefone1` da Invertexto (formato "61 34939002") — preenche a 1ª linha vazia. */
  telefone: string | null;
  email: string | null;
}

export function buscarIntegracao(chave: string = INVERTEXO): Promise<Integracao> {
  return apiFetch<Integracao>(`/integracoes/${chave}`);
}

export function salvarIntegracao(dados: IntegracaoSalvar, chave: string = INVERTEXO): Promise<Integracao> {
  return apiFetch<Integracao>(`/integracoes/${chave}`, { method: "PUT", body: dados });
}

export function consumoIntegracao(chave: string = INVERTEXO): Promise<Consumo> {
  return apiFetch<Consumo>(`/integracoes/${chave}/consumo`);
}

/** Lista TODAS as integrações cadastradas da organização (a lista da tela). */
export function listarIntegracoes(): Promise<Integracao[]> {
  return apiFetch<Integracao[]>("/integracoes");
}

/** Testa a conexão de uma integração (chamada leve; não conta no contador do mês). */
export function testarIntegracao(chave: string): Promise<Teste> {
  return apiFetch<Teste>(`/integracoes/${chave}/testar`, { method: "POST" });
}

/** Proxy: a API consulta a Invertexto com a chave gravada e devolve o endereço. */
export function consultarCep(cep: string, chave: string = INVERTEXO): Promise<CepResposta> {
  return apiFetch<CepResposta>(`/integracoes/${chave}/cep/${cep}`);
}

/** Proxy: a API consulta a Invertexto e devolve os dados da empresa + endereço. */
export function consultarCnpj(cnpj: string, chave: string = INVERTEXO): Promise<CnpjResposta> {
  return apiFetch<CnpjResposta>(`/integracoes/${chave}/cnpj/${cnpj}`);
}
