import { useEffect, useState } from "react";
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  type Notificacao,
} from "@/lib/api/notificacoes";

/**
 * Sino de notificações de tarefa (pedido do titular 16/10/2026).
 *
 * Store ÚNICO em módulo: o menu Tarefas e a tela de Tarefas assinam o mesmo sino — a
 * pergunta ao servidor (20 em 20 segundos, enquanto alguém está logado) roda UMA vez,
 * mesmo com as duas telas montadas. A API não tem push/websocket, então o card de
 * "você recebeu uma tarefa de X" aparece na próxima pergunta.
 *
 * Regra do titular: a notificação some quando a pessoa ABRE a tarefa pela lista ou pelo
 * kanban (`aoAbrirTarefa`) — clicar no sininho não limpa nada.
 */
const INTERVALO_MS = 20_000;

interface Estado {
  naoLidas: number;
  novas: Notificacao[];
}

let estado: Estado = { naoLidas: 0, novas: [] };
const ouvintes = new Set<(valor: Estado) => void>();
const avisadas = new Set<string>();
let timer: number | null = null;

function anunciar() {
  ouvintes.forEach((ouvinte) => ouvinte(estado));
}

async function recarregar() {
  try {
    const resultado = await listarNotificacoes({ naoLidas: true, size: 20 });
    const pendentes = resultado.content.filter((item) => !avisadas.has(item.id));
    pendentes.forEach((item) => avisadas.add(item.id));
    estado = {
      naoLidas: resultado.page.totalElements,
      novas: [...pendentes, ...estado.novas].slice(0, 20),
    };
    anunciar();
  } catch {
    // sem token/rota nova no servidor: o sino fica em silêncio, nada quebra
  }
}

function iniciar() {
  if (timer !== null) return;
  void recarregar();
  timer = window.setInterval(() => void recarregar(), INTERVALO_MS);
}

/** Chame quando a pessoa ABRE a tarefa: some as notificações dela (aqui e no servidor). */
export function aoAbrirTarefa(tarefaId: string) {
  const restantes = estado.novas.filter((item) => item.tarefaId !== tarefaId);
  const removidas = estado.novas.length - restantes.length;
  if (removidas > 0) {
    estado = { ...estado, novas: restantes, naoLidas: Math.max(0, estado.naoLidas - removidas) };
    anunciar();
  }
  // O servidor confirma a leitura em segundo plano (as da tarefa somem também na API).
  void listarNotificacoes({ naoLidas: true, size: 50 })
    .then((resultado) =>
      resultado.content
        .filter((item) => item.tarefaId === tarefaId)
        .forEach((item) => void marcarNotificacaoLida(item.id).catch(() => undefined)),
    )
    .catch(() => undefined);
}

/** Tela de Tarefas chama depois de criar/encaminhar — a pergunta acontece na hora. */
export function recarregarNotificacoes() {
  void recarregar();
}

export interface SinoNotificacoes {
  naoLidas: number;
  novas: Notificacao[];
}

/** Assina o sino (menu e tela compartilham o mesmo contador). */
export function useNotificacoes(): SinoNotificacoes {
  const [valor, setValor] = useState<Estado>(estado);

  useEffect(() => {
    iniciar();
    ouvintes.add(setValor);
    setValor(estado);
    return () => {
      ouvintes.delete(setValor);
    };
  }, []);

  return valor;
}
