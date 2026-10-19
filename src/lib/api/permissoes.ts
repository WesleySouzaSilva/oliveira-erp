import { apiFetch } from "@/lib/api/http";
import type { Pagina } from "@/lib/api/pagina";

/**
 * Grupos de permissão ("Permissões") — `/api/v1/grupos-permissoes`, módulo
 * `identity/grupopermissao`.
 *
 * É a tabela de PERMISSÕES do sistema (pedido do titular 16/10/2026): um grupo é uma
 * permissão nomeada ("Comercial", "Jurídico") que libera os MÓDULOS marcados. A regra é
 * GROSSA de propósito — quem tem o módulo, tem ler/cadastrar/editar/excluir naquele
 * módulo; não separamos por ação para não multiplicar regras (decisão do titular).
 *
 * O admin cadastra os grupos aqui e atribui a pessoa no cadastro de Usuários
 * (`permissionGroupId`). O JSON casa com `GrupoPermissaoDTO` / `GrupoPermissaoNovoDTO`.
 */
export interface GrupoPermissao {
  id: string;
  nome: string;
  descricao?: string | null;
  /** Chaves do `MODULE_CATALOG` (src/lib/permissionModules.ts). */
  modulos: string[];
}

export interface GrupoPermissaoNovo {
  nome: string;
  descricao?: string | null;
  modulos: string[];
}

/** Lista paginada (a API devolve `Page`: content + page). Leitura aberta a qualquer autenticado. */
export function listarGruposPermissoes(size = 100): Promise<Pagina<GrupoPermissao>> {
  return apiFetch<Pagina<GrupoPermissao>>("/grupos-permissoes", {
    params: { page: 0, size },
  });
}

/** Cria o grupo (201) — admin/ceo. Módulo fora do catálogo → 400. */
export function criarGrupoPermissao(dados: GrupoPermissaoNovo): Promise<GrupoPermissao> {
  return apiFetch<GrupoPermissao>("/grupos-permissoes", { method: "POST", body: dados });
}

/** PUT: substitui nome/descrição/módulos — admin/ceo. */
export function atualizarGrupoPermissao(id: string, dados: GrupoPermissaoNovo): Promise<GrupoPermissao> {
  return apiFetch<GrupoPermissao>(`/grupos-permissoes/${id}`, { method: "PUT", body: dados });
}

/** Remove o grupo. A pessoa que usava fica sem grupo (cai nos padrões do papel). */
export function excluirGrupoPermissao(id: string): Promise<void> {
  return apiFetch<void>(`/grupos-permissoes/${id}`, { method: "DELETE" });
}
