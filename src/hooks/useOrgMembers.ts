import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buscarMembroAtual, MEMBRO_ATUAL_KEY } from "@/hooks/useMembroAtual";

export interface OrgMember {
  id: string; // membro id
  user_id: string;
  papel: string;
  nome: string | null;
  permission_group_id?: string | null;
  areas?: string[] | null;
}

interface OrgMembersData {
  members: OrgMember[];
  orgId: string | null;
  isAdmin: boolean;
  currentMemberGroupModulos: string[] | null;
}

const VAZIO: OrgMembersData = { members: [], orgId: null, isAdmin: false, currentMemberGroupModulos: null };

/** Chave compartilhada: todos os componentes usam o mesmo cache. */
export const ORG_MEMBERS_KEY = "org-members";

/** Chame depois de alterar membros, papéis, grupos ou nomes. */
export function invalidarMembrosOrg() {
  const qc = queryClient;
  qc.invalidateQueries({ queryKey: [MEMBRO_ATUAL_KEY] });
  qc.invalidateQueries({ queryKey: [ORG_MEMBERS_KEY] });
  qc.invalidateQueries({ queryKey: ["is-ceo"] });
  qc.invalidateQueries({ queryKey: ["subordinados"] });
  qc.invalidateQueries({ queryKey: ["portal-user"] });
  qc.invalidateQueries({ queryKey: ["tem-codigos-tribunais"] });
}

async function carregar(userId: string): Promise<OrgMembersData> {
  // Vínculo do usuário (cache compartilhado), com tolerância a falhas transitórias.
  let membro: { organizacao_id: string; papel: string; permission_group_id?: string | null } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const m = await buscarMembroAtual(userId);
      if (m.principal) { membro = m.principal; break; }
    } catch { /* tenta de novo */ }
    queryClient.removeQueries({ queryKey: [MEMBRO_ATUAL_KEY, userId] });
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
  if (!membro) return VAZIO;

  const groupId = membro.permission_group_id;
  const [grpRes, membrosRes] = await Promise.all([
    groupId
      ? supabase.from("permission_groups").select("modulos").eq("id", groupId).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.from("membros").select("id, user_id, papel, permission_group_id, areas").eq("organizacao_id", membro.organizacao_id),
  ]);
  const currentMemberGroupModulos = groupId ? (((grpRes.data as any)?.modulos as string[]) ?? []) : null;

  let members: OrgMember[] = [];
  const membros = membrosRes.data || [];
  if (membros.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles_publico")
      .select("id, nome")
      .in("id", membros.map((m: any) => m.user_id));
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.nome]));
    members = membros.map((m: any) => ({ ...m, nome: profileMap.get(m.user_id) || null }));
  }

  return { members, orgId: membro.organizacao_id, isAdmin: membro.papel === "admin", currentMemberGroupModulos };
}

export function useOrgMembers() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: [ORG_MEMBERS_KEY, user?.id],
    queryFn: () => carregar(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
  const d = data ?? VAZIO;
  return {
    members: d.members,
    orgId: d.orgId,
    isAdmin: d.isAdmin,
    loading: !!user?.id && isLoading,
    currentMemberGroupModulos: d.currentMemberGroupModulos,
  };
}
