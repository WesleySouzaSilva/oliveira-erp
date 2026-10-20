import { apiFetch } from "@/lib/api/http";

/**
 * Funções (cargos) da organização — catálogo `/api/v1/funcoes` (módulo `identity/funcao`).
 *
 * Era uma lista FIXA (enum `Papel.java`, 21 valores); a partir de 16/10/2026 o admin
 * cadastra as funções da empresa na tela **Funções** (menu Cadastro) e o select
 * "Função" do cadastro de usuário vem daqui. `admin` nasce no seed e é protegida
 * (não pode ser apagada) — ela é perfil de acesso, não é cargo.
 *
 * Contrato: GET devolve `[{id, nome, chave, ativo, ordem}]` da organização do token;
 * a `chave` (slug) é imutável e é o valor gravado em `membros.papel`.
 */
export interface Funcao {
  id: string;
  nome: string;
  chave: string;
  ativo: boolean;
  ordem?: number | null;
}

export interface FuncaoNova {
  nome: string;
  ordem?: number | null;
  ativo?: boolean;
}

/** PATCH: nome/ordem/ativo; campos ausentes não mudam (a `chave` nunca muda). */
export interface FuncaoAtualizacao {
  nome?: string;
  ordem?: number | null;
  ativo?: boolean;
}

/** Leitura aberta a qualquer autenticado (o select do cadastro de usuário precisa dela). */
export function listarFuncoes(): Promise<Funcao[]> {
  return apiFetch<Funcao[]>("/funcoes");
}

/** Cria uma função (201) — admin/ceo. A `chave` sai do nome (slug); repetida → 409. */
export function criarFuncao(dados: FuncaoNova): Promise<Funcao> {
  return apiFetch<Funcao>("/funcoes", { method: "POST", body: dados });
}

export function atualizarFuncao(id: string, dados: FuncaoAtualizacao): Promise<Funcao> {
  return apiFetch<Funcao>(`/funcoes/${id}`, { method: "PATCH", body: dados });
}

/** Remove a função. Em uso por alguém → 409; `admin` → 400 (perfil protegido). */
export function excluirFuncao(id: string): Promise<void> {
  return apiFetch<void>(`/funcoes/${id}`, { method: "DELETE" });
}
