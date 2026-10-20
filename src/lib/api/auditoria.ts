import { apiFetch } from "@/lib/api/http";
import type { Pagina } from "@/lib/api/pagina";

/**
 * Auditoria do sistema — `GET /api/v1/auditoria` (admin/ceo).
 *
 * Trilha de TODO movimento de escrita (criou/editou/excluiu o quê, em qual tabela, quem e
 * de QUAL PC — campo `ip`). O IP fica só aqui e no banco: a tela de histórico da TAREFA não
 * mostra IP ao usuário (decisão do titular 16/10/2026). Senhas/tokens nunca são gravados
 * (a API sanitiza antes de salvar).
 */
export interface LinhaAuditoria {
  id: string;
  tabela: string;
  registroId?: string | null;
  acao: string;
  usuarioId?: string | null;
  usuarioNome?: string | null;
  ip?: string | null;
  dadosAntigos?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  quando: string;
}

export interface FiltroAuditoria {
  tabela?: string;
  acao?: string;
  usuarioId?: string;
  /** yyyy-MM-dd. */
  de?: string;
  /** yyyy-MM-dd. */
  ate?: string;
  page?: number;
  size?: number;
}

export function listarAuditoria(filtro: FiltroAuditoria = {}): Promise<Pagina<LinhaAuditoria>> {
  return apiFetch<Pagina<LinhaAuditoria>>("/auditoria", {
    params: {
      tabela: filtro.tabela,
      acao: filtro.acao,
      usuarioId: filtro.usuarioId,
      de: filtro.de,
      ate: filtro.ate,
      page: filtro.page ?? 0,
      size: filtro.size ?? 50,
    },
  });
}
