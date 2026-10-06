import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, FileQuestion, Pencil, Plus, Rocket, Trash2, Upload, Youtube } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { db, embedVideo, nomeSetor, setoresEditaveis, Trilha, TIPOS_AULA, usePapelTrein, useSetores } from "@/lib/treinamentos";
import EditorTexto from "./EditorTexto";
import EditorMarkdown from "@/components/treinamentos/EditorMarkdown";

const MAX_VIDEO = 200 * 1024 * 1024;
const MAX_DOC = 20 * 1024 * 1024;

type Aula = any; type Modulo = any; type Quest = any; type Perg = any;
const aulaVazia = { id: "", modulo_id: "", titulo: "", tipo: "video_link", url: "", storage_path: "", conteudo_html: "", conteudo_md: "", prova_de_saida: "", checklist: "", minutos_estimados: "" };

export default function TrilhaEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const papel = usePapelTrein();
  const { setores } = useSetores();
  const [t, setT] = useState<Trilha | null>(null);
  const [mods, setMods] = useState<Modulo[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [pergs, setPergs] = useState<Perg[]>([]);
  const [aulaForm, setAulaForm] = useState<any | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pergForm, setPergForm] = useState<any | null>(null);
  const [publicar, setPublicar] = useState(false);
  const [refazer, setRefazer] = useState(false);
  const [notaVersao, setNotaVersao] = useState("");
  const [excluir, setExcluir] = useState<{ tipo: string; id: string } | null>(null);

  const carregar = useCallback(async () => {
    const { data: tr } = await db.from("trein_trilhas").select("*").eq("id", id).maybeSingle();
    setT(tr);
    if (!tr) return;
    const [{ data: m }, { data: a }, { data: q }, { data: p }] = await Promise.all([
      db.from("trein_modulos").select("*").eq("trilha_id", id).order("ordem"),
      db.from("trein_aulas").select("*").eq("trilha_id", id).order("ordem"),
      db.from("trein_questionarios").select("*").eq("trilha_id", id),
      db.from("trein_perguntas").select("*").eq("trilha_id", id).order("ordem"),
    ]);
    setMods(m || []); setAulas(a || []); setQuests(q || []); setPergs(p || []);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const editaveis = useMemo(() => setoresEditaveis(setores, papel), [setores, papel]);
  const pode = !!t && editaveis.some((s) => s.id === t.setor_id);

  const salvarTrilha = async (patch: Partial<Trilha>) => {
    const { error } = await db.from("trein_trilhas").update(patch).eq("id", id);
    if (error) toast.error("Não foi possível salvar."); else { toast.success("Salvo."); carregar(); }
  };

  const mover = async (tabela: string, lista: any[], idx: number, dir: -1 | 1) => {
    const j = idx + dir; if (j < 0 || j >= lista.length) return;
    const a = lista[idx], b = lista[j];
    await Promise.all([db.from(tabela).update({ ordem: j }).eq("id", a.id), db.from(tabela).update({ ordem: idx }).eq("id", b.id)]);
    // normaliza o restante
    await Promise.all(lista.map((x, k) => (k !== idx && k !== j && x.ordem !== k ? db.from(tabela).update({ ordem: k }).eq("id", x.id) : null)));
    carregar();
  };

  const novoModulo = async () => {
    const titulo = prompt("Nome do módulo");
    if (!titulo?.trim()) return;
    const { error } = await db.from("trein_modulos").insert({ trilha_id: id, titulo: titulo.trim(), ordem: mods.length, organizacao_id: t!.organizacao_id });
    if (error) toast.error("Não foi possível criar o módulo."); else carregar();
  };
  const renomearModulo = async (m: Modulo) => {
    const titulo = prompt("Nome do módulo", m.titulo);
    if (!titulo?.trim()) return;
    await db.from("trein_modulos").update({ titulo: titulo.trim() }).eq("id", m.id); carregar();
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    const tab = { modulo: "trein_modulos", aula: "trein_aulas", pergunta: "trein_perguntas", questionario: "trein_questionarios" }[excluir.tipo]!;
    if (excluir.tipo === "aula") {
      const a = aulas.find((x) => x.id === excluir.id);
      if (a?.storage_path) await db.storage.from("treinamentos").remove([a.storage_path]);
    }
    const { error } = await db.from(tab).delete().eq("id", excluir.id);
    if (error) toast.error("Não foi possível excluir."); setExcluir(null); carregar();
  };

  const enviarArquivo = async (file: File) => {
    const video = aulaForm.tipo === "video_arquivo";
    if (video && !file.type.startsWith("video/")) { toast.error("Escolha um arquivo de vídeo."); return; }
    if (file.size > (video ? MAX_VIDEO : MAX_DOC)) { toast.error(video ? "O vídeo passa de 200 MB. Prefira um link do YouTube (não listado) ou Vimeo." : "O arquivo passa de 20 MB."); return; }
    setEnviando(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${t!.organizacao_id}/${t!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("treinamentos").upload(path, file, { contentType: file.type });
    setEnviando(false);
    if (error) { toast.error("Falha no envio do arquivo."); return; }
    setAulaForm((f: any) => ({ ...f, storage_path: path, nome_arquivo: file.name }));
  };

  const salvarAula = async () => {
    const f = aulaForm;
    if (!f.titulo.trim()) { toast.error("Informe o título da aula."); return; }
    if (f.tipo === "video_link" && !embedVideo(f.url || "")) { toast.error("Cole um link válido do YouTube ou Vimeo."); return; }
    if (f.tipo === "link" && !/^https?:\/\//.test(f.url || "")) { toast.error("Informe um link começando com https://"); return; }
    if ((f.tipo === "video_arquivo" || f.tipo === "documento") && !f.storage_path) { toast.error("Envie o arquivo."); return; }
    const itens = f.tipo === "checklist" ? String(f.checklist).split("\n").map((s: string) => s.trim()).filter(Boolean) : [];
    if (f.tipo === "checklist" && !itens.length) { toast.error("Escreva pelo menos um item do checklist."); return; }
    const row: any = {
      titulo: f.titulo.trim(), tipo: f.tipo, modulo_id: f.modulo_id,
      url: ["video_link", "link"].includes(f.tipo) ? f.url.trim() : null,
      storage_path: ["video_arquivo", "documento"].includes(f.tipo) ? f.storage_path : null,
      conteudo_html: f.conteudo_html || null,
      conteudo_md: f.conteudo_md || null,
      prova_de_saida: f.prova_de_saida || null,
      checklist_itens: itens,
      minutos_estimados: f.minutos_estimados ? parseInt(f.minutos_estimados, 10) : null,
      organizacao_id: t!.organizacao_id, trilha_id: t!.id,
    };
    const q = f.id ? db.from("trein_aulas").update(row).eq("id", f.id)
      : db.from("trein_aulas").insert({ ...row, ordem: aulas.filter((a) => a.modulo_id === f.modulo_id).length });
    const { error } = await q;
    if (error) { toast.error("Não foi possível salvar a aula."); return; }
    setAulaForm(null); carregar();
  };

  const criarQuestionario = async (m: Modulo) => {
    const { error } = await db.from("trein_questionarios").insert({ modulo_id: m.id, nota_minima: 70, organizacao_id: t!.organizacao_id, trilha_id: t!.id });
    if (error) toast.error("Não foi possível criar o questionário."); else carregar();
  };

  const salvarPergunta = async () => {
    const f = pergForm;
    const alts = String(f.alternativas).split("\n").map((s: string) => s.trim()).filter(Boolean);
    if (!f.enunciado.trim() || alts.length < 2) { toast.error("Escreva a pergunta e pelo menos duas alternativas."); return; }
    const correta = Math.min(Math.max(0, Number(f.indice_correto) || 0), alts.length - 1);
    const row = { enunciado: f.enunciado.trim(), alternativas: alts, indice_correto: correta, questionario_id: f.questionario_id, organizacao_id: t!.organizacao_id, trilha_id: t!.id };
    const { error } = f.id ? await db.from("trein_perguntas").update(row).eq("id", f.id)
      : await db.from("trein_perguntas").insert({ ...row, ordem: pergs.filter((p) => p.questionario_id === f.questionario_id).length });
    if (error) { toast.error("Não foi possível salvar a pergunta."); return; }
    setPergForm(null); carregar();
  };

  const confirmarPublicacao = async () => {
    const { data, error } = await db.rpc("trein_publicar", { _trilha: id, _exige_refazer: refazer, _nota: notaVersao || null });
    if (error) { toast.error(error.message.includes("aula") ? "A trilha precisa de pelo menos uma aula." : "Não foi possível publicar."); return; }
    setPublicar(false); setRefazer(false); setNotaVersao("");
    toast.success(`Versão ${data.versao} publicada. ${data.atribuidas} atribuição(ões) nova(s)${data.refazer ? `, ${data.refazer} pessoa(s) precisarão refazer` : ""}.`);
    carregar();
  };

  if (!t) return <AppLayout><p className="text-sm text-muted-foreground p-6">Carregando...</p></AppLayout>;
  if (!papel.carregando && !pode) return <AppLayout><p className="text-sm text-muted-foreground p-6">Você não pode editar esta trilha.</p></AppLayout>;

  const letra = (i: number) => String.fromCharCode(65 + i);

  return (
    <AppLayout>
      <PageHeader title={t.titulo} subtitle={`${nomeSetor(setores, t.setor_id)} · ${t.publicada ? `publicada, versão ${t.versao}` : "rascunho"}`} backTo="/treinamentos?aba=catalogo" />

      <div className="space-y-6 max-w-5xl">
        <section className="rounded-lg border border-border bg-card p-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2"><Label htmlFor="tr-titulo">Título</Label>
            <Input id="tr-titulo" defaultValue={t.titulo} onBlur={(e) => e.target.value.trim() && e.target.value !== t.titulo && salvarTrilha({ titulo: e.target.value.trim() })} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label htmlFor="tr-desc">Descrição</Label>
            <Textarea id="tr-desc" defaultValue={t.descricao || ""} onBlur={(e) => e.target.value !== (t.descricao || "") && salvarTrilha({ descricao: e.target.value || null })} /></div>
          <div className="space-y-1.5"><Label>Setor</Label>
            <Select value={t.setor_id} onValueChange={(v) => salvarTrilha({ setor_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{editaveis.map((s) => <SelectItem key={s.id} value={s.id}>{nomeSetor(setores, s.id)}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="flex items-end gap-4">
            <div className="flex items-center gap-2 pb-2"><Switch id="tr-obr" checked={t.obrigatoria} onCheckedChange={(v) => salvarTrilha({ obrigatoria: v })} /><Label htmlFor="tr-obr">Obrigatória</Label></div>
            {t.obrigatoria && <div className="space-y-1.5 flex-1"><Label htmlFor="tr-prazo">Prazo (dias)</Label>
              <Input id="tr-prazo" type="number" min={1} defaultValue={t.prazo_dias ?? ""} onBlur={(e) => { const n = parseInt(e.target.value, 10); salvarTrilha({ prazo_dias: n > 0 ? n : null }); }} /></div>}
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
            {t.publicada && <Button variant="outline" onClick={() => salvarTrilha({ arquivada: !t.arquivada } as any)}>{t.arquivada ? "Reativar" : "Arquivar"}</Button>}
            <Button onClick={() => setPublicar(true)}><Rocket className="w-4 h-4 mr-1" />{t.publicada ? "Publicar nova versão" : "Publicar"}</Button>
          </div>
          <p className="md:col-span-2 text-xs text-muted-foreground">Alterações em aulas e módulos ficam visíveis na hora para quem já tem acesso. Use "Publicar nova versão" quando a mudança for relevante, para decidir se quem já concluiu precisa refazer.</p>
        </section>

        {mods.map((m, mi) => {
          const q = quests.find((x) => x.modulo_id === m.id);
          const lista = aulas.filter((a) => a.modulo_id === m.id);
          const perguntas = q ? pergs.filter((p) => p.questionario_id === q.id) : [];
          return (
            <section key={m.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg flex-1">Módulo {mi + 1}: {m.titulo}</h3>
                <Button size="icon" variant="ghost" aria-label="Subir módulo" onClick={() => mover("trein_modulos", mods, mi, -1)}><ArrowUp className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Descer módulo" onClick={() => mover("trein_modulos", mods, mi, 1)}><ArrowDown className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Renomear módulo" onClick={() => renomearModulo(m)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Excluir módulo" onClick={() => setExcluir({ tipo: "modulo", id: m.id })}><Trash2 className="w-4 h-4" /></Button>
              </div>
              <ul className="divide-y divide-border rounded border border-border">
                {lista.map((a, ai) => (
                  <li key={a.id} className="flex items-center gap-2 p-2 text-sm">
                    <span className="flex-1">{ai + 1}. {a.titulo} <span className="text-muted-foreground">({TIPOS_AULA[a.tipo]}{a.minutos_estimados ? `, ${a.minutos_estimados} min` : ""})</span></span>
                    <Button size="icon" variant="ghost" aria-label="Subir aula" onClick={() => mover("trein_aulas", lista, ai, -1)}><ArrowUp className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Descer aula" onClick={() => mover("trein_aulas", lista, ai, 1)}><ArrowDown className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Editar aula" onClick={() => setAulaForm({ ...aulaVazia, ...a, url: a.url || "", storage_path: a.storage_path || "", conteudo_html: a.conteudo_html || "", conteudo_md: a.conteudo_md || "", prova_de_saida: a.prova_de_saida || "", checklist: (a.checklist_itens || []).join("\n"), minutos_estimados: a.minutos_estimados ?? "" })}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Excluir aula" onClick={() => setExcluir({ tipo: "aula", id: a.id })}><Trash2 className="w-4 h-4" /></Button>
                  </li>
                ))}
                {!lista.length && <li className="p-3 text-sm text-muted-foreground">Nenhuma aula neste módulo.</li>}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setAulaForm({ ...aulaVazia, modulo_id: m.id })}><Plus className="w-4 h-4 mr-1" />Aula</Button>
                {!q && <Button size="sm" variant="outline" onClick={() => criarQuestionario(m)}><FileQuestion className="w-4 h-4 mr-1" />Questionário no fim do módulo</Button>}
              </div>
              {q && (
                <div className="rounded border border-border p-3 space-y-2 bg-muted/30">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileQuestion className="w-4 h-4" /><span className="font-medium text-sm flex-1">Questionário ({perguntas.length} pergunta(s))</span>
                    <Label htmlFor={`nm-${q.id}`} className="text-xs">Nota mínima (%)</Label>
                    <Input id={`nm-${q.id}`} type="number" min={0} max={100} className="w-20 h-8" defaultValue={q.nota_minima}
                      onBlur={async (e) => { const n = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 70)); await db.from("trein_questionarios").update({ nota_minima: n }).eq("id", q.id); carregar(); }} />
                    <Button size="icon" variant="ghost" aria-label="Excluir questionário" onClick={() => setExcluir({ tipo: "questionario", id: q.id })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  {perguntas.map((p, pi) => (
                    <div key={p.id} className="text-sm flex gap-2 items-start">
                      <div className="flex-1">
                        <p className="font-medium">{pi + 1}. {p.enunciado}</p>
                        <p className="text-muted-foreground">{(p.alternativas || []).map((x: string, i: number) => `${letra(i)}) ${x}${i === p.indice_correto ? " (correta)" : ""}`).join("  ·  ")}</p>
                      </div>
                      <Button size="icon" variant="ghost" aria-label="Editar pergunta" onClick={() => setPergForm({ ...p, alternativas: (p.alternativas || []).join("\n") })}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Excluir pergunta" onClick={() => setExcluir({ tipo: "pergunta", id: p.id })}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setPergForm({ id: "", questionario_id: q.id, enunciado: "", alternativas: "", indice_correto: 0 })}><Plus className="w-4 h-4 mr-1" />Pergunta</Button>
                </div>
              )}
            </section>
          );
        })}
        <Button variant="outline" onClick={novoModulo}><Plus className="w-4 h-4 mr-1" />Novo módulo</Button>
      </div>

      {/* Aula */}
      <Dialog open={!!aulaForm} onOpenChange={(o) => !o && setAulaForm(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{aulaForm?.id ? "Editar aula" : "Nova aula"}</DialogTitle></DialogHeader>
          {aulaForm && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="au-titulo">Título</Label>
                <Input id="au-titulo" value={aulaForm.titulo} onChange={(e) => setAulaForm({ ...aulaForm, titulo: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Tipo</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(TIPOS_AULA).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setAulaForm({ ...aulaForm, tipo: k })}
                      className={`rounded-md border p-2 text-left text-sm ${aulaForm.tipo === k ? "border-primary bg-primary/10" : "border-border"} ${k === "video_link" ? "ring-1 ring-accent" : ""}`}>
                      {v}{k === "video_link" && <Badge className="ml-1" variant="secondary">Recomendado</Badge>}
                    </button>
                  ))}
                </div></div>

              {aulaForm.tipo === "video_link" && (
                <div className="space-y-1.5 rounded-md border border-accent/50 bg-accent/10 p-3">
                  <Label htmlFor="au-url" className="flex items-center gap-1"><Youtube className="w-4 h-4" />Link do vídeo</Label>
                  <Input id="au-url" placeholder="https://youtu.be/... ou https://vimeo.com/..." value={aulaForm.url} onChange={(e) => setAulaForm({ ...aulaForm, url: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Caminho preferido: publique no YouTube como "não listado" (ou no Vimeo com privacidade) e cole o link aqui. Não ocupa espaço no armazenamento do app.</p>
                  {aulaForm.url && embedVideo(aulaForm.url) && <iframe title="Prévia" src={embedVideo(aulaForm.url)!} className="w-full aspect-video rounded" allowFullScreen />}
                </div>
              )}
              {aulaForm.tipo === "link" && (
                <div className="space-y-1.5"><Label htmlFor="au-link">Endereço</Label>
                  <Input id="au-link" placeholder="https://" value={aulaForm.url} onChange={(e) => setAulaForm({ ...aulaForm, url: e.target.value })} /></div>
              )}
              {(aulaForm.tipo === "video_arquivo" || aulaForm.tipo === "documento") && (
                <div className="space-y-1.5">
                  <Label htmlFor="au-arq">{aulaForm.tipo === "video_arquivo" ? "Arquivo de vídeo (até 200 MB)" : "PDF ou documento (até 20 MB)"}</Label>
                  {aulaForm.tipo === "video_arquivo" && <p className="text-xs text-muted-foreground">Sempre que possível, prefira um link do YouTube (não listado) ou Vimeo.</p>}
                  <Input id="au-arq" type="file" disabled={enviando}
                    accept={aulaForm.tipo === "video_arquivo" ? "video/*" : ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"}
                    onChange={(e) => e.target.files?.[0] && enviarArquivo(e.target.files[0])} />
                  {enviando && <p className="text-xs text-muted-foreground flex items-center gap-1"><Upload className="w-3 h-3" />Enviando...</p>}
                  {aulaForm.storage_path && !enviando && <p className="text-xs text-primary">Arquivo anexado{aulaForm.nome_arquivo ? `: ${aulaForm.nome_arquivo}` : ""}.</p>}
                </div>
              )}
              {aulaForm.tipo === "checklist" && (
                <div className="space-y-1.5"><Label htmlFor="au-check">Itens (um por linha)</Label>
                  <Textarea id="au-check" rows={6} value={aulaForm.checklist} onChange={(e) => setAulaForm({ ...aulaForm, checklist: e.target.value })} /></div>
              )}
              <div className="space-y-1.5"><Label>{aulaForm.tipo === "texto" ? "Conteúdo" : "Texto de apoio (opcional)"}</Label>
                <EditorTexto key={aulaForm.id || "nova"} valor={aulaForm.conteudo_html} onChange={(h) => setAulaForm((f: any) => ({ ...f, conteudo_html: h }))} /></div>
              <div className="space-y-1.5"><Label>Conteúdo em markdown (opcional)</Label>
                <EditorMarkdown valor={aulaForm.conteudo_md} onChange={(v) => setAulaForm((f: any) => ({ ...f, conteudo_md: v }))} /></div>
              <div className="space-y-1.5"><Label>Prova de saída (opcional)</Label>
                <p className="text-xs text-muted-foreground">O que a pessoa precisa entregar ou demonstrar ao terminar esta aula. Aparece para ela no fim do conteúdo.</p>
                <EditorMarkdown valor={aulaForm.prova_de_saida} rows={5} ariaLabel="Prova de saída" onChange={(v) => setAulaForm((f: any) => ({ ...f, prova_de_saida: v }))} /></div>
              <div className="space-y-1.5 max-w-[200px]"><Label htmlFor="au-min">Tempo estimado (minutos)</Label>
                <Input id="au-min" type="number" min={1} value={aulaForm.minutos_estimados} onChange={(e) => setAulaForm({ ...aulaForm, minutos_estimados: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setAulaForm(null)}>Cancelar</Button><Button onClick={salvarAula} disabled={enviando}>Salvar aula</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pergunta */}
      <Dialog open={!!pergForm} onOpenChange={(o) => !o && setPergForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pergForm?.id ? "Editar pergunta" : "Nova pergunta"}</DialogTitle></DialogHeader>
          {pergForm && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="pg-enun">Pergunta</Label>
                <Textarea id="pg-enun" value={pergForm.enunciado} onChange={(e) => setPergForm({ ...pergForm, enunciado: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="pg-alts">Alternativas (uma por linha)</Label>
                <Textarea id="pg-alts" rows={5} value={pergForm.alternativas} onChange={(e) => setPergForm({ ...pergForm, alternativas: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Alternativa correta</Label>
                <Select value={String(pergForm.indice_correto)} onValueChange={(v) => setPergForm({ ...pergForm, indice_correto: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{String(pergForm.alternativas).split("\n").map((s: string) => s.trim()).filter(Boolean).map((s: string, i: number) =>
                    <SelectItem key={i} value={String(i)}>{letra(i)}) {s.slice(0, 60)}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setPergForm(null)}>Cancelar</Button><Button onClick={salvarPergunta}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publicar */}
      <Dialog open={publicar} onOpenChange={setPublicar}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.publicada ? "Publicar nova versão" : "Publicar trilha"}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            {t.obrigatoria
              ? <p>Trilha obrigatória: as pessoas do setor ({nomeSetor(setores, t.setor_id)}) que ainda não a têm recebem a atribuição e um aviso{t.prazo_dias ? `, com prazo de ${t.prazo_dias} dias` : ""}.</p>
              : <p>A trilha fica disponível no Catálogo para as pessoas do setor.</p>}
            {t.publicada && (
              <div className="flex items-start gap-2"><Checkbox id="pb-ref" checked={refazer} onCheckedChange={(v) => setRefazer(!!v)} />
                <Label htmlFor="pb-ref" className="font-normal">Quem já concluiu precisa refazer (o progresso dessas pessoas é zerado e elas recebem aviso).</Label></div>
            )}
            <div className="space-y-1.5"><Label htmlFor="pb-nota">O que mudou (opcional)</Label>
              <Input id="pb-nota" value={notaVersao} onChange={(e) => setNotaVersao(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPublicar(false)}>Cancelar</Button><Button onClick={confirmarPublicacao}>Publicar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle>
            <AlertDialogDescription>{excluir?.tipo === "modulo" ? "O módulo e todas as aulas e o questionário dele serão excluídos." : "Esta ação não pode ser desfeita."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
