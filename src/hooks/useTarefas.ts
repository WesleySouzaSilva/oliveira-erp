import { lerTudo } from "@/lib/lerTudo";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Tarefa {
  id: string;
  organizacao_id: string;
  processo_id: string | null;
  fase: string | null;
  responsavel_id: string;
  titulo: string;
  descricao: string | null;
  data_vencimento: string;
  concluida: boolean;
  created_by: string;
  created_at: string;
}

export function useTarefas(options?: { processoId?: string; responsavelId?: string }) {
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    // Lê em blocos para não cortar a lista no teto da API.
    const montar = () => {
      let query: any = supabase
        .from("tarefas" as any)
        .select("*")
        .order("data_vencimento", { ascending: true });
      if (options?.processoId) query = query.eq("processo_id", options.processoId);
      if (options?.responsavelId) query = query.eq("responsavel_id", options.responsavelId);
      return query;
    };
    const { data } = await lerTudo(montar);
    if (data) setTarefas(data as unknown as Tarefa[]);
    setLoading(false);
  }, [user, options?.processoId, options?.responsavelId]);

  useEffect(() => { load(); }, [load]);

  const toggleConcluida = async (id: string, concluida: boolean) => {
    const tarefa = tarefas.find(t => t.id === id);
    await supabase.from("tarefas" as any).update({ concluida } as any).eq("id", id);
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, concluida } : t));

    // Log to history when completing
    if (concluida && tarefa && user) {
      await supabase.from("tarefas_historico" as any).insert({
        tarefa_id: id,
        organizacao_id: tarefa.organizacao_id,
        processo_id: tarefa.processo_id || null,
        fase: tarefa.fase || null,
        responsavel_id: tarefa.responsavel_id,
        executado_por: user.id,
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || null,
        data_vencimento_original: tarefa.data_vencimento,
        acao: "concluida",
      } as any);
    }
  };

  const createTarefa = async (tarefa: Omit<Tarefa, "id" | "created_at" | "created_by">) => {
    const { data, error } = await supabase
      .from("tarefas" as any)
      .insert({ ...tarefa, created_by: user!.id } as any)
      .select()
      .single();
    if (error) {
      toast.error("Não foi possível criar a tarefa", { description: error.message });
    } else if (data) {
      setTarefas(prev => [...prev, data as unknown as Tarefa]);
    }
    return { data, error };
  };

  const deleteTarefa = async (id: string) => {
    const tarefa = tarefas.find(t => t.id === id);
    // Log to history before deleting
    if (tarefa && user) {
      await supabase.from("tarefas_historico" as any).insert({
        tarefa_id: id,
        organizacao_id: tarefa.organizacao_id,
        processo_id: tarefa.processo_id || null,
        fase: tarefa.fase || null,
        responsavel_id: tarefa.responsavel_id,
        executado_por: user.id,
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || null,
        data_vencimento_original: tarefa.data_vencimento,
        acao: "excluida",
      } as any);
    }
    await supabase.from("tarefas" as any).delete().eq("id", id);
    setTarefas(prev => prev.filter(t => t.id !== id));
    toast.success("Tarefa excluída");
  };

  return { tarefas, loading, load, toggleConcluida, createTarefa, deleteTarefa };
}
