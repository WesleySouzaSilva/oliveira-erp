import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ContratoRHFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { tipo_vinculo: string; regime_trabalho: string; data_inicio: string; data_fim: string; observacoes: string }) => void;
  loading?: boolean;
}

export function ContratoRHForm({ open, onOpenChange, onSubmit, loading }: ContratoRHFormProps) {
  const [tipoVinculo, setTipoVinculo] = useState("CLT");
  const [regime, setRegime] = useState("presencial");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const handleSubmit = () => {
    if (!dataInicio) return;
    onSubmit({ tipo_vinculo: tipoVinculo, regime_trabalho: regime, data_inicio: dataInicio, data_fim: dataFim, observacoes });
    setTipoVinculo("CLT"); setRegime("presencial"); setDataInicio(""); setDataFim(""); setObservacoes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Contrato</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo de Vínculo</label>
            <Select value={tipoVinculo} onValueChange={setTipoVinculo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLT">CLT</SelectItem>
                <SelectItem value="PJ">PJ</SelectItem>
                <SelectItem value="estagio">Estágio</SelectItem>
                <SelectItem value="temporario">Temporário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Regime de Trabalho</label>
            <Select value={regime} onValueChange={setRegime}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="remoto">Remoto</SelectItem>
                <SelectItem value="hibrido">Híbrido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Data de Início</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Data Final (se houver)</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Observações</label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={loading || !dataInicio} className="w-full">
            {loading ? "Salvando..." : "Registrar Contrato"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
