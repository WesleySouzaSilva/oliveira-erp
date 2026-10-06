import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TableName = "atendimentos_notas" | "acordos_tarefas" | "processo_andamentos";

interface Props {
  table: TableName;
  id: string;
  value: boolean;
  /** Se o vínculo com cliente_id ainda não existe, o toggle avisa que o cliente
   * não verá — mas continua ativo (a equipe pode marcar antes de vincular). */
  hint?: string;
  onChanged?: (next: boolean) => void;
  size?: "sm" | "xs";
}

/**
 * Toggle interno "Cliente vê / Interno".
 * Default é oculto — a equipe libera item a item. Mesmo padrão do toggle
 * usado nos andamentos do processo (Fase 1 do Portal do Cliente do Agro).
 */
export function VisivelClienteToggle({ table, id, value, hint, onChanged, size = "sm" }: Props) {
  const [saving, setSaving] = useState(false);
  const [visivel, setVisivel] = useState(value);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    const next = !visivel;
    const { error } = await supabase
      .from(table)
      .update({ visivel_cliente: next } as any)
      .eq("id", id);
    setSaving(false);
    if (error) { toast.error("Erro ao alterar visibilidade"); return; }
    setVisivel(next);
    onChanged?.(next);
    toast.success(next ? "Liberado para o cliente" : "Ocultado do cliente");
  };

  const isXs = size === "xs";
  return (
    <button
      type="button"
      onClick={toggle}
      title={hint || (visivel ? "Cliente pode ver este item no portal" : "Apenas interno — cliente NÃO vê")}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border transition-colors",
        isXs ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        visivel
          ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
      )}
    >
      {saving ? (
        <Loader2 className={cn(isXs ? "w-2.5 h-2.5" : "w-3 h-3", "animate-spin")} />
      ) : visivel ? (
        <Eye className={isXs ? "w-2.5 h-2.5" : "w-3 h-3"} />
      ) : (
        <EyeOff className={isXs ? "w-2.5 h-2.5" : "w-3 h-3"} />
      )}
      {visivel ? "Cliente vê" : "Interno"}
    </button>
  );
}