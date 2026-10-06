import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CHAVE_LAUDOS, type EtapaConfig } from "@/lib/radarEtapas";
import { notifyRadarChanged } from "@/hooks/useOperacoesCredito";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: EtapaConfig[];
  onSaved?: () => void;
}

export function EtapasConfigDialog({ open, onOpenChange, config, onSaved }: Props) {
  const [linhas, setLinhas] = useState<EtapaConfig[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) setLinhas(config.map((c) => ({ ...c })));
  }, [open, config]);

  const carteiras = linhas.filter((l) => l.carteira !== CHAVE_LAUDOS);
  const laudos = linhas.find((l) => l.carteira === CHAVE_LAUDOS);

  const atualizar = (id: string, campo: "mapeia" | "protocola", valor: string) =>
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));

  const salvar = async () => {
    setSalvando(true);
    for (const l of linhas) {
      const { error } = await supabase
        .from("radar_etapas_config")
        .update({ mapeia: (l.mapeia || "").trim() || null, protocola: (l.protocola || "").trim() || null, updated_at: new Date().toISOString() })
        .eq("id", l.id);
      if (error) {
        setSalvando(false);
        toast.error("Não foi possível salvar — só administradores podem mudar as etapas.");
        return;
      }
    }
    setSalvando(false);
    toast.success("Etapas atualizadas");
    notifyRadarChanged();
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Etapas da equipe</DialogTitle>
          <DialogDescription>
            Para cada carteira, quem faz o mapeamento e quem protocola o pedido no banco.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-xs font-semibold uppercase text-muted-foreground">
            <span>Carteira</span>
            <span>Quem mapeia</span>
            <span>Quem protocola</span>
          </div>
          {carteiras.map((l) => (
            <div key={l.id} className="grid grid-cols-3 items-center gap-3">
              <span className="text-sm font-semibold">{l.carteira}</span>
              <Input value={l.mapeia || ""} onChange={(e) => atualizar(l.id, "mapeia", e.target.value)} aria-label={`Quem mapeia a carteira ${l.carteira}`} />
              <Input value={l.protocola || ""} onChange={(e) => atualizar(l.id, "protocola", e.target.value)} aria-label={`Quem protocola a carteira ${l.carteira}`} />
            </div>
          ))}

          {laudos && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <Label htmlFor="resp-laudos">Responsável pelos laudos</Label>
              <Input
                id="resp-laudos"
                value={laudos.mapeia || ""}
                onChange={(e) => atualizar(laudos.id, "mapeia", e.target.value)}
                placeholder="Nome de quem cuida dos laudos"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>Salvar etapas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
