import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Etiqueta, CardMembro } from "../lib/types";

// =========== Catálogo de etiquetas da organização ===========
export function useEtiquetas(orgId: string | null) {
  return useQuery({
    queryKey: ["kanban", "etiquetas", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Etiqueta[]> => {
      const { data, error } = await supabase
        .from("kanban_etiquetas")
        .select("id, nome, cor, categoria")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Etiqueta[];
    },
  });
}

export function useEtiquetaMutations(orgId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["kanban", "etiquetas", orgId] });
    qc.invalidateQueries({ queryKey: ["kanban", "card-etiquetas"] });
  };

  const create = useMutation({
    mutationFn: async (args: { nome: string; cor: string; categoria?: Etiqueta["categoria"] }) => {
      if (!orgId) throw new Error("Sem organização");
      const { error } = await supabase.from("kanban_etiquetas").insert({
        organizacao_id: orgId,
        nome: args.nome,
        cor: args.cor,
        categoria: args.categoria ?? "livre",
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (args: { id: string; patch: Partial<Etiqueta> }) => {
      const { error } = await supabase
        .from("kanban_etiquetas")
        .update(args.patch as any)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kanban_etiquetas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// =========== Etiquetas atribuídas a cada card ===========
export interface CardEtiquetaLink {
  processo_id: string;
  etiqueta_id: string;
}

export function useAllCardEtiquetas(orgId: string | null) {
  return useQuery({
    queryKey: ["kanban", "card-etiquetas", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Map<string, string[]>> => {
      const { data } = await supabase
        .from("kanban_card_etiquetas")
        .select("processo_id, etiqueta_id");
      const map = new Map<string, string[]>();
      (data ?? []).forEach((r: any) => {
        const arr = map.get(r.processo_id) ?? [];
        arr.push(r.etiqueta_id);
        map.set(r.processo_id, arr);
      });
      return map;
    },
  });
}

export function useCardEtiquetaMutations(orgId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["kanban", "card-etiquetas", orgId] });

  const add = useMutation({
    mutationFn: async (args: { processoId: string; etiquetaId: string }) => {
      if (!orgId) throw new Error("Sem organização");
      const { error } = await supabase.from("kanban_card_etiquetas").insert({
        processo_id: args.processoId,
        etiqueta_id: args.etiquetaId,
        organizacao_id: orgId,
      });
      if (error && !String(error.message).includes("duplicate")) throw error;
      if (user?.id) {
        const { data: et } = await supabase
          .from("kanban_etiquetas").select("nome").eq("id", args.etiquetaId).maybeSingle();
        await supabase.from("kanban_card_atividades").insert({
          processo_id: args.processoId, organizacao_id: orgId, autor_id: user.id,
          tipo: "adicionou_etiqueta", dados: { nome: (et as any)?.nome ?? null, etiqueta_id: args.etiquetaId },
        });
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (args: { processoId: string; etiquetaId: string }) => {
      const { error } = await supabase
        .from("kanban_card_etiquetas")
        .delete()
        .eq("processo_id", args.processoId)
        .eq("etiqueta_id", args.etiquetaId);
      if (error) throw error;
      if (user?.id && orgId) {
        const { data: et } = await supabase
          .from("kanban_etiquetas").select("nome").eq("id", args.etiquetaId).maybeSingle();
        await supabase.from("kanban_card_atividades").insert({
          processo_id: args.processoId, organizacao_id: orgId, autor_id: user.id,
          tipo: "removeu_etiqueta", dados: { nome: (et as any)?.nome ?? null, etiqueta_id: args.etiquetaId },
        });
      }
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}

// =========== Membros atribuídos a cada card ===========
export function useAllCardMembros(orgId: string | null) {
  return useQuery({
    queryKey: ["kanban", "card-membros", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Map<string, string[]>> => {
      const { data } = await supabase
        .from("kanban_card_membros")
        .select("processo_id, user_id");
      const map = new Map<string, string[]>();
      (data ?? []).forEach((r: any) => {
        const arr = map.get(r.processo_id) ?? [];
        arr.push(r.user_id);
        map.set(r.processo_id, arr);
      });
      return map;
    },
  });
}

export function useCardMembroMutations(orgId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["kanban", "card-membros", orgId] });

  const add = useMutation({
    mutationFn: async (args: { processoId: string; userId: string }) => {
      if (!orgId) throw new Error("Sem organização");
      const { error } = await supabase.from("kanban_card_membros").insert({
        processo_id: args.processoId,
        user_id: args.userId,
        organizacao_id: orgId,
      });
      if (error && !String(error.message).includes("duplicate")) throw error;
      if (user?.id) {
        const { data: p } = await supabase.from("profiles_publico").select("nome").eq("id", args.userId).maybeSingle();
        await supabase.from("kanban_card_atividades").insert({
          processo_id: args.processoId, organizacao_id: orgId, autor_id: user.id,
          tipo: "adicionou_membro", dados: { nome: (p as any)?.nome ?? null, user_id: args.userId },
        });
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (args: { processoId: string; userId: string }) => {
      const { error } = await supabase
        .from("kanban_card_membros")
        .delete()
        .eq("processo_id", args.processoId)
        .eq("user_id", args.userId);
      if (error) throw error;
      if (user?.id && orgId) {
        const { data: p } = await supabase.from("profiles_publico").select("nome").eq("id", args.userId).maybeSingle();
        await supabase.from("kanban_card_atividades").insert({
          processo_id: args.processoId, organizacao_id: orgId, autor_id: user.id,
          tipo: "removeu_membro", dados: { nome: (p as any)?.nome ?? null, user_id: args.userId },
        });
      }
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}