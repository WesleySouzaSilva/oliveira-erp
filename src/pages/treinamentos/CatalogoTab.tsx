import { useSomenteLeitura } from "@/lib/verComo";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, PlayCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { db, nomeSetor, PapelTrein, Setor, setoresEditaveis, Trilha } from "@/lib/treinamentos";

export default function CatalogoTab({ setores, papel }: { setores: Setor[]; papel: PapelTrein }) {
  const somenteLeitura = useSomenteLeitura();
  const nav = useNavigate();
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [fSetor, setFSetor] = useState("todos");
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState(false);
  const [form, setForm] = useState({ titulo: "", descricao: "", setor_id: "", obrigatoria: false, prazo_dias: "" });
  const editaveis = useMemo(() => setoresEditaveis(setores, papel), [setores, papel]);
  const podeEditar = (t: Trilha) => editaveis.some((s) => s.id === t.setor_id);

  useEffect(() => {
    db.from("trein_trilhas").select("*").eq("arquivada", false).order("titulo").then(({ data }: any) => setTrilhas(data || []));
  }, []);

  const visiveis = trilhas.filter((t) =>
    (fSetor === "todos" || t.setor_id === fSetor) && (!busca || t.titulo.toLowerCase().includes(busca.toLowerCase())));

  const grupos = setores.map((s) => ({ s, lista: visiveis.filter((t) => t.setor_id === s.id) })).filter((g) => g.lista.length);

  const criar = async () => {
    if (!form.titulo.trim() || !form.setor_id) { toast.error("Informe o título e o setor."); return; }
    const prazo = form.obrigatoria && form.prazo_dias ? parseInt(form.prazo_dias, 10) : null;
    const { data, error } = await db.from("trein_trilhas").insert({
      titulo: form.titulo.trim(), descricao: form.descricao.trim() || null, setor_id: form.setor_id,
      obrigatoria: form.obrigatoria, prazo_dias: prazo && prazo > 0 ? prazo : null, organizacao_id: papel.organizacao_id,
    }).select("id").single();
    if (error) { toast.error("Não foi possível criar a trilha."); return; }
    nav(`/treinamentos/editar/${data.id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input className="max-w-xs" placeholder="Buscar trilha" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Select value={fSetor} onValueChange={setFSetor}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os setores</SelectItem>
            {setores.map((s) => <SelectItem key={s.id} value={s.id}>{nomeSetor(setores, s.id)}</SelectItem>)}
          </SelectContent>
        </Select>
        {!somenteLeitura && editaveis.length > 0 && (
          <Button className="ml-auto" onClick={() => { setForm({ titulo: "", descricao: "", setor_id: editaveis[0]?.id || "", obrigatoria: false, prazo_dias: "" }); setNova(true); }}>
            <Plus className="w-4 h-4 mr-1" />Nova trilha
          </Button>
        )}
      </div>

      {!grupos.length && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma trilha disponível ainda. O conteúdo será carregado pelos administradores e líderes de setor.
        </div>
      )}

      {grupos.map(({ s, lista }) => (
        <section key={s.id} className="space-y-2">
          <h3 className="font-serif text-lg">{nomeSetor(setores, s.id)}</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {lista.map((t) => (
              <div key={t.id} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2">
                <div className="flex flex-wrap gap-1">
                  {t.obrigatoria && <Badge variant="outline">Obrigatória{t.prazo_dias ? ` (${t.prazo_dias} dias)` : ""}</Badge>}
                  {!t.publicada && <Badge variant="secondary">Rascunho</Badge>}
                  {t.publicada && t.versao > 1 && <Badge variant="secondary">Versão {t.versao}</Badge>}
                </div>
                <h4 className="font-medium leading-tight">{t.titulo}</h4>
                {t.descricao && <p className="text-sm text-muted-foreground line-clamp-3">{t.descricao}</p>}
                <div className="mt-auto flex gap-2 pt-2">
                  {t.publicada && <Button size="sm" onClick={() => nav(`/treinamentos/trilha/${t.id}`)}><PlayCircle className="w-4 h-4 mr-1" />Abrir</Button>}
                  {!somenteLeitura && podeEditar(t) && <Button size="sm" variant="outline" onClick={() => nav(`/treinamentos/editar/${t.id}`)}><Pencil className="w-4 h-4 mr-1" />Editar</Button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <Dialog open={nova} onOpenChange={setNova}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova trilha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="nt-titulo">Título</Label>
              <Input id="nt-titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="nt-desc">Descrição (opcional)</Label>
              <Textarea id="nt-desc" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Setor</Label>
              <Select value={form.setor_id} onValueChange={(v) => setForm({ ...form, setor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{editaveis.map((s) => <SelectItem key={s.id} value={s.id}>{nomeSetor(setores, s.id)}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="flex items-center gap-2"><Switch id="nt-obr" checked={form.obrigatoria} onCheckedChange={(v) => setForm({ ...form, obrigatoria: v })} />
              <Label htmlFor="nt-obr">Obrigatória</Label></div>
            {form.obrigatoria && (
              <div className="space-y-1.5"><Label htmlFor="nt-prazo">Prazo em dias a partir da atribuição (opcional)</Label>
                <Input id="nt-prazo" type="number" min={1} value={form.prazo_dias} onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })} /></div>
            )}
            <p className="text-xs text-muted-foreground">A trilha nasce como rascunho. Ninguém recebe nada até você publicar.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setNova(false)}>Cancelar</Button><Button onClick={criar}>Criar e editar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
