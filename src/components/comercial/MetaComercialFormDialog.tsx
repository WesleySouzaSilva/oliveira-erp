import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TIPOS_META, type MetaComercial } from "@/hooks/useComercial";
import type { OrgMember } from "@/hooks/useOrgMembers";

const TIPO_META_LABEL: Record<string, string> = {
  leads: "Leads",
  reunioes: "Reuniões",
  propostas: "Propostas",
  fechamentos: "Fechamentos",
  receita: "Receita (R$)",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (data: Partial<MetaComercial>) => void;
  members: OrgMember[];
  currentUserId: string;
}

export function MetaComercialFormDialog({ open, onOpenChange, onSave, members, currentUserId }: Props) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoMeta, setTipoMeta] = useState("leads");
  const [valorAlvo, setValorAlvo] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState(new Date().toISOString().split("T")[0]);
  const [periodoFim, setPeriodoFim] = useState("");
  const [responsavelId, setResponsavelId] = useState(currentUserId);

  const handleSubmit = () => {
    if (!titulo.trim() || !valorAlvo || !periodoFim) return;
    onSave({
      titulo,
      descricao: descricao || null,
      tipo_meta: tipoMeta,
      valor_alvo: Number(valorAlvo),
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      responsavel_id: responsavelId,
    });
    onOpenChange(false);
    setTitulo(""); setDescricao(""); setValorAlvo(""); setPeriodoFim("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Meta Comercial</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: 50 leads qualificados" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de Meta</Label>
              <Select value={tipoMeta} onValueChange={setTipoMeta}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_META.map(t => (
                    <SelectItem key={t} value={t}>{TIPO_META_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor Alvo *</Label>
              <Input type="number" value={valorAlvo} onChange={e => setValorAlvo(e.target.value)} placeholder="Ex: 50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim *</Label>
              <Input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} />
          </div>
          <Button onClick={handleSubmit} className="w-full">Criar Meta</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
