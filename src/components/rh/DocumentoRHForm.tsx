import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DocumentoRHFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { nome: string; tipo: string; validade: string; observacoes: string }) => void;
  loading?: boolean;
}

const TIPOS_DOC = [
  { value: "contrato", label: "Contrato" },
  { value: "aditivo", label: "Aditivo" },
  { value: "termo_confidencialidade", label: "Termo de Confidencialidade" },
  { value: "politica_interna", label: "Política Interna" },
  { value: "termo_equipamento", label: "Termo de Equipamento" },
  { value: "advertencia", label: "Advertência" },
  { value: "outros", label: "Outros" },
];

export function DocumentoRHForm({ open, onOpenChange, onSubmit, loading }: DocumentoRHFormProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("outros");
  const [validade, setValidade] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const handleSubmit = () => {
    if (!nome.trim()) return;
    onSubmit({ nome, tipo, validade, observacoes });
    setNome(""); setTipo("outros"); setValidade(""); setObservacoes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nome do Documento</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Contrato de Trabalho" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo</label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_DOC.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Validade</label>
            <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Observações</label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={loading || !nome.trim()} className="w-full">
            {loading ? "Salvando..." : "Registrar Documento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
