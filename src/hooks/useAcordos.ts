import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AcordoRow = Database["public"]["Tables"]["acordos_tarefas"]["Row"];
type AcordoInsert = Database["public"]["Tables"]["acordos_tarefas"]["Insert"];
type AcordoUpdate = Database["public"]["Tables"]["acordos_tarefas"]["Update"];

export type AcordoTarefa = AcordoRow;

export function useAcordos() {
  const { user } = useAuth();
  const { orgId } = useOrgMembers();
  const [tarefas, setTarefas] = useState<AcordoTarefa[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTarefas = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("acordos_tarefas")
      .select("*")
      .eq("organizacao_id", orgId)
      .order("data_vencimento", { ascending: true });

    if (error) {
      console.error("Erro ao buscar tarefas de acordos:", error);
    } else {
      setTarefas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (orgId) fetchTarefas();
  }, [orgId]);

  const criarTarefa = async (tarefa: Partial<AcordoInsert>) => {
    if (!user || !orgId) return null;

    const payload: AcordoInsert = {
      titulo: tarefa.titulo || "",
      organizacao_id: orgId,
      created_by: user.id,
      responsavel_id: tarefa.responsavel_id || user.id,
      data_vencimento: tarefa.data_vencimento || new Date().toISOString().split("T")[0],
      descricao: tarefa.descricao,
      nome_cliente: tarefa.nome_cliente,
      prioridade: tarefa.prioridade || "normal",
      recorrente: tarefa.recorrente || false,
      intervalo_recorrencia: tarefa.intervalo_recorrencia,
      contrato_id: tarefa.contrato_id,
      observacoes: tarefa.observacoes,
      tarefa_origem_id: tarefa.tarefa_origem_id,
    };

    // Calculate proxima_geracao if recorrente
    if (payload.recorrente && payload.data_vencimento && payload.intervalo_recorrencia) {
      const d = new Date(payload.data_vencimento);
      switch (payload.intervalo_recorrencia) {
        case "semanal": d.setDate(d.getDate() + 7); break;
        case "quinzenal": d.setDate(d.getDate() + 14); break;
        case "mensal": d.setMonth(d.getMonth() + 1); break;
      }
      payload.proxima_geracao = d.toISOString().split("T")[0];
    }

    const { data, error } = await supabase
      .from("acordos_tarefas")
      .insert(payload)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar tarefa de acordo");
      console.error(error);
      return null;
    }
    toast.success("Tarefa de acordo criada!");
    await fetchTarefas();
    return data;
  };

  const atualizarTarefa = async (id: string, updates: AcordoUpdate) => {
    const { error } = await supabase
      .from("acordos_tarefas")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar tarefa");
      console.error(error);
      return false;
    }
    toast.success("Tarefa atualizada!");
    await fetchTarefas();
    return true;
  };

  const concluirTarefa = async (id: string, resultado: string, valorAcordo?: number) => {
    const tarefa = tarefas.find(t => t.id === id);

    const updates: AcordoUpdate = {
      concluida: true,
      status: "concluida",
      resultado_tentativa: resultado,
    };
    if (valorAcordo !== undefined) updates.valor_acordo = valorAcordo;

    const { error } = await supabase
      .from("acordos_tarefas")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao concluir tarefa");
      return false;
    }

    // Auto-generate next if recorrente
    if (tarefa?.recorrente && tarefa.intervalo_recorrencia && resultado !== "acordo_fechado") {
      const nextDate = new Date(tarefa.data_vencimento);
      switch (tarefa.intervalo_recorrencia) {
        case "semanal": nextDate.setDate(nextDate.getDate() + 7); break;
        case "quinzenal": nextDate.setDate(nextDate.getDate() + 14); break;
        case "mensal": nextDate.setMonth(nextDate.getMonth() + 1); break;
      }

      await criarTarefa({
        titulo: tarefa.titulo,
        descricao: tarefa.descricao,
        nome_cliente: tarefa.nome_cliente,
        contrato_id: tarefa.contrato_id,
        responsavel_id: tarefa.responsavel_id,
        prioridade: tarefa.prioridade,
        data_vencimento: nextDate.toISOString().split("T")[0],
        recorrente: true,
        intervalo_recorrencia: tarefa.intervalo_recorrencia,
        tarefa_origem_id: tarefa.tarefa_origem_id || tarefa.id,
      });
    }

    toast.success("Tarefa concluída!");
    await fetchTarefas();
    return true;
  };

  return { tarefas, loading, criarTarefa, atualizarTarefa, concluirTarefa, refetch: fetchTarefas };
}
