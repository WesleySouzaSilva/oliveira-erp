import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";

interface FeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    nota: number; comentario: string; tipo: string; periodo_referencia: string;
    contexto: string; acao_esperada: string; prazo_revisao: string;
  }) => void;
  loading?: boolean;
}

export function FeedbackForm({ open, onOpenChange, onSubmit, loading }: FeedbackFormProps) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [tipo, setTipo] = useState("desempenho");
  const [periodo, setPeriodo] = useState("");
  const [contexto, setContexto] = useState("");
  const [acaoEsperada, setAcaoEsperada] = useState("");
  const [prazoRevisao, setPrazoRevisao] = useState("");

  const handleSubmit = () => {
    if (nota === 0 || !comentario.trim()) return;
    onSubmit({
      nota, comentario, tipo, periodo_referencia: periodo,
      contexto, acao_esperada: acaoEsperada, prazo_revisao: prazoRevisao,
    });
    setNota(0); setComentario(""); setTipo("desempenho"); setPeriodo("");
    setContexto(""); setAcaoEsperada(""); setPrazoRevisao("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nota</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} type="button" onClick={() => setNota(v)}>
                  <Star className={`w-6 h-6 cursor-pointer transition-colors ${v <= nota ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30 hover:text-yellow-300"}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tipo</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desempenho">Desempenho</SelectItem>
                  <SelectItem value="comportamental">Comportamental</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Período</label>
              <Input placeholder="Ex: Q1 2026" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Contexto</label>
            <Textarea rows={2} placeholder="Situação que motivou o feedback..." value={contexto} onChange={(e) => setContexto(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Textarea rows={3} placeholder="Descreva o feedback detalhadamente..." value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Ação Esperada</label>
            <Textarea rows={2} placeholder="O que se espera do colaborador..." value={acaoEsperada} onChange={(e) => setAcaoEsperada(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Prazo de Revisão</label>
            <Input type="date" value={prazoRevisao} onChange={(e) => setPrazoRevisao(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={loading || nota === 0 || !comentario.trim()} className="w-full">
            {loading ? "Salvando..." : "Registrar Feedback"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
