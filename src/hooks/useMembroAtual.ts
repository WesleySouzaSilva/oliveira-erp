import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";

/**
 * Vínculo(s) do usuário logado em `membros`, numa única consulta compartilhada.
 * Substitui as leituras avulsas de "organização / papel / is_ceo / é interno?"
 * que cada gancho fazia por conta própria (etapa 1B).
 */
export interface MembroAtual {
  /** Primeiro vínculo (mais antigo), o mesmo critério usado antes. */
  principal: {
    id: string;
    organizacao_id: string;
    papel: string;
    permission_group_id: string | null;
  } | null;
  /** Algum vínculo do usuário tem is_ceo = true. */
  isCeo: boolean;
}

export const MEMBRO_ATUAL_KEY = "membro-atual";

async function carregar(userId: string): Promise<MembroAtual> {
  const { data, error } = await (supabase as any)
    .from("membros")
    .select("id, organizacao_id, papel, permission_group_id, is_ceo")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data as any[]) || [];
  const p = rows[0];
  return {
    principal: p
      ? { id: p.id, organizacao_id: p.organizacao_id, papel: p.papel, permission_group_id: p.permission_group_id ?? null }
      : null,
    isCeo: rows.some((r) => r.is_ceo === true),
  };
}

/** Leitura com cache de 5 min; chamadas simultâneas viram uma só requisição. */
export function buscarMembroAtual(userId: string): Promise<MembroAtual> {
  return queryClient.fetchQuery({
    queryKey: [MEMBRO_ATUAL_KEY, userId],
    queryFn: () => carregar(userId),
    staleTime: 1000 * 60 * 5,
  });
}
