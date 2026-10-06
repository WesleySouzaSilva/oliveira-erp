import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout, Building2, Gavel, HeartHandshake, ChevronsUpDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import logoSymbol from "@/assets/logo-oliveira-adv.png";

export type SidebarArea = "agro" | "empresarial" | "demandas-gerais" | "previdenciario";

interface AreaSwitcherProps {
  value: SidebarArea;
  onChange: (area: SidebarArea) => void;
  /** Áreas liberadas para o usuário. Se omitido, todas. */
  allowed?: SidebarArea[];
}

const OPTIONS: { value: SidebarArea; label: string; icon: any }[] = [
  { value: "agro", label: "Agro", icon: Sprout },
  { value: "empresarial", label: "Empresarial", icon: Building2 },
  { value: "demandas-gerais", label: "Demandas complexas", icon: Gavel },
  { value: "previdenciario", label: "Previdenciário", icon: HeartHandshake },
];

/**
 * Cabeçalho da sidebar: logo + "Oliveira" + nome do squad ativo (no accent do
 * squad). Quando o usuário tem 2+ squads liberados, vira um botão que abre um
 * Popover para trocar de contexto. Com um squad só, é texto simples.
 */
export function AreaSwitcher({ value, onChange, allowed }: AreaSwitcherProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const options = allowed && allowed.length > 0 ? OPTIONS.filter((o) => allowed.includes(o.value)) : OPTIONS;
  const activeOpt = options.find((o) => o.value === value) || options[0] || OPTIONS[0];

  const brand = (
    <>
      <img src={logoSymbol} alt="Oliveira Agro" className="h-9 w-9 object-contain shrink-0 block" />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-sidebar-foreground leading-none">Oliveira</p>
        <p className="text-[11px] font-semibold text-area-accent truncate leading-none mt-1">
          {activeOpt.label}
        </p>
      </div>
    </>
  );

  if (options.length <= 1) {
    return (
      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex items-center gap-2.5 w-full rounded-lg px-1 py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label="Ir para a página inicial"
      >
        {brand}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Trocar de squad"
          className="flex items-center gap-2.5 w-full rounded-lg px-1 py-1 text-left transition-colors hover:bg-sidebar-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {brand}
          <ChevronsUpDown className="w-4 h-4 shrink-0 text-sidebar-foreground/50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-56 p-1">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left transition-colors ${
                active ? "bg-muted font-semibold" : "hover:bg-muted/60"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{opt.label}</span>
              {active && <Check className="w-4 h-4 shrink-0 text-foreground" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
