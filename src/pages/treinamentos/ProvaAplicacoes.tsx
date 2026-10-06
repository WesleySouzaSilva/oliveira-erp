import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Copy, Link2, Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { db, fmtData, usePapelTrein } from "@/lib/treinamentos";
import { FINALIDADES } from "./Provas";

const STATUS: Record<string, string> = {
  pendente: "Convite enviado", em_andamento: "Em andamento", respondida: "Aguardando correção",
  corrigida: "Corrigida", expirada: "Expirada",
};

function novoToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ProvaAplicacoes() {
  const { id } = useParams();
  const papel = usePapelTrein();
  const [prova, setProva] = useState<any | null>(null);
  const [aplicacoes, setAplicacoes] = useState<any[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [convite, setConvite] = useState<any | null>(null);
  const [link, setLink] = useState<string>("");
  const [corrigir, setCorrigir] = useState<any | null>(null);
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [respostas, setRespostas] = useState<any[]>([]);
  const [pontos, setPontos] = useState<Record<string, string>>({});
  const [observacao, setObservacao] = useState("");
  const [notaManual, setNotaManual] = useState("");
  const [membros, setMembros] = useState<any[]>([]);
  const [atribuir, setAtribuir] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    const { data: p } = await db.from("provas").select("*").eq("id", id).maybeSingle();
    setProva(p);
    const { data: aps } = await db.from("prova_aplicacoes").select("*").eq("prova_id", id).order("created_at", { ascending: false });
    setAplicacoes(aps || []);
    const ids = [...new Set((aps || []).map((a: any) => a.user_id).filter(Boolean))];
    if (ids.length) {
      const { data: perfis } = await db.from("profiles").select("id,nome").in("id", ids as string[]);
      setNomes(Object.fromEntries((perfis || []).map((x: any) => [x.id, x.nome])));
    }
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const abrirAtribuir = async () => {
    const { data } = await db.from("profiles").select("id,nome").order("nome");
    setMembros(data || []); setSelecionados([]); setAtribuir(true);
  };

  const salvarAtribuicao = async () => {
    if (!selecionados.length) { toast.error("Escolha ao menos uma pessoa."); return; }
    const linhas = selecionados.map((uid) => ({ prova_id: prova.id, user_id: uid, organizacao_id: prova.organizacao_id, status: "pendente" }));
    const { error } = await db.from("prova_aplicacoes").insert(linhas);
    if (error) { toast.error("Não foi possível atribuir a prova."); return; }
    setAtribuir(false); toast.success("Prova atribuída."); carregar();
  };

  const gerarConvite = async () => {
    const f = convite;
    if (!f.nome.trim()) { toast.error("Informe o nome do candidato."); return; }
    const token = novoToken();
    const dias = Math.max(1, parseInt(f.dias, 10) || 7);
    const { error } = await db.from("prova_aplicacoes").insert({
      prova_id: prova.id, organizacao_id: prova.organizacao_id, status: "pendente",
      candidato_nome: f.nome.trim(), candidato_email: f.email.trim() || null, candidato_telefone: f.telefone.trim() || null,
      token, token_expira_em: new Date(Date.now() + dias * 86400000).toISOString(),
    });
    if (error) { toast.error("Não foi possível gerar o convite."); return; }
    setLink(`${window.location.origin}/prova/${token}`);
    setConvite(null); carregar();
  };

  const abrirCorrecao = async (a: any) => {
    const [{ data: qs }, { data: rs }] = await Promise.all([
      db.from("prova_questoes").select("*").eq("prova_id", prova.id).order("ordem"),
      db.from("prova_respostas").select("*").eq("aplicacao_id", a.id),
    ]);
    setQuestoes(qs || []); setRespostas(rs || []);
    setPontos(Object.fromEntries((rs || []).map((r: any) => [r.questao_id, r.pontos == null ? "" : String(r.pontos)])));
    setObservacao(a.observacao_do_lider || ""); setNotaManual(a.nota == null ? "" : String(a.nota));
    setCorrigir(a);
  };

  const salvarCorrecao = async () => {
    const lista = Object.entries(pontos)
      .filter(([, v]) => v !== "")
      .map(([questao_id, v]) => ({ questao_id, pontos: Number(v) }));
    const { data, error } = await db.functions.invoke("prova-corrigir", {
      body: { aplicacao_id: corrigir.id, pontos: lista, nota_manual: notaManual === "" ? null : Number(notaManual), observacao },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || "Não foi possível salvar a correção."); return; }
    toast.success("Correção salva."); setCorrigir(null); carregar();
  };

  if (!papel.carregando && !papel.lider_provas) {
    return <AppLayout><p className="p-6 text-sm text-muted-foreground">Esta seção é das lideranças.</p></AppLayout>;
  }
  if (!prova) return <AppLayout><p className="p-6 text-sm text-muted-foreground">Carregando...</p></AppLayout>;

  return (
    <AppLayout>
      <PageHeader title={prova.titulo} subtitle={`${FINALIDADES[prova.finalidade]} · nota mínima ${String(prova.nota_minima).replace(".", ",")}%`} backTo="/treinamentos/provas" />
      <div className="flex flex-wrap gap-2 mb-4">
        <Button onClick={abrirAtribuir}><Plus className="w-4 h-4 mr-1" />Atribuir a alguém da equipe</Button>
        <Button variant="outline" onClick={() => { setLink(""); setConvite({ nome: "", email: "", telefone: "", dias: "7" }); }}>
          <Link2 className="w-4 h-4 mr-1" />Gerar link para candidato
        </Button>
      </div>

      {!aplicacoes.length ? (
        <p className="text-sm text-muted-foreground">Ninguém fez esta prova ainda.</p>
      ) : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Pessoa</TableHead><TableHead>Situação</TableHead><TableHead>Enviada em</TableHead>
            <TableHead>Nota</TableHead><TableHead>Resultado</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {aplicacoes.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.user_id ? nomes[a.user_id] || "Equipe" : a.candidato_nome || "Candidato (dados apagados)"}</TableCell>
                <TableCell>{STATUS[a.status] || a.status}</TableCell>
                <TableCell>{a.enviada_em ? fmtData(a.enviada_em) : ""}</TableCell>
                <TableCell>{a.nota == null ? "" : `${String(a.nota).replace(".", ",")}%`}</TableCell>
                <TableCell>{a.aprovado == null ? "" : <Badge variant={a.aprovado ? "default" : "destructive"}>{a.aprovado ? "Aprovado" : "Não aprovado"}</Badge>}</TableCell>
                <TableCell className="text-right">
                  {(a.status === "respondida" || a.status === "corrigida") && (
                    <Button size="sm" variant="outline" onClick={() => abrirCorrecao(a)}>{a.status === "corrigida" ? "Rever" : "Corrigir"}</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={atribuir} onOpenChange={setAtribuir}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Atribuir prova</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {membros.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selecionados.includes(m.id)}
                  onChange={(e) => setSelecionados(e.target.checked ? [...selecionados, m.id] : selecionados.filter((x) => x !== m.id))} />
                {m.nome}
              </label>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAtribuir(false)}>Cancelar</Button><Button onClick={salvarAtribuicao}>Atribuir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!convite || !!link} onOpenChange={(o) => { if (!o) { setConvite(null); setLink(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link para candidato</DialogTitle></DialogHeader>
          {convite && !link && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="cd-nome">Nome</Label>
                <Input id="cd-nome" value={convite.nome} onChange={(e) => setConvite({ ...convite, nome: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="cd-mail">E-mail (opcional)</Label>
                <Input id="cd-mail" type="email" value={convite.email} onChange={(e) => setConvite({ ...convite, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="cd-tel">Telefone (opcional)</Label>
                <Input id="cd-tel" value={convite.telefone} onChange={(e) => setConvite({ ...convite, telefone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="cd-dias">Validade do link (dias)</Label>
                <Input id="cd-dias" type="number" min={1} value={convite.dias} onChange={(e) => setConvite({ ...convite, dias: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">O link serve para uma pessoa e vale uma vez. Envie você mesmo por e-mail ou mensagem.</p>
            </div>
          )}
          {link && (
            <div className="space-y-2">
              <Input readOnly value={link} aria-label="Link da prova" />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado."); }}>
                <Copy className="w-4 h-4 mr-1" />Copiar link
              </Button>
            </div>
          )}
          <DialogFooter>
            {link
              ? <Button onClick={() => { setLink(""); setConvite(null); }}>Fechar</Button>
              : <><Button variant="outline" onClick={() => setConvite(null)}>Cancelar</Button><Button onClick={gerarConvite}>Gerar link</Button></>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!corrigir} onOpenChange={(o) => !o && setCorrigir(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Correção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {questoes.map((q, i) => {
              const r = respostas.find((x) => x.questao_id === q.id);
              return (
                <div key={q.id} className="rounded border border-border p-3 space-y-2 text-sm">
                  <p className="font-medium">{i + 1}. {q.enunciado}</p>
                  {q.tipo === "dissertativa"
                    ? <p className="whitespace-pre-wrap text-muted-foreground">{r?.resposta_texto || "Sem resposta"}</p>
                    : <p className="text-muted-foreground">{r?.pontos ? "Acertou" : "Errou"}</p>}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`p-${q.id}`} className="text-xs">Pontos (até {String(q.peso).replace(".", ",")})</Label>
                    <Input id={`p-${q.id}`} className="w-24 h-8" type="number" min={0} step="0.5"
                      value={pontos[q.id] ?? ""} onChange={(e) => setPontos({ ...pontos, [q.id]: e.target.value })} />
                  </div>
                </div>
              );
            })}
            <div className="space-y-1.5"><Label htmlFor="cr-nota">Nota final (%)</Label>
              <Input id="cr-nota" className="w-32" type="number" min={0} max={100} value={notaManual} onChange={(e) => setNotaManual(e.target.value)} />
              <p className="text-xs text-muted-foreground">Deixe como está para usar a nota calculada. Se mudar a nota, escreva o motivo abaixo.</p></div>
            <div className="space-y-1.5"><Label htmlFor="cr-obs">Observação</Label>
              <Textarea id="cr-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCorrigir(null)}>Fechar</Button><Button onClick={salvarCorrecao}>Salvar correção</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
