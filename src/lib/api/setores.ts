import { apiFetch } from "@/lib/api/http";

/**
 * Setores do escritório (`/api/v1/setores`) — o "para onde a tarefa vai" e a área em que a
 * pessoa trabalha (ex.: agronegócio, bancário, empresarial). Os 5 do fluxo já nascem com a
 * migração V6; o cadastro pelo menu (Setores, admin/ceo) entra em cima deles.
 *
 * Campos casam com `SetorDTO` / `SetorNovoDTO` / `SetorAtualizacaoDTO` da API.
 */

export interface Setor {
  id: string;
  nome: string;
  ordem?: number;
  ativo?: boolean;
}

export interface SetorNovo {
  nome: string;
  ordem?: number;
  ativo?: boolean;
}

/** PATCH: nome/ordem/ativo; campos ausentes não mudam. */
export interface SetorAtualizacao {
  nome?: string;
  ordem?: number;
  ativo?: boolean;
}

/** Leitura aberta a qualquer autenticado (a lista do cadastro de usuário precisa dela). */
export function listarSetores(): Promise<Setor[]> {
  return apiFetch<Setor[]>("/setores");
}

/** Cria um setor (201) — admin/ceo. */
export function criarSetor(dados: SetorNovo): Promise<Setor> {
  return apiFetch<Setor>("/setores", { method: "POST", body: dados });
}

export function atualizarSetor(id: string, dados: SetorAtualizacao): Promise<Setor> {
  return apiFetch<Setor>(`/setores/${id}`, { method: "PATCH", body: dados });
}

/** Remove o setor. Com membro vinculado a API responde 409 — a tela mostra o motivo. */
export function excluirSetor(id: string): Promise<void> {
  return apiFetch<void>(`/setores/${id}`, { method: "DELETE" });
}
