import { apiFetch } from "@/lib/api/http";

/**
 * Bancos (`/api/v1/bancos`) — o cadastro que alimenta o select "Banco" do formulário de
 * contrato do Comercial (`ContratoBancoForm`), que até a correção 5 usava uma lista FIXA
 * de 18 nomes gravada no fonte.
 *
 * Campos casam com `BancoDTO` / `BancoNovoDTO` / `BancoAtualizacaoDTO` da API.
 *
 * Leitura aberta a qualquer autenticado (o form de contrato busca a lista a cada abertura
 * e filtra `ativo`); escrita só admin/ceo — o menu mostra a tela no grupo Cadastro só para
 * admin/ceo e a API responde 403 para os demais. Nome repetido na organização → 409 com a
 * mensagem da API (a tela mostra via `mensagemDeErro`).
 */
export interface Banco {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface BancoNovo {
  nome: string;
}

/** PUT: a API espera o estado completo do banco (nome + ativo), sem campo parcial. */
export interface BancoAtualizacao {
  nome: string;
  ativo: boolean;
}

/** Leitura: TODOS os bancos da organização (ativos e inativos — quem filtra é a tela). */
export function listarBancos(): Promise<Banco[]> {
  return apiFetch<Banco[]>("/bancos");
}

/** Cria um banco (201) — admin/ceo. */
export function criarBanco(dados: BancoNovo): Promise<Banco> {
  return apiFetch<Banco>("/bancos", { method: "POST", body: dados });
}

export function atualizarBanco(id: string, dados: BancoAtualizacao): Promise<Banco> {
  return apiFetch<Banco>(`/bancos/${id}`, { method: "PUT", body: dados });
}

/** Remove o banco (204). Os contratos já gravados mantêm o nome — a API não cascateia. */
export function excluirBanco(id: string): Promise<void> {
  return apiFetch<void>(`/bancos/${id}`, { method: "DELETE" });
}
