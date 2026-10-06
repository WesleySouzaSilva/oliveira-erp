import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/oliveira-advogados-horizontal.png";

/** Página aberta ao candidato pelo link. Não pede login e não mostra nada do sistema. */
export default function ProvaPublica() {
  const { token } = useParams();
  const [dados, setDados] = useState<any | null>(null);
  const [erro, setErro] = useState("");
  const [resp, setResp] = useState<Record<string, { alternativa_id?: string; resposta_texto?: string }>>({});
  const [enviando, setEnviando] = useState(false);
  const [fim, setFim] = useState(false);

  const abrir = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("prova-publica", { body: { token, acao: "abrir" } });
    if (error || (data as any)?.error) { setErro("Este link não é válido ou já foi usado."); return; }
    setDados(data);
  }, [token]);
  useEffect(() => { abrir(); }, [abrir]);

  const enviar = async () => {
    const faltam = dados.questoes.filter((q: any) => {
      const r = resp[q.id];
      return q.tipo === "multipla_escolha" ? !r?.alternativa_id : !r?.resposta_texto?.trim();
    });
    if (faltam.length) { toast.error("Responda todas as questões."); return; }
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("prova-publica", {
      body: { token, respostas: dados.questoes.map((q: any) => ({ questao_id: q.id, ...resp[q.id] })) },
    });
    setEnviando(false);
    if (error || (data as any)?.error) { toast.error("Não foi possível enviar as respostas."); return; }
    setFim(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <img src={logo} alt="Oliveira Advogados" className="h-10 w-auto" />
          <p className="text-sm text-muted-foreground">Se é Agro, começa aqui</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        {erro && <p className="text-sm text-muted-foreground">{erro}</p>}
        {!erro && !dados && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {dados && fim && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-2">
            <h1 className="font-serif text-2xl">Respostas enviadas</h1>
            <p className="text-sm text-muted-foreground">Obrigado por participar. O retorno sobre o processo é dado pela equipe que fez o convite.</p>
          </div>
        )}

        {dados && !fim && (
          <>
            <div className="space-y-1">
              <h1 className="font-serif text-2xl">{dados.prova.titulo}</h1>
              {dados.candidato_nome && <p className="text-sm text-muted-foreground">Candidato: {dados.candidato_nome}</p>}
              {dados.prova.descricao && <p className="text-sm text-muted-foreground">{dados.prova.descricao}</p>}
              {dados.prova.tempo_limite_min && <p className="text-sm text-muted-foreground">Tempo sugerido: {dados.prova.tempo_limite_min} minutos.</p>}
            </div>

            <section className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Aviso de privacidade</p>
              <p>
                Esta prova é aplicada por Oliveira Advogados apenas para avaliar candidatos em processo de contratação.
                Guardamos seu nome, contato e respostas pelo prazo definido para esta prova (em regra, 180 dias) e
                depois apagamos os dados que identificam você.
              </p>
              <p>Para pedir a exclusão antes disso, responda a mensagem de quem enviou este link.</p>
            </section>

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
            <Button onClick={enviar} disabled={enviando}>Enviar respostas</Button>
          </>
        )}
      </main>
    </div>
  );
}
