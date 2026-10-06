import { useState } from "react";
import { Clock, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRAZO_OPTIONS, FASE_TASK_TITLES } from "@/hooks/useWorkflowTasks";

interface PrazoFaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fase: number;
  nomeCliente: string;
  members: { user_id: string; nome: string | null; papel: string }[];
  currentResponsavel?: string;
  onConfirm: (prazoDias: number, responsavelId: string, dataCustom?: string) => Promise<void>;
}

export function PrazoFaseDialog({
  open,
  onOpenChange,
  fase,
  nomeCliente,
  members,
  currentResponsavel,
  onConfirm,
}: PrazoFaseDialogProps) {
  const options = PRAZO_OPTIONS[fase] || [{ label: "Padrão (15 dias)", dias: 15 }];
  const [selectedPrazo, setSelectedPrazo] = useState(options[0]?.dias || 15);
  const [responsavelId, setResponsavelId] = useState(currentResponsavel || "");
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [saving, setSaving] = useState(false);

  const calculatedDate = format(addDays(new Date(), selectedPrazo), "dd/MM/yyyy");

  const handleConfirm = async () => {
    if (!responsavelId) return;
    setSaving(true);
    await onConfirm(
      selectedPrazo,
      responsavelId,
      useCustomDate && customDate ? customDate : undefined
    );
    setSaving(false);
    onOpenChange(false);
  };

  const faseLabels: Record<number, { icon: string; color: string }> = {
    1: { icon: "📋", color: "bg-muted" },
    2: { icon: "📨", color: "bg-accent/10" },
    3: { icon: "🏦", color: "bg-info/10" },
    4: { icon: "⚖️", color: "bg-destructive/10" },
  };

  const faseInfo = faseLabels[fase] || { icon: "📋", color: "bg-muted" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span>{faseInfo.icon}</span>
            Definir Prazo — Fase {fase}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Task preview */}
          <div className={`rounded-lg p-3 ${faseInfo.color} border border-border`}>
            <p className="text-xs text-muted-foreground mb-1">Tarefa que será criada:</p>
            <p className="text-sm font-semibold text-foreground">
              {FASE_TASK_TITLES[fase] || `FASE ${fase}`} — {nomeCliente}
            </p>
          </div>

          {/* Prazo selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              Prazo
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt) => (
                <button
                  key={opt.dias}
                  onClick={() => {
                    setSelectedPrazo(opt.dias);
                    setUseCustomDate(false);
                  }}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    selectedPrazo === opt.dias && !useCustomDate
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-foreground hover:border-accent/30"
                  }`}
                >
                  <span className="block">{opt.dias} dia{opt.dias > 1 ? "s" : ""}</span>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    {opt.dias <= 3 ? "⚡ Urgente" : opt.dias <= 5 ? "🔶 Rápido" : "📅 Normal"}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom date option (phases 3 and 4) */}
            {(fase === 3 || fase === 4) && (
              <div className="mt-2">
                <button
                  onClick={() => setUseCustomDate(!useCustomDate)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                    useCustomDate
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/30"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
                  Definir data personalizada
                </button>
                {useCustomDate && (
                  <Input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="mt-2"
                    min={format(new Date(), "yyyy-MM-dd")}
                  />
                )}
              </div>
            )}

            {!useCustomDate && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Vencimento: <strong>{calculatedDate}</strong>
              </p>
            )}
          </div>

          {/* Responsible */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Responsável pela tarefa</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.nome || "Sem nome"} ({m.papel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Warning for phase 4 */}
          {fase === 4 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">
                <strong>Atenção:</strong> O prazo de 15 dias para protocolar a ação judicial é
                improrrogável. A não observância pode prejudicar os direitos do produtor.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !responsavelId}
            className="bg-accent text-accent-foreground"
          >
            {saving ? (
              "Criando..."
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Confirmar e criar tarefa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
