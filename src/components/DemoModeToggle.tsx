import { Eye, EyeOff } from "lucide-react";
import { useDemoMode } from "@/hooks/useDemoMode";

export function DemoModeToggle() {
  const { on, toggle } = useDemoMode();
  return (
    <button
      onClick={toggle}
      title={on ? "Mostrar dados dos clientes" : "Ocultar dados dos clientes (modo demonstração)"}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
        on
          ? "bg-accent/15 text-accent border-accent/30"
          : "bg-card text-muted-foreground border-border hover:bg-secondary"
      }`}
    >
      {on ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{on ? "Demo: ON" : "Modo demo"}</span>
    </button>
  );
}