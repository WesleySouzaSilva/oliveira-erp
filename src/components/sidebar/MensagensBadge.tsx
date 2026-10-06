import { useConversas } from "@/hooks/useConversas";

export function MensagensBadge() {
  const { totalNaoLidas } = useConversas();
  if (!totalNaoLidas) return null;
  return (
    <span className="ml-auto text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full font-semibold">
      {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
    </span>
  );
}