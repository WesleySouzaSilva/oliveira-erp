import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CurrencyInput } from "@/components/CurrencyInput";
import { fmt } from "@/hooks/useMetricasCalc";
import { toast } from "sonner";
import {
  Trophy, Trash2, DollarSign, Target, Users, Handshake, Check, Loader2,
} from "lucide-react";

type Realizado = { receita: number; contratos: number; qualif: number; reunioes: number };

interface Props {
  m: any;
  nome: string;
  real?: Realizado;
  onSave: (id: string, patch: Record<string, any>) => Promise<void> | void;
  onRemove: (id: string) => void;
}

/**
 * Card de meta individual com edição local + debounce.
 * Evita o bug de "input que reseta" causado por salvar a cada tecla.
 * Salva 700ms após o último ajuste, ou imediatamente no blur.
 */
export function MetaIndividualCard({ m, nome, real, onSave, onRemove }: Props) {
  const storageKey = `meta-individual-pending::${m.id}`;

  // Carrega rascunho pendente do localStorage (sobrevive a refresh da aba)
  const loadPending = (): Record<string, any> => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };
  const initialPending = loadPending();
  const hasInitialPending = Object.keys(initialPending).length > 0;

  const [draft, setDraft] = useState<any>({ ...m, ...initialPending });
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved">(
    hasInitialPending ? "dirty" : "idle",
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Record<string, any>>(initialPending);
  const didMountFlush = useRef(false);

  const persistPending = () => {
    try {
      if (Object.keys(pendingPatch.current).length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(pendingPatch.current));
      }
    } catch {
      /* storage indisponível — ignorar */
    }
  };

  // Re-sincroniza apenas quando trocar de meta (id) ou quando o servidor confirmar updated_at
  useEffect(() => {
    const pending = loadPending();
    setDraft({ ...m, ...pending });
    pendingPatch.current = pending;
    if (Object.keys(pending).length > 0) setStatus("dirty");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id, m.updated_at]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  // Ao montar, se já existir patch pendente vindo de uma aba anterior, salvar automaticamente
  useEffect(() => {
    if (didMountFlush.current) return;
    didMountFlush.current = true;
    if (hasInitialPending) {
      toast.info("Retomando alterações não salvas…");
      flush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Avisar antes de sair se ainda houver edição pendente
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  const flush = async () => {
    if (Object.keys(pendingPatch.current).length === 0) return;
    const patch = { ...pendingPatch.current };
    setStatus("saving");
    try {
      await onSave(m.id, patch);
      pendingPatch.current = {};
      persistPending();
      setStatus("saved");
      toast.success("Meta salva", { duration: 1500 });
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setStatus("idle"), 1500);
    } catch (err: any) {
      setStatus("dirty");
      toast.error("Falha ao salvar meta — tentaremos novamente", {
        description: err?.message,
      });
    }
  };

  const queueChange = (patch: Record<string, any>) => {
    setDraft((prev: any) => ({ ...prev, ...patch }));
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    persistPending();
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };

  const handleBlur = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (Object.keys(pendingPatch.current).length > 0) flush();
  };

  const pct = (a: number, mt: number) => (mt > 0 ? Math.min(100, Math.round((a / mt) * 100)) : 0);
  const realReceita = real?.receita || 0;
  const metaTotal = Number(draft.meta_valor_total_contratos) || 0;
  const supermeta = Number(draft.meta_supermeta_valor_total) || 0;
  const pctEntrada = Number(draft.pct_entrada) || 30;
  const metaEntrada = (metaTotal * pctEntrada) / 100;
  let tier: "nao_bateu" | "bateu" | "supermeta" = "nao_bateu";
  if (supermeta > 0 && realReceita >= supermeta) tier = "supermeta";
  else if (metaTotal > 0 && realReceita >= metaTotal) tier = "bateu";
  const tierConfig = {
    supermeta: { label: "Supermeta", color: "bg-primary text-primary-foreground", comissao: draft.comissao_supermeta },
    bateu: { label: "Bateu meta", color: "bg-secondary text-secondary-foreground", comissao: draft.comissao_bateu },
    nao_bateu: { label: "Em progresso", color: "bg-muted text-muted-foreground", comissao: draft.comissao_nao_bateu },
  }[tier];
  const pctReceita = pct(realReceita, metaTotal);

  const StatusBadge = () => {
    if (status === "saving") {
      return (
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> salvando…
        </span>
      );
    }
    if (status === "dirty") {
      return <span className="text-[10px] text-amber-600">edição pendente…</span>;
    }
    if (status === "saved") {
      return (
        <span className="text-[10px] text-success flex items-center gap-1">
          <Check className="w-3 h-3" /> salvo
        </span>
      );
    }
    return null;
  };

  return (
    <Card className="overflow-hidden" onBlur={handleBlur}>
      <CardHeader className="pb-3 bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary shrink-0" />
              {nome}
            </CardTitle>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge className={tierConfig.color}>{tierConfig.label} · {tierConfig.comissao}%</Badge>
              <StatusBadge />
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={() => onRemove(m.id)} aria-label="Remover meta individual">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Progresso receita */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Receita
            </span>
            <span className="font-medium">
              {fmt.brl(realReceita)} / {fmt.brl(metaTotal)}
            </span>
          </div>
          <Progress value={pctReceita} className="h-2" />
          <div className="text-[10px] text-muted-foreground text-right">{pctReceita}%</div>
        </div>

        <Separator />

        {/* Configuração de meta */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Meta total contratos</Label>
            <CurrencyInput
              value={Number(draft.meta_valor_total_contratos) || 0}
              onChange={(v) =>
                queueChange({
                  meta_valor_total_contratos: v || 0,
                  meta_receita: ((v || 0) * (Number(draft.pct_entrada) || 30)) / 100,
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Supermeta</Label>
            <CurrencyInput
              value={Number(draft.meta_supermeta_valor_total) || 0}
              onChange={(v) => queueChange({ meta_supermeta_valor_total: v || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">% Entrada</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.pct_entrada ?? ""}
                onChange={(e) => {
                  const p = parseFloat(e.target.value) || 0;
                  queueChange({
                    pct_entrada: p,
                    meta_receita: (Number(draft.meta_valor_total_contratos) * p) / 100,
                  });
                }}
                className="pr-8"
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Meta entrada (R$)</Label>
            <div className="h-10 px-3 rounded-md border border-input bg-muted/40 flex items-center text-sm">
              {fmt.brl(metaEntrada)}
            </div>
          </div>
        </div>

        <Separator />

        {/* Metas quantitativas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Target className="w-3 h-3" /> Contratos
            </Label>
            <Input
              type="number"
              min={0}
              value={draft.meta_contratos ?? ""}
              onChange={(e) => queueChange({ meta_contratos: parseInt(e.target.value) || 0 })}
            />
            <div className="text-[10px] text-muted-foreground">
              Real: {real?.contratos || 0} ({pct(real?.contratos || 0, draft.meta_contratos)}%)
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Handshake className="w-3 h-3" /> Credenciados
            </Label>
            <Input
              type="number"
              min={0}
              value={draft.meta_credenciados ?? ""}
              onChange={(e) => queueChange({ meta_credenciados: parseInt(e.target.value) || 0 })}
            />
            <div className="text-[10px] text-muted-foreground">Parceiros ativados/mês</div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> Leads qualificados
            </Label>
            <Input
              type="number"
              min={0}
              value={draft.meta_leads_qualificados ?? ""}
              onChange={(e) => queueChange({ meta_leads_qualificados: parseInt(e.target.value) || 0 })}
            />
            <div className="text-[10px] text-muted-foreground">
              Real: {real?.qualif || 0} ({pct(real?.qualif || 0, draft.meta_leads_qualificados)}%)
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Reuniões realizadas</Label>
            <Input
              type="number"
              min={0}
              value={draft.meta_reunioes_realizadas ?? ""}
              onChange={(e) => queueChange({ meta_reunioes_realizadas: parseInt(e.target.value) || 0 })}
            />
            <div className="text-[10px] text-muted-foreground">
              Real: {real?.reunioes || 0} ({pct(real?.reunioes || 0, draft.meta_reunioes_realizadas)}%)
            </div>
          </div>
        </div>

        <Separator />

        {/* Comissões */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">% Não bateu</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={draft.comissao_nao_bateu ?? ""}
              onChange={(e) => queueChange({ comissao_nao_bateu: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">% Bateu</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={draft.comissao_bateu ?? ""}
              onChange={(e) => queueChange({ comissao_bateu: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">% Supermeta</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={draft.comissao_supermeta ?? ""}
              onChange={(e) => queueChange({ comissao_supermeta: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MetaIndividualCard;