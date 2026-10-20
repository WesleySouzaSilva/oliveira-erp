import { apiFetch } from "@/lib/api/http";

/**
 * Usuários da organização contra a API própria (`/api/v1/usuarios`) — módulo `identity`.
 *
 * Cadastro/edição/listagem DENTRO da plataforma, só admin/ceo (decisão do titular de
 * 15/10/2026 — antes o login novo só entrava pelo script deploy/criar-usuario.sh).
 * Os campos casam com o DTO da API (`UsuarioDTO`/`UsuarioNovoDTO`).
 */

export interface UsuarioAdmSetor {
  id: string;
  nome: string;
  /** Intervalo de valor de contrato que a pessoa atende NESTE setor (decisão §8 do plano). */
  valorMin?: number | null;
  valorMax?: number | null;
}

/** Vínculo enviado no cadastro/edição: setor + o intervalo de valor dele. */
export interface SetorVinculo {
  setorId: string;
  valorMin?: number | null;
  valorMax?: number | null;
}

export interface UsuarioAdmObjeto {
  id: string;
  tipoObjeto: string;
}

export interface UsuarioAdm {
  /** `usuarios.id`. */
  id: string;
  email: string;
  nome?: string | null;
  /** Papel (`Papel.java`): agronomo, advogado, admin, ... */
  papel?: string | null;
  ceo: boolean;
  ativo: boolean;
  setores?: UsuarioAdmSetor[] | null;
  objetos?: UsuarioAdmObjeto[] | null;
  /** Grupo de permissão atribuído (`permissionGroupId`) — null = sem permissão. */
  permissionGroupId?: string | null;
}

/** Cadastro (POST): `senha` é exigida pela API (mínimo 8). */
export interface UsuarioNovo {
  email: string;
  senha: string;
  nome: string;
  /** Papel continua no banco (NOT NULL); a API usa `advogado` quando não vier. */
  papel?: string | null;
  /** Setores em que a pessoa trabalha — cada um com o seu intervalo de valor. */
  setores?: SetorVinculo[];
  /** ids de `tipo_objeto` — os objetos/categorias que a pessoa atende (escopo). */
  objetos?: string[];
  permissionGroupId?: string | null;
}

/** Edição (PATCH): campos ausentes não mudam; `senha` só regrava se vier. */
export interface UsuarioAtualizacao {
  nome?: string;
  papel?: string | null;
  senha?: string | null;
  ativo?: boolean;
  /** Substitui os vínculos (setores com faixa) — igual para `objetos`. */
  setores?: SetorVinculo[];
  objetos?: string[];
  /** Troca a permissão (grupo) da pessoa; nulo não mexe. */
  permissionGroupId?: string | null;
}

/** Onde a busca de texto procura — o "tipo de busca" do select da tela de usuários. */
export type BuscaUsuarios = "nome" | "email";

/** Lista da organização (admin/ceo). A busca é opcional (tipo escolhido no front). */
export function listarUsuarios(filtro: { busca?: string; buscaEm?: BuscaUsuarios } = {}): Promise<UsuarioAdm[]> {
  return apiFetch<UsuarioAdm[]>("/usuarios", {
    params: { busca: filtro.busca, buscaEm: filtro.buscaEm },
  });
}

/** Cria o login + vínculo (201). E-mail já usado na organização → `ErroApi` 409. */
export function criarUsuario(dados: UsuarioNovo): Promise<UsuarioAdm> {
  return apiFetch<UsuarioAdm>("/usuarios", { method: "POST", body: dados });
}

/** Atualização parcial (PATCH): campos ausentes não mudam. */
export function atualizarUsuario(id: string, dados: UsuarioAtualizacao): Promise<UsuarioAdm> {
  return apiFetch<UsuarioAdm>(`/usuarios/${id}`, { method: "PATCH", body: dados });
}
