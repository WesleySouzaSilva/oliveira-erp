import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Reuniao1on1FormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    data_reuniao: string; pauta: string; anotacoes: string; proximos_passos: string;
    vitorias: string; dificuldades: string; prazo_revisao: string;
    resumo_visivel_colaborador: string; nota_interna_admin: string;
  }) => void;
  loading?: boolean;
  isAdmin?: boolean;
  initial?: any | null;
}

export function Reuniao1on1Form({ open, onOpenChange, onSubmit, loading, isAdmin, initial }: Reuniao1on1FormProps) {
  const [dataReuniao, setDataReuniao] = useState("");
  const [pauta, setPauta] = useState("");
  const [anotacoes, setAnotacoes] = useState("");
  const [proximosPassos, setProximosPassos] = useState("");
  const [vitorias, setVitorias] = useState("");
  const [dificuldades, setDificuldades] = useState("");
  const [prazoRevisao, setPrazoRevisao] = useState("");
  const [resumoVisivel, setResumoVisivel] = useState("");
  const [notaInterna, setNotaInterna] = useState("");

  useEffect(() => {
    if (open) {
      setDataReuniao(initial?.data_reuniao || "");
      setPauta(initial?.pauta || "");
      setAnotacoes(initial?.anotacoes || "");
      setProximosPassos(initial?.proximos_passos || "");
      setVitorias(initial?.vitorias || "");
      setDificuldades(initial?.dificuldades || "");
      setPrazoRevisao(initial?.prazo_revisao || "");
      setResumoVisivel(initial?.resumo_visivel_colaborador || "");
      setNotaInterna(initial?.nota_interna_admin || "");
    }
  }, [open, initial]);

  const handleSubmit = () => {
    if (!dataReuniao) return;
    onSubmit({
      data_reuniao: dataReuniao, pauta, anotacoes, proximos_passos: proximosPassos,
      vitorias, dificuldades, prazo_revisao: prazoRevisao,
      resumo_visivel_colaborador: resumoVisivel, nota_interna_admin: notaInterna,
    });
    setDataReuniao(""); setPauta(""); setAnotacoes(""); setProximosPassos("");
    setVitorias(""); setDificuldades(""); setPrazoRevisao(""); setResumoVisivel(""); setNotaInterna("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Reunião 1:1" : "Nova Reunião 1:1"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Data da Reunião</label>
              <Input type="date" value={dataReuniao} onChange={(e) => setDataReuniao(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Prazo de Revisão</label>
              <Input type="date" value={prazoRevisao} onChange={(e) => setPrazoRevisao(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Pauta / Pontos Discutidos</label>
            <Textarea rows={2} placeholder="Tópicos discutidos..." value={pauta} onChange={(e) => setPauta(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Vitórias</label>
              <Textarea rows={2} placeholder="Conquistas..." value={vitorias} onChange={(e) => setVitorias(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Dificuldades</label>
              <Textarea rows={2} placeholder="Desafios..." value={dificuldades} onChange={(e) => setDificuldades(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Próximos Passos</label>
            <Textarea rows={2} placeholder="Ações definidas..." value={proximosPassos} onChange={(e) => setProximosPassos(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Resumo Visível ao Colaborador</label>
            <Textarea rows={2} placeholder="O que o colaborador poderá ver..." value={resumoVisivel} onChange={(e) => setResumoVisivel(e.target.value)} />
          </div>
          {isAdmin && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nota Interna (só admin)</label>
              <Textarea rows={2} placeholder="Anotações confidenciais..." value={notaInterna} onChange={(e) => setNotaInterna(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Anotações Gerais</label>
            <Textarea rows={2} placeholder="Anotações da reunião..." value={anotacoes} onChange={(e) => setAnotacoes(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={loading || !dataReuniao} className="w-full">
            {loading ? "Salvando..." : "Registrar Reunião"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
