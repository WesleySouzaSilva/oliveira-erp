import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { diasRestantes, notifyRadarChanged, type OperacaoCredito } from "@/hooks/useOperacoesCredito";
import { usePapelRadar } from "@/hooks/usePapelRadar";

interface Props {
  /** Uma operação (ação da linha). */
  operacao?: OperacaoCredito | null;
  /** Várias operações (dispensa em lote) — tem precedência sobre `operacao`. */
  operacoes?: OperacaoCredito[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

/** Acima deste número, a dispensa em lote exige confirmação digitada. */
const LIMITE_CONFIRMACAO = 5;
const PALAVRA_CONFIRMACAO = "DISPENSAR";

/** Operação dentro do radar: vencida há até 90 dias ou vencendo em até 60. */
function noRadar(op: OperacaoCredito) {
  if (op.notificado_em || op.dispensar_alerta || !op.vence_em) return false;
  const d = diasRestantes(op.vence_em);
  return d >= -90 && d <= 60;
}

export function DispensarAlertaDialog({ operacao, operacoes, open, onOpenChange, onSaved }: Props) {
  const alvos = operacoes && operacoes.length > 0 ? operacoes : operacao ? [operacao] : [];
  const emLote = alvos.length > 1;
  const exigeConfirmacao = alvos.length > LIMITE_CONFIRMACAO;
  const { isAdmin } = usePapelRadar();
  const bloqueadoRadar = !isAdmin && alvos.some(noRadar);
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [saving, setSaving] = useState(false);
  const confirmado = !exigeConfirmacao || confirmacao.trim().toUpperCase() === PALAVRA_CONFIRMACAO;

  useEffect(() => {
    if (open) {
      setMotivo("");
      setConfirmacao("");
    }
  }, [open]);

  const salvar = async () => {
    const texto = motivo.trim();
    if (alvos.length === 0 || texto.length === 0 || !confirmado) return;
    // "Não alongável" é só etiqueta: nunca tira a operação do radar.
    if (/n[aã]o\s+along/i.test(texto)) {
      toast.error(
        "A natureza do crédito (não alongável) não tira a operação do radar — registre-a como etiqueta na operação.",
      );
      return;
    }
    setSaving(true);

    const idsContrato = alvos.filter((o) => o.origem === "contrato").map((o) => o.id);
    const idsOperacao = alvos.filter((o) => o.origem !== "contrato").map((o) => o.id);

    const resultados = await Promise.all([
      idsContrato.length
        ? supabase
            .from("contratos_vencimentos")
            .update({ resolvido: true, motivo_resolucao: texto })
            .in("id", idsContrato)
        : Promise.resolve({ error: null } as any),
      idsOperacao.length
        ? supabase
            .from("operacoes_credito")
            .update({ dispensar_alerta: true, dispensa_motivo: texto })
            .in("id", idsOperacao)
        : Promise.resolve({ error: null } as any),
    ]);

    setSaving(false);
    if (resultados.some((r: any) => r.error)) {
      toast.error("Não foi possível dispensar o alerta");
      return;
    }
    toast.success(
      emLote ? `${alvos.length} alertas dispensados com o motivo registrado` : "Alerta dispensado com o motivo registrado"
    );
    notifyRadarChanged();
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {emLote ? `Dispensar alerta de ${alvos.length} operações` : "Dispensar alerta"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="dispensa-motivo">Motivo *</Label>
          <Textarea
            id="dispensa-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            placeholder="Ex.: já judicializada, já quitada, resolvida por acordo"
          />
          <p className="text-xs text-muted-foreground">
            {emLote
              ? "O mesmo motivo será registrado em todas as operações selecionadas."
              : "Sem motivo escrito o alerta não é dispensado."}
          </p>
          <p className="text-xs text-muted-foreground">
            Saem do radar apenas: quitada; renegociada/substituída (com o número da nova); duplicata de outra
            operação ativa; não é operação; protocolada e em acompanhamento; banco fora do contrato. A natureza do
            crédito (CDC, capital de giro, CCB pessoal, consórcio, veículo) não tira do radar.
          </p>
        </div>
        {bloqueadoRadar && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs font-semibold text-destructive">
            {emLote
              ? "Há operações no radar na seleção — somente o administrador pode dispensá-las."
              : "Esta operação está no radar — somente o administrador pode dispensar o alerta."}
          </p>
        )}
        {exigeConfirmacao && (
          <div className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <Label htmlFor="dispensa-confirmacao">
              São {alvos.length} operações. Digite {PALAVRA_CONFIRMACAO} para confirmar *
            </Label>
            <Input
              id="dispensa-confirmacao"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={PALAVRA_CONFIRMACAO}
              autoComplete="off"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={salvar}
            disabled={motivo.trim().length === 0 || !confirmado || saving || bloqueadoRadar}
          >
            Dispensar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
