import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CardMeta, Checklist, ChecklistTemplate } from "../lib/types";

export function useCardMeta(processoId: string | null, orgId: string | null) {
  return useQuery({
    queryKey: ["kanban", "card-meta", processoId],
    enabled: !!processoId,
    queryFn: async (): Promise<CardMeta | null> => {
      const { data } = await supabase
        .from("kanban_card_meta")
        .select("processo_id, descricao, due_date, due_origem, sincroniza_prazo_15d")
        .eq("processo_id", processoId!)
        .maybeSingle();
      if (data) return data as CardMeta;
      // Cria meta default se não existir
      if (!orgId) return null;
      const { data: created } = await supabase
        .from("kanban_card_meta")
        .insert({
          processo_id: processoId!,
          organizacao_id: orgId,
          sincroniza_prazo_15d: true,
          due_origem: "manual",
        })
        .select("processo_id, descricao, due_date, due_origem, sincroniza_prazo_15d")
        .maybeSingle();
      return (created as CardMeta) ?? null;
    },
  });
}

export function useUpdateCardMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { processoId: string; patch: Partial<CardMeta> }) => {
      const { error } = await supabase
        .from("kanban_card_meta")
        .update(args.patch as any)
        .eq("processo_id", args.processoId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kanban", "card-meta", vars.processoId] });
    },
  });
}

export function useChecklists(processoId: string | null) {
  return useQuery({
    queryKey: ["kanban", "checklists", processoId],
    enabled: !!processoId,
    queryFn: async (): Promise<Checklist[]> => {
      const { data: lists } = await supabase
        .from("kanban_checklists")
        .select("id, titulo, ordem")
        .eq("processo_id", processoId!)
        .order("ordem", { ascending: true });
      if (!lists?.length) return [];
      const { data: itens } = await supabase
        .from("kanban_checklist_itens")
        .select("id, checklist_id, texto, concluido, ordem")
        .in(
          "checklist_id",
          lists.map((l) => l.id as string),
        )
        .order("ordem", { ascending: true });
      const byList = new Map<string, any[]>();
      (itens || []).forEach((it: any) => {
        const arr = byList.get(it.checklist_id) ?? [];
        arr.push(it);
        byList.set(it.checklist_id, arr);
      });
      return (lists as any[]).map((l) => ({
        id: l.id,
        titulo: l.titulo,
        ordem: l.ordem,
        itens: (byList.get(l.id) ?? []).map((i: any) => ({
          id: i.id,
          texto: i.texto,
          concluido: i.concluido,
          ordem: i.ordem,
        })),
      }));
    },
  });
}

export function useChecklistTemplates(orgId: string | null) {
  return useQuery({
    queryKey: ["kanban", "chk-templates", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<ChecklistTemplate[]> => {
      const { data } = await supabase
        .from("kanban_checklist_templates")
        .select("id, nome, descricao, itens");
      return ((data as any[]) ?? []).map((t) => ({
        id: t.id,
        nome: t.nome,
        descricao: t.descricao,
        itens: Array.isArray(t.itens) ? t.itens : [],
      }));
    },
  });
}

export function useApplyChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      processoId: string;
      orgId: string;
      template: ChecklistTemplate;
    }) => {
      const { data: list, error } = await supabase
        .from("kanban_checklists")
        .insert({
          processo_id: args.processoId,
          organizacao_id: args.orgId,
          template_id: args.template.id,
          titulo: args.template.nome,
        })
        .select("id")
        .single();
      if (error || !list) throw error ?? new Error("Falha ao criar checklist");
      const itens = args.template.itens.map((it, i) => ({
        checklist_id: list.id as string,
        organizacao_id: args.orgId,
        texto: it.texto,
        ordem: it.ordem ?? i + 1,
      }));
      if (itens.length) {
        const { error: e2 } = await supabase.from("kanban_checklist_itens").insert(itens);
        if (e2) throw e2;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kanban", "checklists", vars.processoId] });
    },
  });
}

export function useToggleChecklistItem(processoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { itemId: string; concluido: boolean }) => {
      const { error } = await supabase
        .from("kanban_checklist_itens")
        .update({
          concluido: args.concluido,
          concluido_em: args.concluido ? new Date().toISOString() : null,
        })
        .eq("id", args.itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban", "checklists", processoId] });
    },
  });
}

export function useDeleteChecklist(processoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checklistId: string) => {
      const { error } = await supabase
        .from("kanban_checklists")
        .delete()
        .eq("id", checklistId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban", "checklists", processoId] });
    },
  });
}