import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PerfilCliente360 } from "@/components/cliente/PerfilCliente360";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produtor: string;
}

export function PerfilClienteDrawer({ open, onOpenChange, produtor }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
              {produtor.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <span className="text-lg">{produtor}</span>
          </SheetTitle>
          <SheetDescription>
            Visão 360 do produtor: processos por banco, contratos, andamento judicial e adimplência.
          </SheetDescription>
        </SheetHeader>

        <div className="py-5">
          {open && (
            <PerfilCliente360
              produtor={produtor}
              hideHeader
              onNavigate={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
