import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ORIGENS, type Lead } from "@/hooks/useComercial";

const ORIGENS_LABEL: Record<string, string> = {
  google: "Google",
  indicacao: "Indicação",
  redes_sociais: "Redes Sociais",
  site: "Site",
  evento: "Evento",
  outro: "Outro",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (data: Partial<Lead>) => void;
  initialData?: Partial<Lead>;
}

export function LeadFormDialog({ open, onOpenChange, onSave, initialData }: Props) {
  const [nome, setNome] = useState(initialData?.nome || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [telefone, setTelefone] = useState(initialData?.telefone || "");
  const [empresa, setEmpresa] = useState(initialData?.empresa || "");
  const [origem, setOrigem] = useState(initialData?.origem || "outro");
  const [valorEstimado, setValorEstimado] = useState(String(initialData?.valor_estimado || ""));
  const [observacoes, setObservacoes] = useState(initialData?.observacoes || "");

  const handleSubmit = () => {
    if (!nome.trim()) return;
    onSave({
      nome,
      email: email || null,
      telefone: telefone || null,
      empresa: empresa || null,
      origem,
      valor_estimado: valorEstimado ? Number(valorEstimado) : 0,
      observacoes: observacoes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Lead" : "Novo Lead"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do contato" />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nome da empresa" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIGENS.map(o => (
                    <SelectItem key={o} value={o}>{ORIGENS_LABEL[o]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor Estimado (R$)</Label>
              <Input type="number" value={valorEstimado} onChange={e => setValorEstimado(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
          </div>
          <Button onClick={handleSubmit} className="w-full">Salvar Lead</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
