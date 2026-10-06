import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyRadarChanged, type OperacaoCredito } from "@/hooks/useOperacoesCredito";
import { FALTAS_PROTOCOLO, labelFalta } from "@/lib/urgencia";
import { useAuth } from "@/contexts/AuthContext";
import { laudoCompletoPendente } from "@/lib/radarEtapas";

const RESOLVIDOS = ["recebido", "conferido", "nao_aplica", "dispensado"];

interface Props {
  operacao: OperacaoCredito | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

/**
 * Pendência "Completar documentação do pedido" de um protocolo em regime de urgência.
 * Só fecha quando cada item que faltava está Recebido, Não se aplica ou Dispensado.
 */
export function PendenciaDocDialog({ operacao, open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const [situacao, setSituacao] = useState<{ key: string; ok: boolean; detalhe: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !operacao) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      const faltas = operacao.protocolo_faltava || [];
      const chaves = FALTAS_PROTOCOLO.filter((f) => faltas.includes(f.key) && f.chave).map((f) => f.chave as string);
      let itens: any[] = [];
      if (chaves.length) {
        const { data } = await supabase
          .from("pos_venda_checklist_itens")
          .select("chave, status")
          .eq("operacao_id", operacao.id)
          .is("arquivado_em", null)
          .in("chave", chaves);
        itens = (data as any[]) || [];
      }
      const linhas = faltas.map((k) => {
        const cfg = FALTAS_PROTOCOLO.find((f) => f.key === k);
        if (k === "laudo") {
          const ok =
            operacao.laudo_status === "nao_precisa" ||
            operacao.laudo_status === "pronto" ||
            operacao.laudo_status === "laudo_completo_entregue";
          return {
            key: k,
            ok,
            detalhe: ok
              ? "Laudo resolvido"
              : laudoCompletoPendente(operacao.laudo_status)
                ? "Laudo completo pendente"
                : "Laudo ainda não resolvido",
          };
        }
        const item = itens.find((i) => i.chave === cfg?.chave);
        const ok = !!item && RESOLVIDOS.includes(item.status);
        return {
          key: k,
          ok,
          detalhe: item ? `No checklist: ${item.status}` : "Item não encontrado no checklist",
        };
      });
      if (!cancelado) {
        setSituacao(linhas);
        setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open, operacao]);

  const tudoOk = situacao.length > 0 && situacao.every((s) => s.ok);

  const concluir = async () => {
    if (!operacao || !tudoOk) return;
    setSaving(true);
    const { error } = await supabase
      .from("operacoes_credito")
      .update({
        pendencia_completar: false,
        pendencia_resolvida_em: new Date().toISOString(),
        pendencia_resolvida_por: user?.id ?? null,
      } as any)
      .eq("id", operacao.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível encerrar a pendência");
      return;
    }
    toast.success("Documentação completada");
    notifyRadarChanged();
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Completar documentação do pedido</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {operacao?.banco} nº {operacao?.numero} — protocolado em regime de urgência
            {operacao?.pendencia_prazo && ` · prazo até ${operacao.pendencia_prazo.split("-").reverse().join("/")}`}.
          </p>
          {carregando ? (
            <p className="text-muted-foreground">Verificando…</p>
          ) : (
            <ul className="space-y-1">
              {situacao.map((s) => (
                <li key={s.key} className={s.ok ? "text-primary" : "text-destructive"}>
                  {s.ok ? "✓" : "•"} {labelFalta(s.key)} — {s.detalhe}
                </li>
              ))}
            </ul>
          )}
          {!carregando && !tudoOk && (
            <p className="text-xs text-muted-foreground">
              A pendência só fecha quando cada item estiver Recebido, Não se aplica ou Dispensado no onboarding.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={concluir} disabled={!tudoOk || saving}>Concluir pendência</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
