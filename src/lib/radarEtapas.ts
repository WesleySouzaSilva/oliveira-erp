import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normNome } from "@/lib/situacaoCliente";

/** Linha da configuração de etapas: por carteira, quem mapeia e quem protocola. */
export interface EtapaConfig {
  id: string;
  organizacao_id: string;
  carteira: string;
  mapeia: string | null;
  protocola: string | null;
}

/** Chave reservada: a pessoa responsável pelos laudos. */
export const CHAVE_LAUDOS = "__laudos__";

export const LAUDO_OPCOES = [
  { value: "nao_avaliado", label: "Laudo não avaliado" },
  { value: "precisa", label: "Precisa de laudo" },
  { value: "pronto", label: "Laudo pronto" },
  { value: "nao_precisa", label: "Não precisa de laudo" },
  { value: "nota_preliminar_pedida", label: "Nota técnica preliminar pedida" },
  { value: "nota_preliminar_entregue", label: "Nota técnica preliminar entregue" },
  { value: "laudo_completo_pedido", label: "Laudo completo pedido" },
  { value: "laudo_completo_entregue", label: "Laudo completo entregue" },
] as const;

export type LaudoStatus = (typeof LAUDO_OPCOES)[number]["value"];

export const labelLaudo = (v?: string | null) =>
  LAUDO_OPCOES.find((o) => o.value === (v || "nao_avaliado"))?.label ?? "Laudo não avaliado";

/** Situações de urgência: a nota preliminar saiu, o laudo completo ainda não. */
export const LAUDO_PRELIMINAR = ["nota_preliminar_pedida", "nota_preliminar_entregue"];

export const laudoCompletoPendente = (v?: string | null) =>
  v === "nota_preliminar_entregue" || v === "laudo_completo_pedido";

/** Dois nomes são da mesma pessoa quando um contém o outro (primeiro nome x nome completo). */
export function mesmaPessoa(a?: string | null, b?: string | null) {
  const x = normNome(a || "");
  const y = normNome(b || "");
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** Etapas (quem mapeia / quem protocola) a partir do responsável da carteira. */
export function etapasDe(responsavel: string | null | undefined, config: EtapaConfig[]) {
  const linha = config.find((c) => c.carteira !== CHAVE_LAUDOS && mesmaPessoa(responsavel, c.carteira));
  return { mapeia: linha?.mapeia ?? null, protocola: linha?.protocola ?? null };
}

export const responsavelLaudos = (config: EtapaConfig[]) =>
  config.find((c) => c.carteira === CHAVE_LAUDOS)?.mapeia ?? null;

export function useRadarEtapas() {
  const { user } = useAuth();
  const [config, setConfig] = useState<EtapaConfig[]>([]);
  const [meuNome, setMeuNome] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [cfg, perfil] = await Promise.all([
      supabase.from("radar_etapas_config").select("id, organizacao_id, carteira, mapeia, protocola").order("carteira"),
      user ? supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
    ]);
    setConfig(((cfg.data as any[]) || []) as EtapaConfig[]);
    setMeuNome(((perfil as any)?.data?.nome as string) || "");
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { config, meuNome, loading, reload: load };
}
