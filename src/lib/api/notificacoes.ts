import { apiFetch } from "@/lib/api/http";
import type { Pagina } from "@/lib/api/pagina";

/**
 * Notificações de MOVIMENTAÇÃO de tarefa — `GET /api/v1/notificacoes` (o destinatário
 * lê as suas; a API grava sozinha quando alguém encaminha ou cria tarefa para outra
 * pessoa — requisito do titular 16/10/2026).
 *
 * A notificação some da lista (fica `lida`) quando a pessoa ABRE a tarefa pela lista ou
 * pelo kanban — não basta clicar no sininho. O sino (menu Tarefas + ao lado das abas
 * Lista/Kanban) mostra o total de não lidas.
 */
export interface Notificacao {
  id: string;
  tarefaId: string;
  tarefaTitulo?: string | null;
  /** Quem encaminhou/criou. */
  deUsuarioId?: string | null;
  deUsuarioNome?: string | null;
  /** Recado curto do movimento (ex.: "Encaminhada para você"). */
  mensagem?: string | null;
  lida: boolean;
  quando: string;
}

export interface FiltroNotificacoes {
  /** Só as não lidas (o padrão do sininho). */
  naoLidas?: boolean;
  page?: number;
  size?: number;
}

export function listarNotificacoes(filtro: FiltroNotificacoes = {}): Promise<Pagina<Notificacao>> {
  return apiFetch<Pagina<Notificacao>>("/notificacoes", {
    params: {
      naoLidas: filtro.naoLidas,
      page: filtro.page ?? 0,
      size: filtro.size ?? 20,
    },
  });
}

/** Marca a notificação como lida (204) — chamado quando a pessoa abre a tarefa. */
export function marcarNotificacaoLida(id: string): Promise<void> {
  return apiFetch<void>(`/notificacoes/${id}/lida`, { method: "POST" });
}
