import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buscarMembroAtual } from "@/hooks/useMembroAtual";

export type PortalStatus =
  | "loading"
  | "interno"
  | "portal_empresa"
  | "portal_cliente"
  | "nenhum";

export interface PortalInfo {
  status: PortalStatus;
  empresaId: string | null;
  clienteId: string | null;
  organizacaoId: string | null;
}

/** Retrocompat: qualquer usuário externo do portal (empresa ou cliente). */
export function isPortalStatus(s: PortalStatus): boolean {
  return s === "portal_empresa" || s === "portal_cliente";
}

/**
 * Detecta o tipo de usuário logado:
 * - "interno": tem linha em `membros` → vai para o app interno
 * - "portal": tem linha ativa em `empresa_portal_usuarios` (e não é interno) → vai para /portal
 * - "nenhum": logado mas sem nenhum vínculo (primeiro acesso ou conta órfã)
 */
const NENHUM: PortalInfo = { status: "nenhum", empresaId: null, clienteId: null, organizacaoId: null };

async function detectar(userId: string): Promise<PortalInfo> {
  const m = await buscarMembroAtual(userId);
  if (m.principal) return { status: "interno", empresaId: null, clienteId: null, organizacaoId: null };
  const { data: pe } = await (supabase as any)
    .from("empresa_portal_usuarios").select("empresa_id, organizacao_id, ativo")
    .eq("user_id", userId).eq("ativo", true).maybeSingle();
  if (pe) return { status: "portal_empresa", empresaId: pe.empresa_id, clienteId: null, organizacaoId: pe.organizacao_id };
  const { data: pc } = await (supabase as any)
    .from("cliente_portal_usuarios").select("cliente_id, organizacao_id, ativo")
    .eq("user_id", userId).eq("ativo", true).maybeSingle();
  if (pc) return { status: "portal_cliente", empresaId: null, clienteId: pc.cliente_id, organizacaoId: pc.organizacao_id };
  return NENHUM;
}

/**
 * Detecta o tipo de usuário logado (interno, portal empresa, portal cliente ou nenhum).
 * Cache compartilhado de 5 min: não repete a consulta a cada troca de tela.
 */
export function usePortalUser(): PortalInfo {
  const { user, loading } = useAuth();
  const { data } = useQuery({
    queryKey: ["portal-user", user?.id],
    enabled: !loading && !!user?.id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    queryFn: () => detectar(user!.id),
  });
  if (loading) return { status: "loading", empresaId: null, clienteId: null, organizacaoId: null };
  if (!user) return NENHUM;
  return data ?? { status: "loading", empresaId: null, clienteId: null, organizacaoId: null };
}
