import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export function BancoContratadoCheckbox({
  banco,
  checked,
  disabled = false,
  loading = false,
  onChange,
  className,
  showBanco = true,
  title,
}: {
  banco: string;
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  showBanco?: boolean;
  title?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs",
        checked && "border-primary bg-primary/10 text-primary",
        disabled && "cursor-not-allowed opacity-70",
        !disabled && "cursor-pointer hover:bg-muted",
        className,
      )}
      title={title}
      onClick={(event) => event.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        disabled={disabled || loading}
        aria-label={`Banco contratado: ${banco}`}
        onCheckedChange={(value) => onChange?.(value === true)}
      />
      {showBanco && <span className="font-medium text-foreground">{banco}</span>}
      <span className="font-semibold">Contratado</span>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </label>
  );
}