import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Portão REAL do item "Códigos dos Tribunais": quem tem credencial liberada
 * (ou é custodiante/admin) vê o item. Consulta a função leve do banco
 * `tem_codigos_tribunais()` uma vez por sessão.
 * Em erro/timeout: fail-open (mostra o item) — a tela em si só exibe o que o
 * servidor liberar.
 */
export function useTemCodigosTribunais(): boolean {
  const { data } = useQuery({
    queryKey: ["tem-codigos-tribunais"],
    staleTime: 1000 * 60 * 60, // 1h — a lista muda raramente
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
    queryFn: async () => {
      // Consulta leve ao banco (antes: a função dos tribunais, 1 a 2 s).
      try {
        const { data, error } = await (supabase as any).rpc("tem_codigos_tribunais");
        if (error) return true; // fail-open
        return data === true;
      } catch {
        return true; // fail-open
      }
    },
  });

  // Enquanto carrega, mantém visível (fail-open) para não "piscar" escondendo.
  return data === undefined ? true : data;
}
