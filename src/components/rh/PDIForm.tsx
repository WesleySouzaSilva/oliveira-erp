import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PDIFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { objetivo: string; competencia: string; acao_pratica: string; prazo: string; status: string; evidencia_evolucao: string }) => void;
  loading?: boolean;
  initial?: any | null;
}

export function PDIForm({ open, onOpenChange, onSubmit, loading, initial }: PDIFormProps) {
  const [objetivo, setObjetivo] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [acaoPratica, setAcaoPratica] = useState("");
  const [prazo, setPrazo] = useState("");
  const [status, setStatus] = useState("em_andamento");
  const [evidencia, setEvidencia] = useState("");

  useEffect(() => {
    if (initial) {
      setObjetivo(initial.objetivo || "");
      setCompetencia(initial.competencia || "");
      setAcaoPratica(initial.acao_pratica || "");
      setPrazo(initial.prazo || "");
      setStatus(initial.status || "em_andamento");
      setEvidencia(initial.evidencia_evolucao || "");
    } else {
      setObjetivo(""); setCompetencia(""); setAcaoPratica(""); setPrazo(""); setStatus("em_andamento"); setEvidencia("");
    }
  }, [initial, open]);

  const handleSubmit = () => {
    if (!objetivo.trim()) return;
    onSubmit({ objetivo, competencia, acao_pratica: acaoPratica, prazo, status, evidencia_evolucao: evidencia });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar PDI" : "Novo PDI"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Objetivo de Desenvolvimento</label>
            <Input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ex: Desenvolver liderança" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Competência a Desenvolver</label>
            <Input value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="Ex: Comunicação, Gestão..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Ação Prática</label>
            <Textarea rows={2} value={acaoPratica} onChange={(e) => setAcaoPratica(e.target.value)} placeholder="O que fazer para atingir o objetivo..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Prazo</label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          {initial && (
            <>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Evidência de Evolução</label>
                <Textarea rows={2} value={evidencia} onChange={(e) => setEvidencia(e.target.value)} placeholder="Resultados observados..." />
              </div>
            </>
          )}
          <Button onClick={handleSubmit} disabled={loading || !objetivo.trim()} className="w-full">
            {loading ? "Salvando..." : initial ? "Salvar Alterações" : "Criar PDI"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
