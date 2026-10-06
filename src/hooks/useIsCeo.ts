import { useQuery } from "@tanstack/react-query";
import { buscarMembroAtual } from "@/hooks/useMembroAtual";
import { useAuth } from "@/contexts/AuthContext";
import { useVerComoAlvo } from "@/hooks/useVerComoAlvo";

/**
 * CEO REAL do usuário logado (ignora o modo "ver como").
 * O marcador `is_ceo` vive em `membros` e a fonte da verdade da segurança
 * é a função `public.is_ceo()` + RLS — este hook serve só para o gate de UI.
 * Cache compartilhado: uma consulta por sessão (5 min), não uma por componente.
 */
export function useIsCeoReal() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["is-ceo", user?.id],
    enabled: !authLoading && !!user?.id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    queryFn: async () => (await buscarMembroAtual(user!.id)).isCeo,
  });
  const loading = authLoading || (!!user?.id && isLoading);
  return { isCeo: !!data, loading };
}

/** Para a interface: no modo "ver como", responde pela pessoa vista. */
export function useIsCeo() {
  const real = useIsCeoReal();
  const { alvo, info, loading } = useVerComoAlvo();
  if (alvo) return { isCeo: !!info?.is_ceo, loading };
  return real;
}
