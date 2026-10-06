import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Eraser, Pencil, Plus, Trash2, Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { db, usePapelTrein } from "@/lib/treinamentos";

export const FINALIDADES: Record<string, string> = {
  geral: "Geral",
  passagem_de_cargo: "Passagem de cargo",
  candidato: "Candidato a vaga",
};

const provaVazia = {
  id: "", titulo: "", descricao: "", finalidade: "geral", trilha_id: "", cargo_alvo_id: "",
  nota_minima: "70", tempo_limite_min: "", tentativas_permitidas: "1", retencao_dias: "180",
  embaralhar_questoes: true, embaralhar_alternativas: true,
};

export default function Provas() {
  const nav = useNavigate();
  const papel = usePapelTrein();
  const [provas, setProvas] = useState<any[]>([]);
  const [contagens, setContagens] = useState<Record<string, { questoes: number; fizeram: number; passaram: number }>>({});
  const [trilhas, setTrilhas] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const [editando, setEditando] = useState<any | null>(null);
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [alts, setAlts] = useState<any[]>([]);
  const [excluir, setExcluir] = useState<any | null>(null);
  const [limpando, setLimpando] = useState(false);

  const carregar = useCallback(async () => {
    const [{ data: ps }, { data: ts }, { data: cs }] = await Promise.all([
      db.from("provas").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      db.from("trein_trilhas").select("id,titulo"),
      db.from("rh_tabela_salarial").select("id,setor,nivel,subfaixa").order("setor"),
    ]);
    setProvas(ps || []); setTrilhas(ts || []); setCargos(cs || []);
    const ids = (ps || []).map((p: any) => p.id);
    if (!ids.length) { setContagens({}); return; }
    const [{ data: qs }, { data: aps }] = await Promise.all([
      db.from("prova_questoes").select("id,prova_id").in("prova_id", ids),
      db.from("prova_aplicacoes").select("id,prova_id,status,aprovado").in("prova_id", ids),
    ]);
    const mapa: any = {};
    for (const id of ids) {
      const feitas = (aps || []).filter((a: any) => a.prova_id === id && (a.status === "respondida" || a.status === "corrigida"));
      mapa[id] = {
        questoes: (qs || []).filter((q: any) => q.prova_id === id).length,
        fizeram: feitas.length,
        passaram: feitas.filter((a: any) => a.aprovado).length,
      };
    }
    setContagens(mapa);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const carregarQuestoes = useCallback(async (provaId: string) => {
    const { data: qs } = await db.from("prova_questoes").select("*").eq("prova_id", provaId).order("ordem");
    setQuestoes(qs || []);
    const ids = (qs || []).map((q: any) => q.id);
    const { data: as_ } = ids.length
      ? await db.from("prova_alternativas").select("*").in("questao_id", ids).order("ordem")
      : { data: [] };
    setAlts(as_ || []);
  }, []);

  const salvarProva = async () => {
    const f = form;
    if (!f.titulo.trim()) { toast.error("Informe o título da prova."); return; }
    const row: any = {
      titulo: f.titulo.trim(),
      descricao: f.descricao.trim() || null,
      finalidade: f.finalidade,
      trilha_id: f.trilha_id || null,
      cargo_alvo_id: f.cargo_alvo_id || null,
      nota_minima: Math.min(100, Math.max(0, Number(f.nota_minima) || 70)),
      tempo_limite_min: f.tempo_limite_min ? parseInt(f.tempo_limite_min, 10) : null,
      tentativas_permitidas: Math.max(1, parseInt(f.tentativas_permitidas, 10) || 1),
      retencao_dias: Math.max(1, parseInt(f.retencao_dias, 10) || 180),
      embaralhar_questoes: f.embaralhar_questoes,
      embaralhar_alternativas: f.embaralhar_alternativas,
    };
    if (f.id) {
      const { error } = await db.from("provas").update(row).eq("id", f.id);
      if (error) { toast.error("Não foi possível salvar."); return; }
      setForm(null); carregar();
      return;
    }
    const { data: papelOrg } = await db.rpc("trein_meu_papel");
    const { data, error } = await db.from("provas")
      .insert({ ...row, organizacao_id: papelOrg?.organizacao_id, criada_por: (await db.auth.getUser()).data.user?.id })
      .select("*").single();
    if (error) { toast.error("Não foi possível criar a prova."); return; }
    setForm(null); await carregar();
    setEditando(data); carregarQuestoes(data.id);
  };

  const novaQuestao = async () => {
    const { error } = await db.from("prova_questoes")
      .insert({ prova_id: editando.id, enunciado: "Nova questão", ordem: questoes.length });
    if (error) { toast.error("Não foi possível criar a questão."); return; }
    carregarQuestoes(editando.id); carregar();
  };
  const salvarQuestao = async (q: any, patch: any) => {
    await db.from("prova_questoes").update(patch).eq("id", q.id);
    carregarQuestoes(editando.id);
  };
  const novaAlternativa = async (q: any) => {
    await db.from("prova_alternativas").insert({ questao_id: q.id, texto: "Nova alternativa", ordem: alts.filter((a) => a.questao_id === q.id).length });
    carregarQuestoes(editando.id);
  };
  const marcarCorreta = async (q: any, altId: string) => {
    await Promise.all(alts.filter((a) => a.questao_id === q.id).map((a) =>
      db.from("prova_alternativas").update({ correta: a.id === altId }).eq("id", a.id)));
    carregarQuestoes(editando.id);
  };

  const publicar = async (p: any, valor: boolean) => {
    if (valor) {
      const { count } = await db.from("prova_questoes").select("id", { count: "exact", head: true }).eq("prova_id", p.id);
      if (!count) { toast.error("A prova precisa de pelo menos uma questão."); return; }
    }
    await db.from("provas").update({ publicada: valor }).eq("id", p.id);
    carregar();
  };

  const confirmarExclusao = async () => {
    await db.from("provas").update({ deleted_at: new Date().toISOString(), publicada: false }).eq("id", excluir.id);
    setExcluir(null); carregar();
  };

  const limparCandidatos = async () => {
    setLimpando(true);
    const { data, error } = await db.rpc("prova_anonimizar_candidatos");
    setLimpando(false);
    if (error) { toast.error("Não foi possível limpar os dados."); return; }
    toast.success(Number(data) ? `${data} registro(s) de candidato anonimizado(s).` : "Nenhum registro passou do prazo de guarda.");
    carregar();
  };

  if (!papel.carregando && !papel.lider_provas) {
    return <AppLayout><p className="p-6 text-sm text-muted-foreground">Esta seção é das lideranças (administração, coordenação e direção).</p></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader icon={ClipboardList} title="Provas" subtitle="Provas de múltipla escolha para a equipe e para candidatos" backTo="/treinamentos" />
      <div className="flex flex-wrap gap-2 mb-4">
        <Button onClick={() => setForm({ ...provaVazia })}><Plus className="w-4 h-4 mr-1" />Nova prova</Button>
        <Button variant="outline" onClick={limparCandidatos} disabled={limpando}>
          <Eraser className="w-4 h-4 mr-1" />Limpar dados antigos de candidatos
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4 max-w-3xl">
        A limpeza apaga nome, e-mail e telefone dos candidatos cujas provas passaram do prazo de guarda da própria prova
        (padrão de 180 dias). A nota e as respostas continuam guardadas, sem identificação, para estatística.
      </p>

      {!provas.length ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma prova criada ainda.
        </div>
      ) : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Prova</TableHead><TableHead>Finalidade</TableHead><TableHead>Nota mínima</TableHead>
            <TableHead>Questões</TableHead><TableHead>Fizeram</TableHead><TableHead>Passaram</TableHead>
            <TableHead>Publicada</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {provas.map((p) => {
              const c = contagens[p.id] || { questoes: 0, fizeram: 0, passaram: 0 };
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.titulo}</TableCell>
                  <TableCell><Badge variant="outline">{FINALIDADES[p.finalidade]}</Badge></TableCell>
                  <TableCell>{String(p.nota_minima).replace(".", ",")}%</TableCell>
                  <TableCell>{c.questoes}</TableCell>
                  <TableCell>{c.fizeram}</TableCell>
                  <TableCell>{c.passaram}</TableCell>
                  <TableCell><Switch checked={p.publicada} onCheckedChange={(v) => publicar(p, v)} aria-label="Publicar prova" /></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" aria-label="Aplicações" onClick={() => nav(`/treinamentos/provas/${p.id}/aplicacoes`)}><Users className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Editar questões" onClick={() => { setEditando(p); carregarQuestoes(p.id); }}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Excluir prova" onClick={() => setExcluir(p)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Dados da prova */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "Editar prova" : "Nova prova"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="pv-tit">Título</Label>
                <Input id="pv-tit" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="pv-desc">Descrição</Label>
                <Textarea id="pv-desc" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Finalidade</Label>
                <Select value={form.finalidade} onValueChange={(v) => setForm({ ...form, finalidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(FINALIDADES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label htmlFor="pv-nota">Nota mínima (%)</Label>
                <Input id="pv-nota" type="number" min={0} max={100} value={form.nota_minima} onChange={(e) => setForm({ ...form, nota_minima: e.target.value })} /></div>
              {form.finalidade === "geral" && (
                <div className="space-y-1.5"><Label>Trilha que esta prova fecha (opcional)</Label>
                  <Select value={form.trilha_id || "nenhuma"} onValueChange={(v) => setForm({ ...form, trilha_id: v === "nenhuma" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="nenhuma">Nenhuma</SelectItem>{trilhas.map((t) => <SelectItem key={t.id} value={t.id}>{t.titulo}</SelectItem>)}</SelectContent>
                  </Select></div>
              )}
              {form.finalidade === "passagem_de_cargo" && (
                <div className="space-y-1.5"><Label>Cargo pretendido</Label>
                  <Select value={form.cargo_alvo_id || "nenhum"} onValueChange={(v) => setForm({ ...form, cargo_alvo_id: v === "nenhum" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="nenhum">Não informado</SelectItem>
                      {cargos.map((c) => <SelectItem key={c.id} value={c.id}>{`${c.setor}, ${c.nivel}${c.subfaixa ? ` (${c.subfaixa})` : ""}`}</SelectItem>)}</SelectContent>
                  </Select></div>
              )}
              <div className="space-y-1.5"><Label htmlFor="pv-tempo">Tempo limite (minutos, opcional)</Label>
                <Input id="pv-tempo" type="number" min={1} value={form.tempo_limite_min} onChange={(e) => setForm({ ...form, tempo_limite_min: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="pv-tent">Tentativas permitidas</Label>
                <Input id="pv-tent" type="number" min={1} value={form.tentativas_permitidas} onChange={(e) => setForm({ ...form, tentativas_permitidas: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="pv-ret">Guardar dados do candidato por (dias)</Label>
                <Input id="pv-ret" type="number" min={1} value={form.retencao_dias} onChange={(e) => setForm({ ...form, retencao_dias: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch id="pv-eq" checked={form.embaralhar_questoes} onCheckedChange={(v) => setForm({ ...form, embaralhar_questoes: v })} /><Label htmlFor="pv-eq">Embaralhar questões</Label></div>
              <div className="flex items-center gap-2"><Switch id="pv-ea" checked={form.embaralhar_alternativas} onCheckedChange={(v) => setForm({ ...form, embaralhar_alternativas: v })} /><Label htmlFor="pv-ea">Embaralhar alternativas</Label></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button><Button onClick={salvarProva}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Questões */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editando?.titulo}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Button size="sm" variant="outline" onClick={() => setForm({
              ...provaVazia, ...editando,
              descricao: editando.descricao || "", trilha_id: editando.trilha_id || "", cargo_alvo_id: editando.cargo_alvo_id || "",
              nota_minima: String(editando.nota_minima), tempo_limite_min: editando.tempo_limite_min ?? "",
              tentativas_permitidas: String(editando.tentativas_permitidas), retencao_dias: String(editando.retencao_dias),
            })}><Pencil className="w-4 h-4 mr-1" />Dados da prova</Button>

            {questoes.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="pt-2 text-sm text-muted-foreground">{i + 1}.</span>
                  <Textarea aria-label="Enunciado" defaultValue={q.enunciado} onBlur={(e) => e.target.value.trim() !== q.enunciado && salvarQuestao(q, { enunciado: e.target.value.trim() })} />
                  <Button size="icon" variant="ghost" aria-label="Excluir questão"
                    onClick={async () => { await db.from("prova_questoes").delete().eq("id", q.id); carregarQuestoes(editando.id); carregar(); }}>
                    <Trash2 className="w-4 h-4" /></Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={q.tipo} onValueChange={(v) => salvarQuestao(q, { tipo: v })}>
                    <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="multipla_escolha">Múltipla escolha</SelectItem><SelectItem value="dissertativa">Dissertativa</SelectItem></SelectContent>
                  </Select>
                  <div className="flex items-center gap-2"><Label htmlFor={`peso-${q.id}`} className="text-xs">Peso</Label>
                    <Input id={`peso-${q.id}`} className="w-20 h-8" type="number" min={0} step="0.5" defaultValue={q.peso}
                      onBlur={(e) => salvarQuestao(q, { peso: Number(e.target.value) || 1 })} /></div>
                </div>
                {q.tipo === "multipla_escolha" && (
                  <div className="space-y-1.5">
                    {alts.filter((a) => a.questao_id === q.id).map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <input type="radio" name={`c-${q.id}`} checked={a.correta} onChange={() => marcarCorreta(q, a.id)} aria-label="Alternativa correta" />
                        <Input defaultValue={a.texto} onBlur={async (e) => { if (e.target.value.trim() !== a.texto) { await db.from("prova_alternativas").update({ texto: e.target.value.trim() }).eq("id", a.id); carregarQuestoes(editando.id); } }} />
                        <Button size="icon" variant="ghost" aria-label="Excluir alternativa"
                          onClick={async () => { await db.from("prova_alternativas").delete().eq("id", a.id); carregarQuestoes(editando.id); }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => novaAlternativa(q)}><Plus className="w-4 h-4 mr-1" />Alternativa</Button>
                  </div>
                )}
                <div className="space-y-1.5"><Label htmlFor={`exp-${q.id}`} className="text-xs">Explicação (aparece depois da correção)</Label>
                  <Textarea id={`exp-${q.id}`} defaultValue={q.explicacao || ""} onBlur={(e) => salvarQuestao(q, { explicacao: e.target.value.trim() || null })} /></div>
              </div>
            ))}
            <Button variant="outline" onClick={novaQuestao}><Plus className="w-4 h-4 mr-1" />Questão</Button>
          </div>
          <DialogFooter><Button onClick={() => { setEditando(null); carregar(); }}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir a prova?</AlertDialogTitle>
            <AlertDialogDescription>A prova sai da lista e deixa de ser publicada. As aplicações já feitas continuam guardadas.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
