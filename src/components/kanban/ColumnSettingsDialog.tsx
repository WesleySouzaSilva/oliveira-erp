import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, Archive, Plus, Save } from "lucide-react";
import type { KanbanColumnDef } from "./lib/types";
import { useColumnMutations } from "./hooks/useKanbanData";

const COLOR_PRESETS = [
  { name: "Cinza",    cor: "bg-muted/40 text-foreground border-border" },
  { name: "Info",     cor: "bg-info/10 text-info border-info/20" },
  { name: "Âmbar",    cor: "bg-accent/10 text-accent border-accent/20" },
  { name: "Aviso",    cor: "bg-warning/10 text-warning border-warning/20" },
  { name: "Destruct", cor: "bg-destructive/10 text-destructive border-destructive/20" },
  { name: "Verde",    cor: "bg-success/10 text-success border-success/20" },
  { name: "Primary",  cor: "bg-primary/10 text-primary border-primary/20" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  columns: KanbanColumnDef[];
  orgId: string | null;
}

export function ColumnSettingsDialog({ open, onOpenChange, columns, orgId }: Props) {
  const mut = useColumnMutations(orgId);
  const [local, setLocal] = useState<KanbanColumnDef[]>([]);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaCor, setNovaCor] = useState(COLOR_PRESETS[0].cor);

  useEffect(() => {
    if (open) {
      setLocal([...columns].filter((c) => !c.arquivada).sort((a, b) => a.ordem - b.ordem));
    }
  }, [open, columns]);

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= local.length) return;
    const next = [...local];
    [next[idx], next[j]] = [next[j], next[idx]];
    setLocal(next);
  };

  const persistOrder = () => mut.reorder.mutate(local);

  const rename = (id: string, titulo: string) =>
    setLocal((arr) => arr.map((c) => (c.id === id ? { ...c, titulo } : c)));

  const recolor = (id: string, cor: string) =>
    setLocal((arr) => arr.map((c) => (c.id === id ? { ...c, cor } : c)));

  const saveOne = (c: KanbanColumnDef) =>
    mut.update.mutate({ id: c.id, patch: { titulo: c.titulo, cor: c.cor } });

  const archive = (id: string) => mut.archive.mutate(id);

  const create = () => {
    if (!novoTitulo.trim()) return;
    mut.create.mutate({ titulo: novoTitulo.trim(), cor: novaCor });
    setNovoTitulo("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar colunas do Kanban</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nova coluna */}
          <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
            <Label className="text-xs font-semibold">Nova coluna</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Título"
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
              />
              <Button size="sm" onClick={create} disabled={!novoTitulo.trim()}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Criar
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setNovaCor(p.cor)}
                  className={`text-[11px] px-2 py-1 rounded border-2 ${p.cor} ${
                    novaCor === p.cor ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Colunas ativas
              </Label>
              <Button size="sm" variant="outline" onClick={persistOrder}>
                Salvar ordem
              </Button>
            </div>
            {local.map((c, i) => (
              <div
                key={c.id}
                className={`border-2 rounded-lg p-2.5 space-y-2 ${c.cor}`}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1 rounded hover:bg-background/40 disabled:opacity-30"
                    aria-label="Mover para cima"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === local.length - 1}
                    className="p-1 rounded hover:bg-background/40 disabled:opacity-30"
                    aria-label="Mover para baixo"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <Input
                    value={c.titulo}
                    onChange={(e) => rename(c.id, e.target.value)}
                    className="h-7 text-sm flex-1 bg-background"
                  />
                  {c.legacy_fase && (
                    <span className="text-[10px] bg-background/70 px-1.5 py-0.5 rounded font-mono">
                      fase {c.legacy_fase}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => saveOne(c)}
                  >
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive"
                    onClick={() => archive(c.id)}
                  >
                    <Archive className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => recolor(c.id, p.cor)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${p.cor} ${
                        c.cor === p.cor ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}