import { AlertTriangle, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Contrato, DuplicateGroup } from "@/hooks/useVencimentosData";
import { formatDateBR, formatCurrency } from "./lib/helpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateGroups: DuplicateGroup[];
  duplicateExtrasCount: number;
  onDeleteAllDuplicateExtras: () => void;
  onDeleteDuplicateExtras: (group: DuplicateGroup) => void;
  onEditItem: (item: Contrato) => void;
  onDeleteItem: (id: string) => void;
}

export function DuplicatesReviewDialog({
  open,
  onOpenChange,
  duplicateGroups,
  duplicateExtrasCount,
  onDeleteAllDuplicateExtras,
  onDeleteDuplicateExtras,
  onEditItem,
  onDeleteItem,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Revisão de Duplicados
          </DialogTitle>
        </DialogHeader>

        {duplicateGroups.length === 0 ? (
          <div className="py-4 text-sm text-muted-foreground">Nenhum contrato duplicado encontrado no momento.</div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <p className="text-sm text-foreground">
                <strong>{duplicateExtrasCount}</strong> registro(s) duplicado(s) em <strong>{duplicateGroups.length}</strong> grupo(s)
              </p>
              <Button size="sm" variant="destructive" onClick={onDeleteAllDuplicateExtras}>
                <Trash2 className="w-3.5 h-3.5" /> Excluir todos os duplicados
              </Button>
            </div>
            {duplicateGroups.map((group) => (
              <div key={group.key} className="border border-border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p data-private className="text-sm font-semibold text-foreground">{group.nome_cliente}</p>
                    <p className="text-xs text-muted-foreground">
                      Contrato: {group.numero_contrato || "sem número"} • Banco: {group.banco || "não informado"}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onDeleteDuplicateExtras(group)}>
                    <Trash2 className="w-3.5 h-3.5" /> Excluir extras
                  </Button>
                </div>

                <div className="space-y-2">
                  {group.items.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-border p-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="text-xs text-muted-foreground">
                        <span className={index === 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                          {index === 0 ? "Manter (mais recente)" : "Duplicado"}
                        </span>
                        {" • "}
                        ID: {item.id.slice(0, 8)}...
                        {" • "}
                        Vencimento: {formatDateBR(item.vencimento_proxima_parcela)}
                        {" • "}
                        Total: {formatCurrency(item.valor_total_operacao)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditItem(item)}
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Editar
                        </Button>
                        {index > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => onDeleteItem(item.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" /> Excluir
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
