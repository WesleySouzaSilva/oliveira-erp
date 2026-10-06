import { invalidarMembrosOrg } from "@/hooks/useOrgMembers";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PermissionGroup {
  id: string;
  organizacao_id: string;
  nome: string;
  descricao: string | null;
  modulos: string[];
  created_at: string;
  updated_at: string;
}

export function usePermissionGroups(orgId: string | null | undefined) {
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!orgId) {
      setGroups([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("permission_groups")
      .select("*")
      .eq("organizacao_id", orgId)
      .order("nome", { ascending: true });
    setLoading(false);
    if (!error && data) setGroups(data as any);
  }, [orgId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const create = useCallback(
    async (nome: string, modulos: string[], descricao?: string | null) => {
      if (!orgId) throw new Error("Organização não definida");
      const { data, error } = await supabase
        .from("permission_groups")
        .insert({ organizacao_id: orgId, nome, descricao: descricao ?? null, modulos })
        .select()
        .single(); invalidarMembrosOrg();
      if (error) throw error;
      await refetch();
      return data as PermissionGroup;
    },
    [orgId, refetch],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<PermissionGroup, "nome" | "descricao" | "modulos">>) => {
      const { error } = await supabase.from("permission_groups").update(patch).eq("id", id); invalidarMembrosOrg();
      if (error) throw error;
      await refetch();
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("permission_groups").delete().eq("id", id); invalidarMembrosOrg();
      if (error) throw error;
      await refetch();
    },
    [refetch],
  );

  const assignToMember = useCallback(
    async (membroId: string, groupId: string | null) => {
      const { error } = await supabase
        .from("membros")
        .update({ permission_group_id: groupId })
        .eq("id", membroId); invalidarMembrosOrg();
      if (error) throw error;
    },
    [],
  );

  return { groups, loading, refetch, create, update, remove, assignToMember };
}