import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TIPOS_ATIVIDADE, type Lead, type Atividade } from "@/hooks/useComercial";

const TIPO_LABEL: Record<string, string> = {
  ligacao: "Ligação",
  reuniao_video: "Reunião por Vídeo",
  reuniao_presencial: "Reunião Presencial",
  email: "E-mail",
  whatsapp: "WhatsApp",
  follow_up: "Follow-up",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (data: Partial<Atividade>) => void;
  leads: Lead[];
}

export function AtividadeFormDialog({ open, onOpenChange, onSave, leads }: Props) {
  const [leadId, setLeadId] = useState("");
  const [tipo, setTipo] = useState("ligacao");
  const [descricao, setDescricao] = useState("");
  const [resultado, setResultado] = useState("");
  const [duracao, setDuracao] = useState("");

  const handleSubmit = () => {
    if (!leadId) return;
    onSave({
      lead_id: leadId,
      tipo,
      descricao: descricao || null,
      resultado: resultado || null,
      duracao_minutos: duracao ? Number(duracao) : null,
    });
    onOpenChange(false);
    setLeadId(""); setDescricao(""); setResultado(""); setDuracao("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Atividade</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Lead *</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger><SelectValue placeholder="Selecione o lead" /></SelectTrigger>
              <SelectContent>
                {leads.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.nome}{l.empresa ? ` — ${l.empresa}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_ATIVIDADE.map(t => (
                    <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duração (min)</Label>
              <Input type="number" value={duracao} onChange={e => setDuracao(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Resultado</Label>
            <Textarea value={resultado} onChange={e => setResultado(e.target.value)} rows={2} />
          </div>
          <Button onClick={handleSubmit} className="w-full">Registrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
