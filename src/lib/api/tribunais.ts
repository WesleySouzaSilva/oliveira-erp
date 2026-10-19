import { apiFetch } from "@/lib/api/http";

/**
 * Códigos dos tribunais (TOTP) contra a API própria (`/api/v1/tribunais`) —
 * módulo `tribunal` da `oliveira-api`. Réplica da edge function legada
 * `totp-tribunais`, com a regra nova do titular (19/10/2026): ver lista e
 * GERAR código é de TODO usuário; cadastrar/renomear/remover/histórico é só
 * admin (a API barra com 403 — o front só esconde os botões).
 *
 * O segredo NUNCA desce (nem para admin): só o código de 6 dígitos, gerado na
 * hora, com trilha registrada no servidor.
 */

export interface CredencialTribunal {
  id: string;
  nome: string;
  descricao?: string | null;
  digitos: number;
  periodo: number;
  algoritmo: string;
}

export interface CodigoTribunal {
  /** Só os dígitos (ex.: "482913"). */
  codigo: string;
  /** Segundos por período (padrão 30). */
  periodo: number;
  /** Segundos até o próximo giro (1..periodo). */
  expiraEm: number;
}

export interface ConsultaTribunal {
  id: string;
  credencialNome?: string | null;
  /** Nome de quem consultou/agiu. */
  nome?: string | null;
  /** `consulta_codigo` | `criar` | `renomear` | `remover`. */
  acao: string;
  sucesso: boolean;
  /** true = foi só a renovação automática da tela (escondida por padrão). */
  renovacao: boolean;
  ip?: string | null;
  createdAt?: string;
}

/** Lista os acessos vivos da organização (qualquer autenticado). */
export function listarCredenciaisTribunal(): Promise<CredencialTribunal[]> {
  return apiFetch<CredencialTribunal[]>("/tribunais");
}

/** Código ao vivo de um acesso (qualquer autenticado; a consulta fica registrada). */
export function gerarCodigoTribunal(id: string): Promise<CodigoTribunal> {
  return apiFetch<CodigoTribunal>(`/tribunais/${id}/codigo`);
}

/**
 * Cadastra um acesso (só admin). A chave vai em claro UMA vez e é gravada
 * cifrada no servidor — depois dela, ninguém vê a chave de novo.
 */
export function criarCredencialTribunal(dados: {
  nome: string;
  descricao?: string;
  segredo: string;
}): Promise<CredencialTribunal> {
  return apiFetch<CredencialTribunal>("/tribunais", { method: "POST", body: dados });
}

/** Renomeia (só admin) — não toca no segredo. */
export function renomearCredencialTribunal(
  id: string,
  dados: { nome: string; descricao?: string },
): Promise<CredencialTribunal> {
  return apiFetch<CredencialTribunal>(`/tribunais/${id}`, { method: "PATCH", body: dados });
}

/** Remove o acesso (só admin). A chave não é recuperável; o histórico fica. */
export function removerCredencialTribunal(id: string): Promise<void> {
  return apiFetch<void>(`/tribunais/${id}`, { method: "DELETE" });
}

/** Histórico de consultas/ações (só admin) — últimas 200, mais recente primeiro. */
export function historicoTribunal(): Promise<ConsultaTribunal[]> {
  return apiFetch<ConsultaTribunal[]>("/tribunais/historico");
}
