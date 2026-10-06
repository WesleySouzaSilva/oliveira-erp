import { motion } from "framer-motion";
import { Link2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

interface Props {
  syncConfig: any;
  syncing: boolean;
  onResync: () => void;
}

export function SyncStatusBar({ syncConfig, syncing, onResync }: Props) {
  if (!syncConfig) return null;
  return (
    <motion.div
      {...fadeUp}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-[calc(50%+120px)] z-40 bg-card border border-border rounded-lg px-4 py-2 shadow-lg flex items-center gap-3 text-sm"
    >
      <Link2 className="w-4 h-4 text-accent" />
      <span className="text-muted-foreground">Google Sheets conectado</span>
      {syncConfig.last_synced_at && (
        <span className="text-xs text-muted-foreground/60">
          Última sync: {new Date(syncConfig.last_synced_at).toLocaleString("pt-BR")}
        </span>
      )}
      <Button size="sm" variant="ghost" onClick={onResync} disabled={syncing}>
        <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
      </Button>
    </motion.div>
  );
}
