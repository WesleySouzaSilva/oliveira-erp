import { supabase } from "@/integrations/supabase/client";

export type SituacaoCliente = "ativo" | "encerrado" | "rescindido" | "fora_do_escopo";

export const SITUACOES: { value: SituacaoCliente; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "encerrado", label: "Encerrado" },
  { value: "rescindido", label: "Rescindido" },
  { value: "fora_do_escopo", label: "Fora do escopo" },
];

export const labelSituacao = (v?: string | null) =>
  SITUACOES.find((s) => s.value === (v || "ativo"))?.label ?? "Ativo";

export const situacaoClasses = (v?: string | null) => {
  switch (v) {
    case "encerrado":
      return "bg-muted text-muted-foreground";
    case "rescindido":
      return "bg-destructive/10 text-destructive";
    case "fora_do_escopo":
      return "bg-amber-500/10 text-amber-700";
    default:
      return "bg-emerald-500/10 text-emerald-700";
  }
};

/** Normaliza nome para comparação entre bases ligadas por nome. */
export const normNome = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Grava a situação do cliente registrando quem alterou e quando.
 * Motivo é obrigatório para qualquer situação diferente de "ativo".
 */
export async function salvarSituacaoCliente(
  clienteId: string,
  situacao: SituacaoCliente,
  motivo: string | null,
  userId: string | null,
) {
  if (!(motivo || "").trim()) {
    throw new Error("Informe o motivo da mudança de situação.");
  }
  const { error } = await supabase
    .from("clientes")
    .update({
      situacao,
      situacao_motivo: situacao === "ativo" ? (motivo || "").trim() || null : (motivo || "").trim(),
      situacao_alterada_por: userId,
      situacao_alterada_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", clienteId);
  if (error) throw error;
}
