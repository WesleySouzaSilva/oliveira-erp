import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Quantas operações ainda estão sem titular. Serve para o menu esconder a
 * lista de vínculo quando não houver mais nada para decidir.
 * Cache de 5 min: não recarrega a cada troca de tela.
 */
export function useOperacoesSemTitular() {
  const { data } = useQuery({
    queryKey: ["operacoes-sem-titular"],
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { count } = await supabase
        .from("operacoes_credito")
        .select("id", { count: "exact", head: true })
        .is("cliente_id", null)
        .is("deleted_at", null);
      return count ?? 0;
    },
  });
  return data ?? 0;
}
