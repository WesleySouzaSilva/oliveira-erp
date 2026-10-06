import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * Subordinados DIRETOS do usuário logado: quem tem `profiles.lider_id = auth.uid()`.
 * Não varre a árvore (sem netos).
 *
 * ATENÇÃO: isto é filtro de TELA, não de banco. O RLS continua exatamente como
 * está — a query ainda traz o que o RLS permite; aqui só recortamos a exibição
 * para o coordenador ver apenas o time dele. A trava de verdade de `lider_id`
 * é o trigger em public.profiles (só admin altera).
 */
export function useSubordinados() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["subordinados", user?.id],
    enabled: !authLoading && !!user?.id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase.from("profiles_publico").select("id").eq("lider_id", user!.id);
      return (data || []).map((p: any) => p.id as string);
    },
  });
  return { subordinadoIds: data ?? [], loading: authLoading || (!!user?.id && isLoading) };
}

export const SEM_LIDERADOS_MSG =
  "Nenhuma pessoa liderada por você ainda. Um administrador define isso em Gestão de Pessoas.";

/**
 * Recorte de equipe para o papel `coordenador`:
 * - admin: vê tudo (`enabled: false`).
 * - coordenador: vê apenas os liderados diretos + ele mesmo.
 * - demais papéis: comportamento inalterado.
 */
export function useRecorteEquipe() {
  const { papel, isAdmin, loading: permLoading } = usePermissions();
  const { subordinadoIds, loading } = useSubordinados();
  const { user } = useAuth();
  const selfId = user?.id ?? null;

  const enabled = !permLoading && !isAdmin && papel === "coordenador";
  const permitidos = new Set<string>([...subordinadoIds, ...(selfId ? [selfId] : [])]);

  return {
    enabled,
    loading: loading || permLoading,
    subordinadoIds,
    selfId,
    semLiderados: enabled && subordinadoIds.length === 0,
    /** true quando o registro daquele usuário deve aparecer na tela. */
    permite: (uid?: string | null) => (!enabled ? true : !!uid && permitidos.has(uid)),
  };
}
