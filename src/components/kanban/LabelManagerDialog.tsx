import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEtiquetas, useEtiquetaMutations } from "./hooks/useEtiquetasMembros";
import type { Etiqueta } from "./lib/types";
import { useConfirm } from "@/components/ui/confirm-dialog";

export const ETIQUETA_CORES: { value: string; label: string }[] = [
  { value: "bg-primary/10 text-primary border-primary/20", label: "Verde" },
  { value: "bg-accent/10 text-accent border-accent/20", label: "Âmbar" },
  { value: "bg-info/10 text-info border-info/20", label: "Azul" },
  { value: "bg-warning/10 text-warning border-warning/20", label: "Laranja" },
  { value: "bg-destructive/10 text-destructive border-destructive/20", label: "Vermelho" },
  { value: "bg-success/10 text-success border-success/20", label: "Sucesso" },
  { value: "bg-muted text-foreground border-border", label: "Neutro" },
];

const CATEGORIAS: Etiqueta["categoria"][] = ["banco", "urgencia", "tipo", "livre"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string | null;
}

export function LabelManagerDialog({ open, onOpenChange, orgId }: Props) {
  const q = useEtiquetas(orgId);
  const m = useEtiquetaMutations(orgId);
  const [novoNome, setNovoNome] = useState("");
  const [novoCor, setNovoCor] = useState(ETIQUETA_CORES[0].value);
  const [novoCat, setNovoCat] = useState<Etiqueta["categoria"]>("livre");

  const criar = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    m.create.mutate({ nome, cor: novoCor, categoria: novoCat }, {
      onSuccess: () => setNovoNome(""),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar etiquetas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Lista */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {q.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma etiqueta criada ainda.</p>
            )}
            {q.data?.map((et) => (
              <EtiquetaRow
                key={et.id}
                etiqueta={et}
                onSave={(patch) => m.update.mutate({ id: et.id, patch })}
                onDelete={() => m.remove.mutate(et.id)}
              />
            ))}
          </div>

          {/* Criar */}
          <div className="border-t border-border pt-3 space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Nova etiqueta
            </Label>
            <div className="flex gap-2">
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome da etiqueta"
                className="flex-1"
              />
              <Select value={novoCat} onValueChange={(v) => setNovoCat(v as Etiqueta["categoria"])}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ETIQUETA_CORES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setNovoCor(c.value)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${c.value} ${
                    novoCor === c.value ? "ring-2 ring-offset-1 ring-primary" : ""
                  }`}
                  type="button"
                  aria-label={c.label}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={criar} disabled={!novoNome.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EtiquetaRow({
  etiqueta,
  onSave,
  onDelete,
}: {
  etiqueta: Etiqueta;
  onSave: (patch: Partial<Etiqueta>) => void;
  onDelete: () => void;
}) {
  const [nome, setNome] = useState(etiqueta.nome);
  const [cor, setCor] = useState(etiqueta.cor);
  const dirty = nome !== etiqueta.nome || cor !== etiqueta.cor;
  const askConfirm = useConfirm();
  return (
    <div className="flex items-center gap-2 border border-border rounded-lg p-2">
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="h-8 text-sm flex-1"
      />
      <Select value={cor} onValueChange={setCor}>
        <SelectTrigger className="w-32 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ETIQUETA_CORES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              <span className={`px-1.5 py-0.5 rounded border text-[10px] ${c.value}`}>
                {c.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {dirty && (
        <button
          onClick={() => onSave({ nome, cor })}
          className="text-primary hover:opacity-80"
          aria-label="Salvar"
        >
          <Check className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={async () => {
          if (await askConfirm({ title: "Excluir etiqueta", description: "Será removida de todos os cards.", destructive: true, confirmText: "Excluir" })) {
            onDelete();
          }
        }}
        className="text-muted-foreground/60 hover:text-destructive"
        aria-label="Excluir"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}