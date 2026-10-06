import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

interface VencimentosDuplicatesBannerProps {
  duplicateGroupsCount: number;
  duplicateExtrasCount: number;
  onOpen: () => void;
}

export function VencimentosDuplicatesBanner({ duplicateGroupsCount, duplicateExtrasCount, onOpen }: VencimentosDuplicatesBannerProps) {
  if (duplicateGroupsCount === 0) return null;
  return (
    <motion.div
      {...fadeUp}
      transition={{ delay: 0.09 }}
      className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2 text-sm text-foreground">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <span>
          Encontramos {duplicateGroupsCount} grupo(s) de duplicidade ({duplicateExtrasCount} registro(s) excedente(s)).
          Revise para editar ou excluir.
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen}>
        Abrir revisão
      </Button>
    </motion.div>
  );
}