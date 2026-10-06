import { supabase } from "@/integrations/supabase/client";

/**
 * Notifica todos os membros de uma organização (exceto o autor) sobre um evento.
 * Usa a tabela `notificacoes_sistema` (aparece no sino do header).
 */
export async function notifyOrg(params: {
  organizacaoId: string | null | undefined;
  authorUserId: string;
  mensagem: string;
  tipo?: "info" | "success" | "warning" | "error";
  processoId?: string | null;
}) {
  const { organizacaoId, authorUserId, mensagem, tipo = "info", processoId = null } = params;
  if (!organizacaoId) return;

  const { data: membros } = await supabase
    .from("membros")
    .select("user_id")
    .eq("organizacao_id", organizacaoId);

  const destinatarios = (membros || [])
    .map((m) => m.user_id)
    .filter((uid) => uid && uid !== authorUserId);

  if (destinatarios.length === 0) return;

  const rows = destinatarios.map((uid) => ({
    user_id: uid,
    mensagem,
    tipo,
    processo_id: processoId,
  }));

  await supabase.from("notificacoes_sistema").insert(rows as any);
}
