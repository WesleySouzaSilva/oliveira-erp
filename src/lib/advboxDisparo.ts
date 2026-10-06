import { supabase } from "@/integrations/supabase/client";

/**
 * Disparo imediato para o ADVBOX de um cliente: cadastro, processo por
 * titular + banco contratado e as tarefas cuja data de agenda já chegou.
 * O que ainda está fora da janela de 15 dias úteis não é criado agora —
 * a rotina das 07:00 cria quando chegar a hora.
 */
export interface DisparoResultado {
  ok?: boolean;
  cliente?: string;
  customers_id?: string | null;
  processos?: { banco: string; lawsuits_id: string; criado: boolean }[];
  tarefas?: number;
  bloqueios?: string[];
  detalhes?: { fila_proxima_rodada?: number; vencidas_para_fila?: number; erro?: string | null };
}

/** Frase única para mostrar na tela depois do disparo. */
export function textoDisparo(r: DisparoResultado | null | undefined): string {
  if (!r) return "Nada foi enviado ao ADVBOX.";
  const procs = r.processos ?? [];
  if (!procs.length) {
    const motivos = (r.bloqueios ?? []).join("; ");
    return motivos ? `Nada enviado ao ADVBOX — ${motivos}.` : "Nada enviado ao ADVBOX: nenhum banco contratado.";
  }
  const lista = procs.map((p) => `${p.banco} nº ${p.lawsuits_id}`).join(", ");
  const tarefas = r.tarefas ?? 0;
  const fila = r.detalhes?.fila_proxima_rodada ?? 0;
  let txt =
    `Enviado ao ADVBOX: cliente nº ${r.customers_id || "—"}, processo ${lista}, ` +
    `${tarefas} tarefa${tarefas === 1 ? "" : "s"}.`;
  if (fila > 0) {
    txt += ` ${fila} tarefa${fila === 1 ? "" : "s"} ainda fora da janela — nasce${fila === 1 ? "" : "m"} na rotina do dia certo.`;
  }
  const vencidas = r.detalhes?.vencidas_para_fila ?? 0;
  if (vencidas > 0) {
    txt += ` ${vencidas} operação${vencidas === 1 ? "" : "ões"} vencida${vencidas === 1 ? "" : "s"} ` +
      `enviada${vencidas === 1 ? "" : "s"} para a fila de vencidas, sem tarefa.`;
  }
  if (r.bloqueios?.length) txt += ` Fora do envio: ${r.bloqueios.join("; ")}.`;
  return txt;
}

export async function dispararAdvbox(
  clienteId: string,
  motivo: string,
  /** Marcação em lote de cliente antigo pela Base: vencida não vira tarefa. */
  opcoes?: { semVencidas?: boolean },
): Promise<{ ok: boolean; texto: string; resultado?: DisparoResultado }> {
  const { data, error } = await supabase.functions.invoke("advbox-sync", {
    body: {
      action: "disparo_imediato",
      params: { cliente_id: clienteId, motivo, sem_vencidas: opcoes?.semVencidas === true },
    },
  });
  if (error) {
    return { ok: false, texto: `Não foi possível enviar ao ADVBOX agora: ${error.message}` };
  }
  const r = ((data as any)?.data ?? data) as DisparoResultado;
  if ((r as any)?.error) return { ok: false, texto: `Não foi possível enviar ao ADVBOX: ${(r as any).error}` };
  return { ok: true, texto: textoDisparo(r), resultado: r };
}
