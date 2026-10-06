import { toast } from "sonner";

/**
 * Executa uma exclusão (soft-delete) de forma reversível.
 * - executa `commit` imediatamente (ex: marcar deleted_at)
 * - mostra toast com botão "Desfazer" por `durationMs` (default 8s)
 * - se clicado, chama `restore` (ex: limpar deleted_at)
 *
 * Padrão: o item desaparece da UI na hora; o desfazer apenas reverte o backend.
 */
export async function undoableDelete(opts: {
  label: string;
  commit: () => Promise<void> | void;
  restore: () => Promise<void> | void;
  durationMs?: number;
  onAfter?: () => void;
}) {
  const { label, commit, restore, durationMs = 8000, onAfter } = opts;
  try {
    await commit();
  } catch (err: any) {
    toast.error("Falha ao excluir", { description: err?.message });
    return;
  }
  toast.success(`${label} removido`, {
    description: "Você tem alguns segundos para desfazer.",
    duration: durationMs,
    action: {
      label: "Desfazer",
      onClick: async () => {
        try {
          await restore();
          toast.message("Restaurado");
          onAfter?.();
        } catch (err: any) {
          toast.error("Não foi possível desfazer", { description: err?.message });
        }
      },
    },
  });
  onAfter?.();
}