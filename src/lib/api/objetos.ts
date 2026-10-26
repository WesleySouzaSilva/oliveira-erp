import { apiFetch } from "@/lib/api/http";

/**
 * Recursos de tipo de objeto (categoria do contrato) e sub-objeto (subcategoria)
 * contra a API própria (`/api/v1/...`) — módulo `tipoobjeto`. Os campos casam com
 * `TipoObjetoDTO` / `SubObjetoDTO` / `TipoObjetoNovoDTO` / `SubObjetoNovoDTO`.
 *
 * Cadastro único do escritorio, sem organizacao: a leitura vale para qualquer
 * autenticado (o select do contrato precisa) e a escrita e so admin/ceo (403).
 */

export interface TipoObjeto {
  id: string;
  tipoObjeto: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubObjeto {
  id: string;
  tipoObjetoId: string;
  /** Nome do tipo junto, para a lista mostrar "Objeto | Subcategoria". */
  tipoObjeto?: string | null;
  descricao: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TipoObjetoNovo {
  tipoObjeto: string;
}

export interface SubObjetoNovo {
  tipoObjetoId: string;
  descricao: string;
}

// ---------------------------------------------------------------- tipo de objeto

export function listarTiposObjeto(): Promise<TipoObjeto[]> {
  return apiFetch<TipoObjeto[]>("/tipo-objeto");
}

export function criarTipoObjeto(dados: TipoObjetoNovo): Promise<TipoObjeto> {
  return apiFetch<TipoObjeto>("/tipo-objeto", { method: "POST", body: dados });
}

/** PATCH: nome vazio não muda. */
export function atualizarTipoObjeto(id: string, dados: TipoObjetoNovo): Promise<TipoObjeto> {
  return apiFetch<TipoObjeto>(`/tipo-objeto/${id}`, { method: "PATCH", body: dados });
}

/** Apaga o tipo e os sub-objetos dele. Em uso por contrato: 409. */
export function excluirTipoObjeto(id: string): Promise<void> {
  return apiFetch<void>(`/tipo-objeto/${id}`, { method: "DELETE" });
}

// ------------------------------------------------------------------- sub-objeto

/** `tipoObjetoId` opcional: sem ele, lista todos. */
export function listarSubObjetos(tipoObjetoId?: string): Promise<SubObjeto[]> {
  const query = tipoObjetoId ? `?tipoObjetoId=${encodeURIComponent(tipoObjetoId)}` : "";
  return apiFetch<SubObjeto[]>(`/sub-objeto${query}`);
}

export function criarSubObjeto(dados: SubObjetoNovo): Promise<SubObjeto> {
  return apiFetch<SubObjeto>("/sub-objeto", { method: "POST", body: dados });
}

/** PATCH: campos ausentes não mudam. */
export function atualizarSubObjeto(id: string, dados: Partial<SubObjetoNovo>): Promise<SubObjeto> {
  return apiFetch<SubObjeto>(`/sub-objeto/${id}`, { method: "PATCH", body: dados });
}

export function excluirSubObjeto(id: string): Promise<void> {
  return apiFetch<void>(`/sub-objeto/${id}`, { method: "DELETE" });
}
