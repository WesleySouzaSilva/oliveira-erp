import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { lerTudo } from "@/lib/lerTudo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import type { KanbanCardData, KanbanColumnDef } from "../lib/types";

async function getOrgId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("membros")
    .select("organizacao_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (data?.organizacao_id as string) ?? null;
}

export function useOrgId() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    getOrgId(user.id).then((id) => {
      if (active) setOrgId(id);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);
  return orgId;
}

export function useKanbanColumns(orgId: string | null) {
  return useQuery({
    queryKey: ["kanban", "colunas", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<KanbanColumnDef[]> => {
      // Garante seed idempotente
      await supabase.rpc("kanban_seed_default_columns", { _org_id: orgId! });
      const { data, error } = await supabase
        .from("kanban_colunas")
        .select("id, slug, titulo, cor, ordem, legacy_fase, arquivada")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as KanbanColumnDef[];
    },
  });
}

export function useKanbanCards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["kanban", "cards", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<KanbanCardData[]> => {
      const { data: processos } = await lerTudo(() => supabase
        .from("processos")
        .select(
          "id, fase_atual, laudo_id, created_at, dados_fase2, datas_fases, kanban_coluna_id, kanban_ordem",
        )
        .order("created_at", { ascending: false }));
      if (!processos) return [];

      const laudoIds = [...new Set(processos.map((p: any) => p.laudo_id).filter(Boolean))];
      const { data: laudos } = laudoIds.length
        ? await supabase.from("laudos").select("id, dados_etapa1").in("id", laudoIds)
        : { data: [] as any[] };
      const laudoMap = new Map((laudos || []).map((l: any) => [l.id, l]));

      const { data: contratosData } = await lerTudo(() => supabase
        .from("contratos_vencimentos")
        .select("nome_cliente, banco, valor_total_operacao"));
      const contratoMap = new Map(
        (contratosData || []).map((c: any) => [
          (c.nome_cliente as string | null)?.toLowerCase(),
          c,
        ]),
      );

      return (processos as any[]).map((p) => {
        const laudo: any = laudoMap.get(p.laudo_id);
        const d1 = laudo?.dados_etapa1 as Record<string, any> | null;
        const f2 = p.dados_fase2 as Record<string, any> | null;
        const datas = p.datas_fases as Record<string, string> | null;

        const produtor = d1?.nome || "Sem nome";
        const contrato: any = contratoMap.get(produtor.toLowerCase());

        const faseKey = `fase${p.fase_atual}_inicio`;
        const faseStart = datas?.[faseKey] ? new Date(datas[faseKey]) : new Date(p.created_at);
        const diasNaFase = Math.floor(
          (Date.now() - faseStart.getTime()) / (1000 * 60 * 60 * 24),
        );

        let prazoRestante: number | null = null;
        if (p.fase_atual === "2" || p.fase_atual === "3") {
          const dataEnvio = f2?.data_envio;
          if (dataEnvio) {
            const envio = new Date(dataEnvio);
            const prazo = new Date(envio.getTime() + 15 * 24 * 60 * 60 * 1000);
            prazoRestante = Math.ceil(
              (prazo.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
          }
        }

        return {
          id: p.id,
          produtor,
          banco: f2?.banco || d1?.banco || contrato?.banco || "—",
          valor: contrato?.valor_total_operacao || null,
          faseAtual: p.fase_atual,
          kanbanColunaId: p.kanban_coluna_id ?? null,
          kanbanOrdem: p.kanban_ordem ?? null,
          diasNaFase,
          prazoRestante,
          laudoId: p.laudo_id,
        } as KanbanCardData;
      });
    },
  });
}

export function useMoveCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      cardId: string;
      kanbanColunaId: string;
      legacyFase: string | null;
      kanbanOrdem: number;
    }) => {
      const patch: Record<string, any> = {
        kanban_coluna_id: args.kanbanColunaId,
        kanban_ordem: args.kanbanOrdem,
      };
      if (args.legacyFase) {
        patch.fase_atual = args.legacyFase as any;
        const datas: Record<string, string> = {};
        datas[`fase${args.legacyFase}_inicio`] = new Date().toISOString();
        patch.datas_fases = datas;
      }
      const { error } = await supabase.from("processos").update(patch).eq("id", args.cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban", "cards"] });
    },
  });
}

export function useColumnMutations(orgId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["kanban", "colunas", orgId] });

  const create = useMutation({
    mutationFn: async (args: { titulo: string; cor: string }) => {
      if (!orgId) throw new Error("Sem organização");
      const slug = `custom-${Date.now()}`;
      const { data: max } = await supabase
        .from("kanban_colunas")
        .select("ordem")
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();
      const ordem = ((max?.ordem as number) ?? 0) + 1;
      const { error } = await supabase
        .from("kanban_colunas")
        .insert({ organizacao_id: orgId, slug, titulo: args.titulo, cor: args.cor, ordem });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (args: { id: string; patch: Partial<KanbanColumnDef> }) => {
      const { error } = await supabase
        .from("kanban_colunas")
        .update(args.patch as any)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (ordered: KanbanColumnDef[]) => {
      await Promise.all(
        ordered.map((c, i) =>
          supabase.from("kanban_colunas").update({ ordem: i + 1 }).eq("id", c.id),
        ),
      );
    },
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("kanban_colunas")
        .update({ arquivada: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, reorder, archive };
}