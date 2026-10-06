import { useEffect, useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPinned, togglePin, type PinnedItem } from "@/hooks/usePinnedItems";
import { toast } from "sonner";

/**
 * Botão de fixar item no menu de acesso rápido (Pinos do ⌘K).
 * Máximo de 5 itens. Persiste em localStorage.
 */
export function PinButton(props: PinnedItem & { size?: "sm" | "xs" }) {
  const { type, id, title, path, size = "sm" } = props;
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(isPinned(type, id));
  }, [type, id]);

  const onClick = () => {
    const now = togglePin({ type, id, title, path });
    setPinned(now);
    toast.message(now ? "Fixado no acesso rápido" : "Removido dos fixados");
  };

  return (
    <Button
      variant="ghost"
      size={size === "xs" ? "sm" : "sm"}
      onClick={onClick}
      className="gap-1.5"
      title={pinned ? "Remover dos fixados" : "Fixar no acesso rápido (⌘K)"}
    >
      {pinned ? <PinOff className="w-3.5 h-3.5 text-primary" /> : <Pin className="w-3.5 h-3.5" />}
      <span className="text-xs">{pinned ? "Fixado" : "Fixar"}</span>
    </Button>
  );
}

export default PinButton;