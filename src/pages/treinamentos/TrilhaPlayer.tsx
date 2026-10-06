import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, Circle, ExternalLink, FileQuestion, FileText } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useUsuarioEfetivo } from "@/lib/verComo";
import { db, embedVideo, fmtData, sanitizeHtml, STATUS_ATRIB, Trilha, urlAssinada } from "@/lib/treinamentos";

type Sel = { tipo: "aula"; id: string } | { tipo: "quiz"; id: string } | null;

export default function TrilhaPlayer() {
  const { id } = useParams();
  const { user, somenteLeitura } = useUsuarioEfetivo();
  const [t, setT] = useState<Trilha | null>(null);
  const [mods, setMods] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [quests, setQuests] = useState<any[]>([]);
  const [prog, setProg] = useState<any[]>([]);
  const [tent, setTent] = useState<any[]>([]);
  const [atrib, setAtrib] = useState<any | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [arquivoUrl, setArquivoUrl] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<any | null>(null);
  const [resp, setResp] = useState<Record<string, number>>({});
  const [resultado, setResultado] = useState<any | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    const { data: tr } = await db.from("trein_trilhas").select("*").eq("id", id).maybeSingle();
    if (!tr) { setErro(true); return; }
    setT(tr);
    const [{ data: m }, { data: a }, { data: q }, { data: p }, { data: te }, { data: at }] = await Promise.all([
      db.from("trein_modulos").select("*").eq("trilha_id", id).order("ordem"),
      db.from("trein_aulas").select("*").eq("trilha_id", id).order("ordem"),
      db.from("trein_questionarios").select("*").eq("trilha_id", id),
      db.from("trein_aula_progresso").select("*").eq("trilha_id", id).eq("user_id", user.id),
      db.from("trein_tentativas").select("questionario_id,nota,criado_em").eq("trilha_id", id).eq("user_id", user.id),
      db.from("trein_atribuicoes").select("*").eq("trilha_id", id).eq("user_id", user.id).maybeSingle(),
    ]);
    setMods(m || []); setAulas(a || []); setQuests(q || []); setProg(p || []); setTent(te || []); setAtrib(at);
  }, [id, user?.id]);
  useEffect(() => { carregar(); }, [carregar]);

  const ordem = useMemo(() => mods.flatMap((m) => [
    ...aulas.filter((a) => a.modulo_id === m.id).map((a) => ({ tipo: "aula" as const, id: a.id })),
    ...quests.filter((q) => q.modulo_id === m.id).map((q) => ({ tipo: "quiz" as const, id: q.id })),
  ]), [mods, aulas, quests]);

  useEffect(() => {
    if (sel || !ordem.length) return;
    const prox = ordem.find((o) => o.tipo === "aula" && !prog.find((p) => p.aula_id === o.id && p.concluida_em));
    setSel(prox || ordem[0]);
  }, [ordem, prog, sel]);

  const aula = sel?.tipo === "aula" ? aulas.find((a) => a.id === sel.id) : null;
  const questSel = sel?.tipo === "quiz" ? quests.find((q) => q.id === sel.id) : null;
  const inicio = atrib?.reiniciada_em || "1970-01-01";
  const melhor = (qid: string) => {
    const ns = tent.filter((x) => x.questionario_id === qid && x.criado_em >= inicio).map((x) => Number(x.nota));
    return ns.length ? Math.max(...ns) : null;
  };
  const feita = (aid: string) => !!prog.find((p) => p.aula_id === aid && p.concluida_em);

  useEffect(() => {
    setArquivoUrl(null);
    if (aula?.storage_path) urlAssinada(aula.storage_path).then(setArquivoUrl).catch(() => toast.error("Não foi possível abrir o arquivo."));
  }, [aula?.id, aula?.storage_path]);

  useEffect(() => {
    setQuiz(null); setResp({}); setResultado(null);
    if (questSel) db.rpc("trein_quiz_perguntas", { _questionario: questSel.id }).then(({ data }: any) => setQuiz(data));
  }, [questSel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const marcar = async (concluida: boolean, checklist?: number[]) => {
    if (!aula) return;
    const existente = prog.find((p) => p.aula_id === aula.id);
    const row: any = { concluida_em: concluida ? new Date().toISOString() : null };
    if (checklist) row.checklist_marcados = checklist;
    const { error } = existente
      ? await db.from("trein_aula_progresso").update(row).eq("id", existente.id)
      : await db.from("trein_aula_progresso").insert({ ...row, aula_id: aula.id, trilha_id: aula.trilha_id, organizacao_id: aula.organizacao_id, user_id: user!.id });
    if (error) { toast.error("Não foi possível salvar o progresso."); return; }
    await carregar();
    if (concluida && !checklist) {
      const i = ordem.findIndex((o) => o.id === aula.id);
      if (ordem[i + 1]) setSel(ordem[i + 1]);
    }
  };

  const toggleItem = (idx: number) => {
    const atual: number[] = prog.find((p) => p.aula_id === aula.id)?.checklist_marcados || [];
    const novo = atual.includes(idx) ? atual.filter((x) => x !== idx) : [...atual, idx];
    marcar(novo.length === (aula.checklist_itens || []).length, novo);
  };

  const enviarQuiz = async () => {
    if (!quiz || Object.keys(resp).length < quiz.perguntas.length) { toast.error("Responda todas as perguntas."); return; }
    const { data, error } = await db.rpc("trein_quiz_responder", { _questionario: questSel.id, _respostas: resp });
    if (error) { toast.error("Não foi possível enviar as respostas."); return; }
    setResultado(data); carregar();
  };

  if (erro) return <AppLayout><p className="p-6 text-sm text-muted-foreground">Trilha não encontrada ou sem acesso.</p></AppLayout>;
  if (!t) return <AppLayout><p className="p-6 text-sm text-muted-foreground">Carregando...</p></AppLayout>;

  const totAulas = aulas.length;
  const pct = atrib?.status === "concluida" ? 100 : totAulas ? Math.round((aulas.filter((a) => feita(a.id)).length / totAulas) * 100) : 0;
  const video = aula?.tipo === "video_link" ? embedVideo(aula.url || "") : null;

  return (
    <AppLayout>
      <PageHeader title={t.titulo} subtitle={t.descricao || undefined} backTo="/treinamentos" />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex justify-between text-xs"><span>{STATUS_ATRIB[atrib?.status || "pendente"].label}</span><span>{pct}%</span></div>
            <Progress value={pct} />
            {atrib?.prazo_em && atrib.status !== "concluida" && <p className="text-xs text-muted-foreground">Prazo: {fmtData(atrib.prazo_em)}</p>}
          </div>
          <nav className="rounded-lg border border-border bg-card p-2 space-y-3" aria-label="Conteúdo da trilha">
            {mods.map((m, mi) => (
              <div key={m.id}>
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Módulo {mi + 1}: {m.titulo}</p>
                {aulas.filter((a) => a.modulo_id === m.id).map((a) => (
                  <button key={a.id} onClick={() => setSel({ tipo: "aula", id: a.id })}
                    className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${sel?.id === a.id ? "bg-primary/10" : "hover:bg-muted"}`}>
                    {feita(a.id) ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className="flex-1">{a.titulo}</span>
                    {a.minutos_estimados && <span className="text-xs text-muted-foreground">{a.minutos_estimados} min</span>}
                  </button>
                ))}
                {quests.filter((q) => q.modulo_id === m.id).map((q) => {
                  const b = melhor(q.id);
                  return (
                    <button key={q.id} onClick={() => setSel({ tipo: "quiz", id: q.id })}
                      className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${sel?.id === q.id ? "bg-primary/10" : "hover:bg-muted"}`}>
                      {b != null && b >= q.nota_minima ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <FileQuestion className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1">Questionário</span>
                      {b != null && <span className="text-xs text-muted-foreground">{String(b).replace(".", ",")}%</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="rounded-lg border border-border bg-card p-4 space-y-4 min-h-[400px]">
          {aula && (
            <>
              <h2 className="font-serif text-2xl">{aula.titulo}</h2>
              {video && <iframe title={aula.titulo} src={video} className="w-full aspect-video rounded" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />}
              {aula.tipo === "video_link" && !video && <a className="text-primary underline" href={aula.url} target="_blank" rel="noreferrer">Abrir vídeo</a>}
              {aula.tipo === "video_arquivo" && arquivoUrl && <video src={arquivoUrl} controls className="w-full rounded" />}
              {aula.tipo === "documento" && arquivoUrl && (
                <div className="space-y-2">
                  {aula.storage_path.toLowerCase().endsWith(".pdf") && <iframe title={aula.titulo} src={arquivoUrl} className="w-full h-[70vh] rounded border border-border" />}
                  <Button variant="outline" asChild><a href={arquivoUrl} target="_blank" rel="noreferrer"><FileText className="w-4 h-4 mr-1" />Abrir documento</a></Button>
                </div>
              )}
              {aula.tipo === "link" && <Button variant="outline" asChild><a href={aula.url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1" />Abrir link</a></Button>}
              {aula.conteudo_html && <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(aula.conteudo_html) }} />}
              {aula.conteudo_md && <div className="prose prose-sm max-w-none"><ReactMarkdown>{aula.conteudo_md}</ReactMarkdown></div>}
              {aula.prova_de_saida && (
                <div className="rounded-md border border-accent/50 bg-accent/10 p-3">
                  <p className="text-sm font-medium mb-1">Prova de saída</p>
                  <div className="prose prose-sm max-w-none"><ReactMarkdown>{aula.prova_de_saida}</ReactMarkdown></div>
                </div>
              )}
              {aula.tipo === "checklist" && (
                <ul className="space-y-2">
                  {(aula.checklist_itens || []).map((it: string, i: number) => {
                    const marc = (prog.find((p) => p.aula_id === aula.id)?.checklist_marcados || []).includes(i);
                    return <li key={i} className="flex items-center gap-2"><Checkbox id={`ck-${i}`} checked={marc} onCheckedChange={() => toggleItem(i)} /><Label htmlFor={`ck-${i}`} className="font-normal">{it}</Label></li>;
                  })}
                </ul>
              )}
              {aula.tipo !== "checklist" && (
                <div className="pt-2">
                  {feita(aula.id)
                    ? <Button variant="outline" onClick={() => marcar(false)} disabled={somenteLeitura}>Marcar como não concluída</Button>
                    : <Button onClick={() => marcar(true)} disabled={somenteLeitura}><CheckCircle2 className="w-4 h-4 mr-1" />Concluir aula</Button>}
                </div>
              )}
            </>
          )}

          {questSel && (
            <>
              <h2 className="font-serif text-2xl">Questionário</h2>
              <p className="text-sm text-muted-foreground">Nota mínima: {questSel.nota_minima}%. Tentativas ilimitadas, vale a melhor nota{melhor(questSel.id) != null ? ` (sua melhor: ${String(melhor(questSel.id)).replace(".", ",")}%)` : ""}.</p>
              {quiz?.perguntas?.map((p: any, i: number) => (
                <div key={p.id} className="space-y-2">
                  <p className="font-medium">{i + 1}. {p.enunciado}</p>
                  <RadioGroup value={resp[p.id] != null ? String(resp[p.id]) : ""} onValueChange={(v) => setResp({ ...resp, [p.id]: Number(v) })}>
                    {(p.alternativas || []).map((alt: string, j: number) => (
                      <div key={j} className="flex items-center gap-2"><RadioGroupItem id={`${p.id}-${j}`} value={String(j)} /><Label htmlFor={`${p.id}-${j}`} className="font-normal">{alt}</Label></div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
              {quiz && !quiz.perguntas?.length && <p className="text-sm text-muted-foreground">Este questionário ainda não tem perguntas.</p>}
              {resultado && (
                <div className={`rounded-md p-3 text-sm ${resultado.aprovado ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                  {resultado.aprovado ? "Aprovado" : "Ainda não foi desta vez"}: {resultado.certas} de {resultado.total} ({String(resultado.nota).replace(".", ",")}%). Melhor nota: {String(resultado.melhor).replace(".", ",")}%.
                </div>
              )}
              {!!quiz?.perguntas?.length && (
                <Button onClick={enviarQuiz} disabled={somenteLeitura}>{resultado ? "Enviar nova tentativa" : "Enviar respostas"}</Button>
              )}
            </>
          )}
          {!aula && !questSel && <p className="text-sm text-muted-foreground">Esta trilha ainda não tem aulas.</p>}
        </main>
      </div>
    </AppLayout>
  );
}
