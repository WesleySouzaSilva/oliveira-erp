import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";

/**
 * Phase-specific deadline options (in days)
 */
export const PRAZO_OPTIONS: Record<number, { label: string; dias: number }[]> = {
  1: [
    { label: "Urgente (1 dia)", dias: 1 },
    { label: "Rápido (5 dias)", dias: 5 },
    { label: "Normal (15 dias)", dias: 15 },
    { label: "Estendido (30 dias)", dias: 30 },
  ],
  2: [
    { label: "Urgente (1 dia)", dias: 1 },
    { label: "Rápido (3 dias)", dias: 3 },
    { label: "Normal (15 dias)", dias: 15 },
  ],
  3: [
    { label: "Padrão (15 dias)", dias: 15 },
  ],
  4: [
    { label: "Padrão (15 dias)", dias: 15 },
  ],
};

export const FASE_TASK_TITLES: Record<number, string> = {
  1: "ELABORAÇÃO DE LAUDO TÉCNICO",
  2: "ENVIO DE NOTIFICAÇÃO EXTRAJUDICIAL",
  3: "ACOMPANHAMENTO DE RESPOSTA DO BANCO",
  4: "PROTOCOLAR AÇÃO JUDICIAL",
};

export const FASE_TASK_DESCRIPTIONS: Record<number, string> = {
  1: "Elaborar e finalizar o laudo técnico agronômico para fundamentar o pedido de alongamento da dívida.",
  2: "Preparar e enviar a notificação extrajudicial ao banco, fundamentada no MCR 2.6.4 e legislação aplicável.",
  3: "Aguardar e acompanhar a resposta do banco à notificação extrajudicial. Prazo legal de 15 dias para resposta.",
  4: "Banco não respondeu ou negou taxativamente. Protocolar ação judicial de obrigação de fazer dentro do prazo.",
};

/**
 * Creates an automated task when a process phase begins.
 */
export async function criarTarefaFase(params: {
  fase: number;
  prazoDias: number;
  processoId: string;
  organizacaoId: string;
  responsavelId: string;
  userId: string;
  nomeCliente: string;
  dataBase?: string; // base date for deadline calc, defaults to today
}) {
  const {
    fase,
    prazoDias,
    processoId,
    organizacaoId,
    responsavelId,
    userId,
    nomeCliente,
    dataBase,
  } = params;

  const baseDate = dataBase ? new Date(dataBase) : new Date();
  const prazo = format(addDays(baseDate, prazoDias), "yyyy-MM-dd");
  const titulo = `${FASE_TASK_TITLES[fase] || `FASE ${fase}`} — ${nomeCliente}`;
  const descricao = FASE_TASK_DESCRIPTIONS[fase] || "";

  const prioridade = prazoDias <= 3 ? "urgente" : "normal";

  try {
    const { error } = await supabase.from("tarefas" as any).insert({
      organizacao_id: organizacaoId,
      processo_id: processoId,
      fase: String(fase),
      responsavel_id: responsavelId,
      titulo,
      descricao: `${descricao}\n\nPrazo: ${prazoDias} dia(s).`,
      data_vencimento: prazo,
      created_by: userId,
      prioridade,
      concluida: false,
    } as any);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Erro ao criar tarefa de fase:", err);
    return { success: false, error: err };
  }
}

/**
 * Creates a task for phase 4 (judicial) when bank response is silence or denied.
 */
export async function criarTarefaJudicial(params: {
  processoId: string;
  organizacaoId: string;
  responsavelId: string;
  userId: string;
  nomeCliente: string;
  motivo: "silencio" | "negado";
}) {
  const { processoId, organizacaoId, responsavelId, userId, nomeCliente, motivo } = params;

  const titulo = `PROTOCOLAR AÇÃO JUDICIAL — ${nomeCliente}`;
  const motivoTexto = motivo === "silencio"
    ? "O banco não respondeu à notificação extrajudicial dentro do prazo legal de 15 dias."
    : "O banco negou taxativamente o pedido de alongamento.";

  const descricao = `${motivoTexto}\n\nProtocolar ação judicial de obrigação de fazer em até 15 dias.\n\nFundamentação: MCR 2.6.4, Lei 13.340/2016, Súmula 298 do STJ.`;

  const prazo = format(addDays(new Date(), 15), "yyyy-MM-dd");

  try {
    const { error } = await supabase.from("tarefas" as any).insert({
      organizacao_id: organizacaoId,
      processo_id: processoId,
      fase: "4",
      responsavel_id: responsavelId,
      titulo,
      descricao,
      data_vencimento: prazo,
      created_by: userId,
      prioridade: "urgente",
      concluida: false,
    } as any);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Erro ao criar tarefa judicial:", err);
    return { success: false, error: err };
  }
}

