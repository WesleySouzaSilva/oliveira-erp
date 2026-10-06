import { Link2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetsUrl: string;
  setSheetsUrl: (v: string) => void;
  sheetsName: string;
  setSheetsName: (v: string) => void;
  onConnect: () => void;
  syncing: boolean;
}

export function GoogleSheetsDialog({
  open,
  onOpenChange,
  sheetsUrl,
  setSheetsUrl,
  sheetsName,
  setSheetsName,
  onConnect,
  syncing,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-accent" />
            Conectar Google Sheets
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Cole o link da planilha do Google Sheets. A planilha deve estar compartilhada como <strong>"Qualquer pessoa com o link"</strong>.
          </p>
          <div className="grid gap-2">
            <Label>Link da planilha</Label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Nome da aba (opcional)</Label>
            <Input
              placeholder="Sheet1 (padrão)"
              value={sheetsName}
              onChange={(e) => setSheetsName(e.target.value)}
            />
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Colunas esperadas:</strong>
            </p>
            <p>
              Nome/Cliente, Banco, Contrato, Vencimento, Valor Parcela, Valor Total, Vencidas, Laudo, Limite Protocolo,
              Protocolo Realizado, Status
            </p>
            <p className="mt-2">
              <strong>⚠️ Atenção:</strong> A sincronização agora atualiza contratos existentes e aponta conflitos de duplicidade para revisão.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConnect} disabled={syncing || !sheetsUrl.trim()}>
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Conectar e Sincronizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
