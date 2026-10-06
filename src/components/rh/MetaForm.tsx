import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface MetaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { titulo: string; descricao: string; prazo: string; progresso: number; status: string }) => void;
  loading?: boolean;
  initial?: { titulo: string; descricao: string; prazo: string; progresso: number; status: string } | null;
}

export function MetaForm({ open, onOpenChange, onSubmit, loading, initial }: MetaFormProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [status, setStatus] = useState("ativa");

  useEffect(() => {
    if (initial) {
      setTitulo(initial.titulo); setDescricao(initial.descricao); setPrazo(initial.prazo);
      setProgresso(initial.progresso); setStatus(initial.status);
    } else {
      setTitulo(""); setDescricao(""); setPrazo(""); setProgresso(0); setStatus("ativa");
    }
  }, [initial, open]);

  const handleSubmit = () => {
    if (!titulo.trim()) return;
    onSubmit({ titulo, descricao, prazo, progresso, status });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Meta" : "Nova Meta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Certificação PMP" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Prazo</label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Progresso: {progresso}%</label>
            <Slider value={[progresso]} onValueChange={([v]) => setProgresso(v)} max={100} step={5} />
          </div>
          {initial && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={handleSubmit} disabled={loading || !titulo.trim()} className="w-full">
            {loading ? "Salvando..." : initial ? "Salvar Alterações" : "Criar Meta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
