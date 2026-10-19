import { apiFetch } from "@/lib/api/http";

/**
 * Localidade (estados + cidades com código IBGE) — `/api/v1/estados` e
 * `/api/v1/cidades`. Tabelas globais semseedas pela migração V16 a partir do dump
 * `scripts/backup-cidade-estado.sql` (pedido do titular 16/10/2026): o cadastro de
 * cliente escolhe a cidade num menu e guarda os códigos junto.
 */
export interface Estado {
  uf: string;
  nome: string;
  codigoIbge: string;
}

export interface Cidade {
  codigoIbge: string;
  nome: string;
  uf: string;
}

/** 27 unidades da federação, ordenadas por UF. */
export function listarEstados(): Promise<Estado[]> {
  return apiFetch<Estado[]>("/estados");
}

/** Cidades de uma UF (obrigatória), com busca opcional no nome. */
export function listarCidades(uf: string, busca?: string, size = 1500): Promise<Cidade[]> {
  return apiFetch<Cidade[]>("/cidades", { params: { uf, busca, size } });
}

/** Normaliza para comparar nomes de cidade sem acento/caixa. */
export const semAcento = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
