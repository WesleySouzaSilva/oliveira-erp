import { supabase } from "@/integrations/supabase/client";

export type WorkflowFase = "cadastro" | "onboarding" | "contrato" | "checklist" | "laudo";

export const FASE_META: Record<WorkflowFase, { label: string; descricao: string; cor: string }> = {
  cadastro:   { label: "Cadastro + Relatório", descricao: "Comercial cadastra cliente e gera relatório da venda", cor: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  onboarding: { label: "Onboarding",            descricao: "Pós-venda realiza onboarding completo",                cor: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  contrato:   { label: "Contrato (banco)",      descricao: "Solicitar contrato e docs bancários",                  cor: "bg-purple-500/15 text-purple-700 border-purple-500/30" },
  checklist:  { label: "Checklist documental",  descricao: "Validar documentos do cliente",                         cor: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30" },
  laudo:      { label: "Laudo técnico",         descricao: "Abrir e produzir o laudo",                              cor: "bg-primary/15 text-primary border-primary/30" },
};

export async function getCurrentOrgId(userId: string): Promise<string | null> {
  const { data } = await supabase.from("membros").select("organizacao_id").eq("user_id", userId).limit(1).maybeSingle();
  return (data as any)?.organizacao_id ?? null;
}

export async function iniciarWorkflowAposVenda(params: {
  userId: string;
  clienteNome: string;
  clienteId?: string | null;
  atendimentoId?: string | null;
  leadId?: string | null;
}) {
  const orgId = await getCurrentOrgId(params.userId);
  if (!orgId) throw new Error("Você precisa pertencer a uma organização.");

  // Evita duplicidade: se já existe uma tarefa de cadastro ativa para este cliente, retorna.
  if (params.clienteId) {
    const { data: existing } = await supabase
      .from("workflow_tarefas")
      .select("id")
      .eq("fase", "cadastro")
      .eq("cliente_id", params.clienteId)
      .eq("concluida", false)
      .limit(1)
      .maybeSingle();
    if (existing) return (existing as any).id as string;
  }

  const { data, error } = await supabase
    .from("workflow_tarefas")
    .insert({
      organizacao_id: orgId,
      fase: "cadastro",
      titulo: `Cadastrar cliente + Relatório da venda — ${params.clienteNome}`,
      descricao:
        "Comercial: criar/atualizar o cadastro do cliente e gravar o relatório de venda no atendimento. Ao concluir, o onboarding é gerado automaticamente para o pós-venda.",
      cliente_id: params.clienteId ?? null,
      cliente_nome: params.clienteNome,
      atendimento_id: params.atendimentoId ?? null,
      lead_id: params.leadId ?? null,
      responsavel_id: params.userId,
      created_by: params.userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id as string;
}

export async function concluirTarefa(tarefaId: string) {
  const { error } = await supabase
    .from("workflow_tarefas")
    .update({ concluida: true })
    .eq("id", tarefaId);
  if (error) throw error;
}

/** Marca como concluída a tarefa de onboarding (se existir) vinculada ao cliente. */
export async function concluirOnboardingNoWorkflow(clienteNome: string, clienteId?: string | null) {
  let q = supabase
    .from("workflow_tarefas")
    .update({ concluida: true })
    .eq("fase", "onboarding")
    .eq("concluida", false);
  q = clienteId ? q.eq("cliente_id", clienteId) : q.eq("cliente_nome", clienteNome);
  await q;
}