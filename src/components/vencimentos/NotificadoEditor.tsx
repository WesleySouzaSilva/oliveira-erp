import { useState } from "react";
import { CheckCircle, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  valor: boolean | null;
  onSalvar: (novo: boolean | null) => void | Promise<void>;
}

/**
 * Edição inline do campo "Notificado antes do vencimento". Mantém os mesmos
 * selos visuais (verde Sim / vermelho Não / vazio) e, ao clicar, abre um
 * popover compacto para alterar o valor sem precisar abrir o formulário.
 */
export function NotificadoEditor({ valor, onSalvar }: Props) {
  const [open, setOpen] = useState(false);

  const aplicar = async (novo: boolean | null) => {
    await onSalvar(novo);
    setOpen(false);
  };

  const display =
    valor === true ? (
      <span className="inline-flex items-center gap-1 text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">
        <CheckCircle className="w-3 h-3" /> Sim
      </span>
    ) : valor === false ? (
      <span className="inline-flex items-center gap-1 text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">
        <X className="w-3 h-3" /> Não
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded px-1 py-0.5 hover:bg-secondary/60 transition-colors"
          title="Editar notificação antes do vencimento"
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <p className="text-[11px] font-semibold text-foreground mb-1.5 px-1">
          Notificado antes do vencimento?
        </p>
        <div className="space-y-0.5">
          <button
            onClick={() => aplicar(true)}
            className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-secondary transition-colors ${valor === true ? "bg-secondary font-medium" : ""}`}
          >
            Sim
          </button>
          <button
            onClick={() => aplicar(false)}
            className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-secondary transition-colors ${valor === false ? "bg-secondary font-medium" : ""}`}
          >
            Não
          </button>
          <button
            onClick={() => aplicar(null)}
            className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground ${valor === null ? "bg-secondary font-medium" : ""}`}
          >
            Limpar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}