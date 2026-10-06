import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatSyncSummary } from "@/components/vencimentos/lib/helpers";
import type { User } from "@supabase/supabase-js";

interface UseSheetsSyncOptions {
  user: User | null;
  onAfterSync: (data: any) => void | Promise<void>;
}

export function useSheetsSync({ user, onAfterSync }: UseSheetsSyncOptions) {
  const [syncConfig, setSyncConfig] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [sheetsDialogOpen, setSheetsDialogOpen] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsName, setSheetsName] = useState("");

  const loadSyncConfig = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("sheets_sync_config" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);

    if (data && (data as any[]).length > 0) setSyncConfig((data as any[])[0]);
  };

  useEffect(() => {
    loadSyncConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleConnectSheets = async () => {
    if (!user || !sheetsUrl.trim()) {
      toast.error("Cole o link da planilha do Google Sheets");
      return;
    }

    setSyncing(true);
    try {
      const configPayload = {
        user_id: user.id,
        spreadsheet_url: sheetsUrl.trim(),
        sheet_name: sheetsName.trim() || "Sheet1",
        is_active: true,
      };

      const { data: config, error: configErr } = await supabase
        .from("sheets_sync_config" as any)
        .upsert(syncConfig ? { ...configPayload, id: syncConfig.id } : (configPayload as any))
        .select()
        .single();

      if (configErr) throw configErr;

      const { data, error } = await supabase.functions.invoke("sync-google-sheets", {
        body: {
          action: "sync",
          spreadsheet_url: sheetsUrl.trim(),
          sheet_name: sheetsName.trim() || "Sheet1",
          config_id: (config as any)?.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Sincronização concluída: ${formatSyncSummary(data)}`);
      setSyncConfig(config);
      setSheetsDialogOpen(false);
      await onAfterSync(data);
    } catch (err: any) {
      toast.error(err.message || "Erro ao sincronizar planilha");
    }

    setSyncing(false);
  };

  const handleResync = async () => {
    if (!syncConfig) return;

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-sheets", {
        body: {
          action: "sync",
          spreadsheet_url: syncConfig.spreadsheet_url,
          sheet_name: syncConfig.sheet_name,
          config_id: syncConfig.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Sincronização concluída: ${formatSyncSummary(data)}`);
      await onAfterSync(data);
    } catch (err: any) {
      toast.error(err.message || "Erro ao sincronizar");
    }

    setSyncing(false);
  };

  const handleDisconnectSheets = async () => {
    if (!syncConfig) return;
    await supabase
      .from("sheets_sync_config" as any)
      .update({ is_active: false } as any)
      .eq("id", syncConfig.id);
    setSyncConfig(null);
    toast.success("Planilha desconectada");
  };

  return {
    syncConfig,
    syncing,
    sheetsDialogOpen,
    setSheetsDialogOpen,
    sheetsUrl,
    setSheetsUrl,
    sheetsName,
    setSheetsName,
    handleConnectSheets,
    handleResync,
    handleDisconnectSheets,
  };
}