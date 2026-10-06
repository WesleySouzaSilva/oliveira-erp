import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pencil } from "lucide-react";

const PRESETS = ["Em dia", "Em atraso", "Renegociado", "Pendente"];

interface Props {
  valor: string | null;
  icone: React.ReactNode;
  onSalvar: (novo: string) => void | Promise<void>;
}

/**
 * Edição inline do status do contrato: clique abre popover com presets
 * (Em dia / Em atraso / Renegociado / Pendente) e um campo de texto livre
 * para descrever situações específicas (ex.: "Aguardando sinal do cliente").
 */
export function StatusPrazoEditor({ valor, icone, onSalvar }: Props) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState(valor || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTexto(valor || "");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, valor]);

  const aplicar = async (novo: string) => {
    await onSalvar(novo);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="group inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-secondary/60 transition-colors text-left max-w-[180px]"
          title="Editar status"
        >
          {icone}
          <span className="text-[10px] truncate">{valor || "—"}</span>
          <Pencil className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <p className="text-[11px] font-semibold text-foreground mb-1.5 px-1">Status do contrato</p>
        <div className="space-y-0.5 mb-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => aplicar(p)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-secondary transition-colors ${
                (valor || "").toLowerCase() === p.toLowerCase() ? "bg-secondary font-medium" : ""
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="border-t pt-2">
          <label className="text-[10px] text-muted-foreground px-1 uppercase tracking-wide">
            Ou descreva
          </label>
          <form
            onSubmit={(e) => { e.preventDefault(); aplicar(texto); }}
            className="flex gap-1 mt-1"
          >
            <input
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: Aguardando sinal do cliente"
              className="flex-1 text-xs px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              className="text-xs px-2.5 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              Salvar
            </button>
          </form>
          {valor && (
            <button
              onClick={() => aplicar("")}
              className="mt-1.5 text-[10px] text-muted-foreground hover:text-destructive"
            >
              Limpar status
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}