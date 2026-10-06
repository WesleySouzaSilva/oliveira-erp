import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyRadarChanged, type OperacaoCredito } from "@/hooks/useOperacoesCredito";
import { DECISOES_VENCIDA } from "@/lib/urgencia";

interface Props {
  operacao: OperacaoCredito | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

/** Operação que venceu sem protocolo: a decisão é do administrador. */
export function DecisaoVencidaDialog({ operacao, open, onOpenChange, onSaved }: Props) {
  const [decisao, setDecisao] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDecisao("");
      setObs("");
    }
  }, [open]);

  const salvar = async () => {
    if (!operacao || !decisao) return;
    setSaving(true);
    const { error } = await supabase
      .from("operacoes_credito")
      .update({ decisao_vencida: decisao, decisao_obs: obs.trim() || null } as any)
      .eq("id", operacao.id);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível registrar a decisão");
      return;
    }
    toast.success("Decisão registrada");
    notifyRadarChanged();
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Perdeu o prazo do pedido?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {operacao?.banco} nº {operacao?.numero} venceu sem protocolo. Registre o caminho escolhido.
          </p>
          <div className="space-y-2">
            {DECISOES_VENCIDA.map((d) => (
              <Button
                key={d.value}
                type="button"
                variant={decisao === d.value ? "secondary" : "outline"}
                className="w-full justify-start"
                onClick={() => setDecisao(d.value)}
              >
                {d.label}
              </Button>
            ))}
          </div>
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observação (opcional)"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!decisao || saving}>Registrar decisão</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
