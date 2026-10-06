
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type SyncAction =
  | "test_connection"
  | "list_customers"
  | "list_lawsuits"
  | "list_posts"
  | "get_movements"
  | "sync_customer"
  | "sync_all"
  | "list_tasks"
  | "sync_agenda";

interface SyncLog {
  id: string;
  tipo_sync: string;
  registros_sincronizados: number;
  status: string;
  erro: string | null;
  created_at: string;
}

export function useAdvboxSync() {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const { toast } = useToast();

  const callAdvbox = async (action: SyncAction, params?: Record<string, unknown>) => {
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/advbox-sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action, params }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na sincronização");

      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro Advbox", description: msg, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const data = await callAdvbox("test_connection");
      setConnected(data?.connected === true);
      if (data?.connected) {
        toast({ title: "Conexão com Advbox ativa!" });
      }
      return data;
    } catch {
      setConnected(false);
    }
  };

  const syncAll = async () => {
    const data = await callAdvbox("sync_all");
    toast({
      title: "Sincronização concluída!",
      description: `${data?.total || 0} registros sincronizados`,
    });
    await fetchLogs();
    return data;
  };

  const syncCustomers = async () => {
    const data = await callAdvbox("list_customers");
    toast({
      title: "Clientes sincronizados",
      description: `${Array.isArray(data) ? data.length : 0} registros`,
    });
    await fetchLogs();
    return data;
  };

  const syncLawsuits = async () => {
    const data = await callAdvbox("list_lawsuits");
    toast({
      title: "Processos sincronizados",
      description: `${Array.isArray(data) ? data.length : 0} registros`,
    });
    await fetchLogs();
    return data;
  };

  const syncTasks = async () => {
    const data = await callAdvbox("list_posts");
    toast({
      title: "Tarefas sincronizadas",
      description: `${Array.isArray(data) ? data.length : 0} registros`,
    });
    await fetchLogs();
    return data;
  };

  const syncAgenda = async () => {
    const data = await callAdvbox("sync_agenda");
    toast({
      title: "Agenda do Advbox sincronizada",
      description: `${data?.importados ?? 0} compromissos importados${
        data?.sem_responsavel ? ` (${data.sem_responsavel} sem responsável vinculado)` : ""
      }`,
    });
    await fetchLogs();
    return data;
  };

  const fetchLogs = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/rest/v1/advbox_sync_log?select=*&order=created_at.desc&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const logs = await res.json();
      if (Array.isArray(logs)) setSyncLogs(logs as SyncLog[]);
    } catch {
      // ignore
    }
  };

  return {
    loading,
    connected,
    syncLogs,
    testConnection,
    syncAll,
    syncCustomers,
    syncLawsuits,
    syncTasks,
    syncAgenda,
    fetchLogs,
  };
}