// Legacy functions maintained for backward compatibility
export async function criarTarefaConferenciaLaudo(laudoId: string, userId: string, nomeCliente: string) {
  try {
    const { data: membro } = await supabase
      .from("membros")
      .select("organizacao_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!membro) return;

    const { data: posVendaMembros } = await supabase
      .from("membros")
      .select("user_id")
      .eq("organizacao_id", membro.organizacao_id)
      .eq("papel", "pos_venda" as any);

    let responsavelId = userId;
    if (posVendaMembros && posVendaMembros.length > 0) {
      responsavelId = posVendaMembros[0].user_id;
    }

    const prazo = format(addDays(new Date(), 2), "yyyy-MM-dd");

    await supabase.from("tarefas" as any).insert({
      organizacao_id: membro.organizacao_id,
      responsavel_id: responsavelId,
      titulo: `CONFERÊNCIA DE LAUDO — ${nomeCliente}`,
      descricao: `Conferir com o cliente se o laudo está correto ou precisa de correção.\n\nLaudo finalizado. Agendar contato com o cliente para validação.`,
      data_vencimento: prazo,
      created_by: userId,
      prioridade: "normal",
      nome_cliente: nomeCliente,
    } as any);
  } catch (err) {
    console.error("Erro ao criar tarefa de conferência:", err);
  }
}

export async function criarTarefaCorrecaoLaudo(laudoId: string, userId: string, nomeCliente: string) {
  try {
    const { data: membro } = await supabase
      .from("membros")
      .select("organizacao_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!membro) return;

    const { data: agronomos } = await supabase
      .from("membros")
      .select("user_id")
      .eq("organizacao_id", membro.organizacao_id)
      .in("papel", ["agronomo", "engenheiro_agronomo"] as any[]);

    let responsavelId = userId;
    if (agronomos && agronomos.length > 0) {
      responsavelId = agronomos[0].user_id;
    }

    const prazo = format(addDays(new Date(), 3), "yyyy-MM-dd");

    await supabase.from("tarefas" as any).insert({
      organizacao_id: membro.organizacao_id,
      responsavel_id: responsavelId,
      titulo: `CORREÇÃO DE LAUDO — ${nomeCliente}`,
      descricao: `O cliente solicitou correções no laudo. Revisar e atualizar conforme feedback.`,
      data_vencimento: prazo,
      created_by: userId,
      prioridade: "urgente",
      nome_cliente: nomeCliente,
    } as any);
  } catch (err) {
    console.error("Erro ao criar tarefa de correção:", err);
  }
}

export async function criarTarefaNotificacaoJuridica(userId: string, nomeCliente: string) {
  try {
    const { data: membro } = await supabase
      .from("membros")
      .select("organizacao_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!membro) return;

    const { data: advogados } = await supabase
      .from("membros")
      .select("user_id")
      .eq("organizacao_id", membro.organizacao_id)
      .in("papel", ["advogado", "assessor_juridico"] as any[]);

    let responsavelId = userId;
    if (advogados && advogados.length > 0) {
      responsavelId = advogados[0].user_id;
    }

    const prazo = format(addDays(new Date(), 5), "yyyy-MM-dd");

    await supabase.from("tarefas" as any).insert({
      organizacao_id: membro.organizacao_id,
      responsavel_id: responsavelId,
      titulo: `NOTIFICAÇÃO EXTRAJUDICIAL — ${nomeCliente}`,
      descricao: `Laudo aprovado pelo cliente. Preparar e enviar notificação extrajudicial ao banco.`,
      data_vencimento: prazo,
      created_by: userId,
      prioridade: "normal",
      nome_cliente: nomeCliente,
    } as any);
  } catch (err) {
    console.error("Erro ao criar tarefa jurídica:", err);
  }
}
