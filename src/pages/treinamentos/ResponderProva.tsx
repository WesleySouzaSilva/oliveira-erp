import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { db } from "@/lib/treinamentos";
import { useSomenteLeitura } from "@/lib/verComo";

export default function ResponderProva() {
  const { aplicacaoId } = useParams();
  const [dados, setDados] = useState<any | null>(null);
  const [erro, setErro] = useState("");
  const [resp, setResp] = useState<Record<string, { alternativa_id?: string; resposta_texto?: string }>>({});
  const [enviando, setEnviando] = useState(false);
  const [fim, setFim] = useState<any | null>(null);
  const somenteLeitura = useSomenteLeitura();

  const iniciar = useCallback(async () => {
    // Iniciar a prova grava a tentativa: no modo "ver como" nada é iniciado.
    if (somenteLeitura) { setErro("Modo ver como: somente leitura. A prova não pode ser iniciada."); return; }
    const { data, error } = await db.functions.invoke("prova-iniciar", { body: { aplicacao_id: aplicacaoId } });
    if (error || (data as any)?.error) { setErro((data as any)?.error || "Não foi possível abrir a prova."); return; }
    setDados(data);
  }, [aplicacaoId, somenteLeitura]);
  useEffect(() => { iniciar(); }, [iniciar]);

  const enviar = async () => {
    const faltam = dados.questoes.filter((q: any) => {
      const r = resp[q.id];
      return q.tipo === "multipla_escolha" ? !r?.alternativa_id : !r?.resposta_texto?.trim();
    });
    if (faltam.length) { toast.error("Responda todas as questões."); return; }
    setEnviando(true);
    const { data, error } = await db.functions.invoke("prova-enviar", {
      body: { aplicacao_id: dados.aplicacao.id, respostas: dados.questoes.map((q: any) => ({ questao_id: q.id, ...resp[q.id] })) },
    });
    setEnviando(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || "Não foi possível enviar."); return; }
    setFim(data);
  };

  if (erro) return <AppLayout><p className="p-6 text-sm text-muted-foreground">{erro}</p></AppLayout>;
  if (!dados) return <AppLayout><p className="p-6 text-sm text-muted-foreground">Carregando...</p></AppLayout>;

  return (
    <AppLayout>
      <PageHeader title={dados.prova.titulo} subtitle={dados.prova.descricao || undefined} backTo="/treinamentos" />
      {fim ? (
        <div className="max-w-2xl rounded-lg border border-border bg-card p-6 space-y-2">
          <h2 className="font-serif text-xl">Prova enviada</h2>
          <p className="text-sm text-muted-foreground">
            {fim.aguardando_correcao
              ? "Suas respostas foram enviadas. A liderança vai corrigir as questões escritas e o resultado aparece aqui depois."
              : `Sua nota foi ${String(fim.nota).replace(".", ",")}%.`}
          </p>
        </div>
      ) : (
        <div className="max-w-3xl space-y-4">
          {dados.prova.tempo_limite_min && <p className="text-sm text-muted-foreground">Tempo sugerido: {dados.prova.tempo_limite_min} minutos.</p>}
          {dados.questoes.map((q: any, i: number) => (
            <div key={q.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <p className="font-medium">{i + 1}. {q.enunciado}</p>
              {q.tipo === "multipla_escolha" ? (
                <RadioGroup value={resp[q.id]?.alternativa_id || ""} onValueChange={(v) => setResp({ ...resp, [q.id]: { alternativa_id: v } })}>
                  {q.alternativas.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <RadioGroupItem id={a.id} value={a.id} /><Label htmlFor={a.id} className="font-normal">{a.texto}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea rows={5} aria-label="Sua resposta" value={resp[q.id]?.resposta_texto || ""}
                  onChange={(e) => setResp({ ...resp, [q.id]: { resposta_texto: e.target.value } })} />
              )}
            </div>
          ))}
          <Button onClick={enviar} disabled={enviando || somenteLeitura}>Enviar respostas</Button>
        </div>
      )}
    </AppLayout>
  );
}
