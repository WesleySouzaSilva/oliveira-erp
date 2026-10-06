import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyRadarChanged, type OperacaoCredito } from "@/hooks/useOperacoesCredito";
import { FALTAS_PROTOCOLO, prazoCompletar, PRAZO_COMPLETAR_DIAS } from "@/lib/urgencia";

const hojeISO = () => new Date().toISOString().slice(0, 10);

interface Props {
  operacao: OperacaoCredito | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

export function ProtocoloDialog({ operacao, open, onOpenChange, onSaved }: Props) {
  const [data, setData] = useState(hojeISO());
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [urgencia, setUrgencia] = useState(false);
  const [faltava, setFaltava] = useState<string[]>([]);
  const [porCpf, setPorCpf] = useState<"sim" | "nao" | "">("");

  useEffect(() => {
    if (open) {
      setData(hojeISO());
      setRef("");
      setUrgencia(!!operacao?.entrada_urgente);
      setFaltava([]);
      setPorCpf("");
    }
  }, [open, operacao]);

  const dataFutura = data > hojeISO();
  const urgenciaOk = !urgencia || porCpf !== "";
  const podeSalvar = !!data && !dataFutura && ref.trim().length > 0 && urgenciaOk && !saving;

  const toggleFalta = (k: string) =>
    setFaltava((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));

  const salvar = async () => {
    if (!operacao || !podeSalvar) return;
    setSaving(true);
    const { error } =
      operacao.origem === "contrato"
        ? await supabase
            .from("contratos_vencimentos")
            .update({ data_notificacao: data, canal_notificacao: ref.trim(), notificado_antes_vencimento: true })
            .eq("id", operacao.id)
        : await supabase
            .from("operacoes_credito")
            .update({
              notificado_em: data,
              protocolo_ref: ref.trim(),
              protocolo_urgencia: urgencia,
              protocolo_faltava: urgencia ? faltava : [],
              protocolo_por_cpf: urgencia ? porCpf === "sim" : null,
              pendencia_completar: urgencia && faltava.length > 0,
              pendencia_prazo: urgencia && faltava.length > 0 ? prazoCompletar() : null,
            } as any)
            .eq("id", operacao.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível gravar o protocolo");
      return;
    }
    toast.success(
      urgencia && faltava.length
        ? `Protocolo de urgência registrado — pendência "Completar documentação do pedido" criada com prazo de ${PRAZO_COMPLETAR_DIAS} dias`
        : "Protocolo registrado — operação saiu do radar",
    );
    notifyRadarChanged();
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como protocolado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="protocolo-data">Data do protocolo *</Label>
            <Input
              id="protocolo-data"
              type="date"
              value={data}
              max={hojeISO()}
              onChange={(e) => setData(e.target.value)}
            />
            {dataFutura && <p className="text-xs text-destructive">A data do protocolo não pode ser futura.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="protocolo-ref">Referência do protocolo *</Label>
            <Input
              id="protocolo-ref"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="nº consumidor.gov, protocolo da agência ou e-mail de dd/mm"
            />
            <p className="text-xs text-muted-foreground">Sem referência não é possível gravar.</p>
          </div>

          {operacao?.origem !== "contrato" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-3">
              <label className="flex items-start gap-2 text-sm font-semibold">
                <Checkbox checked={urgencia} onCheckedChange={(v) => setUrgencia(!!v)} />
                <span>Protocolo em regime de urgência</span>
              </label>
              {urgencia && (
                <>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold">O que faltava no momento do protocolo</p>
                    {FALTAS_PROTOCOLO.map((f) => (
                      <label key={f.key} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={faltava.includes(f.key)} onCheckedChange={() => toggleFalta(f.key)} />
                        {f.label}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold">
                      O pedido foi feito por CPF, cobrindo todas as operações do titular naquele banco? *
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={porCpf === "sim" ? "secondary" : "outline"}
                        onClick={() => setPorCpf("sim")}
                      >
                        Sim
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={porCpf === "nao" ? "secondary" : "outline"}
                        onClick={() => setPorCpf("nao")}
                      >
                        Não
                      </Button>
                    </div>
                  </div>
                  {faltava.length > 0 && (
                    <p className="text-xs text-destructive">
                      Será criada a pendência "Completar documentação do pedido", com prazo de {PRAZO_COMPLETAR_DIAS}{" "}
                      dias, para quem faz o mapeamento.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!podeSalvar}>Gravar protocolo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
