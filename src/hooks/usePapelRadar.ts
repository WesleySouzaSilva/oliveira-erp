import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";

/**
 * Função da pessoa no radar de vencimentos (fase 1 dos papéis).
 * - admin: Willian — faz tudo, inclusive desfazer
 * - protocolo: Vitoria — mapeia e marca "Protocolado"
 * - mapeamento: Maycon e Fernanda — conferem, digitam, laudo e "pronta para protocolar"
 * - laudos: só o campo de laudo
 * - comercial: cadastro no fechamento
 */
export type PapelRadar = "admin" | "protocolo" | "mapeamento" | "laudos" | "comercial" | "outro";

export function usePapelRadar() {
  const { user } = useAuth();
  const { isAdmin, orgId, loading: loadingOrg } = useOrgMembers() as any;
  const [funcao, setFuncao] = useState<PapelRadar | null>(null);

  useEffect(() => {
    let cancelado = false;
    if (!user || !orgId) {
      setFuncao(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("radar_funcoes")
        .select("funcao")
        .eq("user_id", user.id)
        .eq("organizacao_id", orgId)
        .maybeSingle();
      if (!cancelado) setFuncao(((data as any)?.funcao as PapelRadar) ?? "outro");
    })();
    return () => {
      cancelado = true;
    };
  }, [user, orgId]);

  const papel: PapelRadar = isAdmin ? "admin" : funcao ?? "outro";

  return {
    papel,
    isAdmin: !!isAdmin,
    loading: !!loadingOrg || (!isAdmin && funcao === null),
    /** Marcar "Protocolado": só quem protocola e o administrador. */
    podeProtocolar: !!isAdmin || papel === "protocolo",
    /** Situação do cliente, responsável de carteira e dispensa no radar: só o administrador. */
    podeGerirCliente: !!isAdmin,
  };
}
