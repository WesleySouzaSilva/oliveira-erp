import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Plus, Trash2, BookOpen, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Tipo = "regimento" | "playbook";

interface Item {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  versao: string | null;
  arquivo_url: string | null;
  storage_path: string | null;
  setor?: string | null;
  created_at: string;
}

export function RegimentosPlaybooksTab() {
  const { user } = useAuth();
  const { orgId, isAdmin } = useOrgMembers();
  const [regimentos, setRegimentos] = useState<Item[]>([]);
  const [playbooks, setPlaybooks] = useState<Item[]>([]);
  const [meuSetor, setMeuSetor] = useState<string | null>(null);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState<Tipo | null>(null);

  // form
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [versao, setVersao] = useState("1.0");
  const [setor, setSetor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId || !user) return;
    void loadAll();
  }, [orgId, user]);

  async function loadAll() {
    setLoading(true);
    const [profRes, regRes, pbRes] = await Promise.all([
      supabase.from("profiles").select("setor").eq("id", user!.id).maybeSingle(),
      (supabase as any).from("rh_regimentos").select("*").eq("organizacao_id", orgId).order("created_at", { ascending: false }),
      (supabase as any).from("rh_playbooks").select("*").eq("organizacao_id", orgId).order("setor").order("created_at", { ascending: false }),
    ]);
    setMeuSetor(profRes.data?.setor || null);
    setRegimentos(regRes.data || []);
    setPlaybooks(pbRes.data || []);

    if (isAdmin) {
      const { data: profs } = await supabase
        .from("profiles_publico")
        .select("setor")
        .not("setor", "is", null);
      const setores = Array.from(new Set((profs || []).map((p: any) => p.setor).filter(Boolean)));
      setSetoresDisponiveis(setores as string[]);
    }
    setLoading(false);
  }

  function resetForm() {
    setTitulo(""); setDescricao(""); setCategoria(""); setVersao("1.0");
    setSetor(""); setFile(null);
  }

  async function handleSave() {
    if (!openDialog || !titulo.trim() || !file || !orgId) {
      toast.error("Preencha o título e selecione um arquivo.");
      return;
    }
    if (openDialog === "playbook" && !setor.trim()) {
      toast.error("Selecione o setor do playbook.");
      return;
    }
    setSaving(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const fileName = `${Date.now()}_${titulo.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${ext}`;
      const path = openDialog === "regimento"
        ? `regimentos/${orgId}/${fileName}`
        : `playbooks/${orgId}/${setor.toLowerCase()}/${fileName}`;

      const { error: upErr } = await supabase.storage.from("rh-arquivos").upload(path, file);
      if (upErr) throw upErr;

      const payload: any = {
        organizacao_id: orgId,
        titulo, descricao: descricao || null, categoria: categoria || null,
        versao, storage_path: path, arquivo_url: path,
        created_by: user!.id,
      };
      if (openDialog === "playbook") payload.setor = setor;

      const tabela = openDialog === "regimento" ? "rh_regimentos" : "rh_playbooks";
      const { error: insErr } = await (supabase as any).from(tabela).insert(payload);
      if (insErr) throw insErr;

      toast.success(openDialog === "regimento" ? "Regimento enviado" : "Playbook enviado");
      setOpenDialog(null);
      resetForm();
      void loadAll();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(item: Item) {
    if (!item.storage_path) return;
    const { data, error } = await supabase.storage.from("rh-arquivos").createSignedUrl(item.storage_path, 300);
    if (error || !data) { toast.error("Não foi possível baixar"); return; }
    window.open(data.signedUrl, "_blank");
  }

  const askConfirm = useConfirm();
  async function handleDelete(tipo: Tipo, item: Item) {
    if (!(await askConfirm({ title: "Excluir item", description: `Excluir "${item.titulo}"?`, destructive: true, confirmText: "Excluir" }))) return;
    if (item.storage_path) {
      await supabase.storage.from("rh-arquivos").remove([item.storage_path]);
    }
    const tabela = tipo === "regimento" ? "rh_regimentos" : "rh_playbooks";
    const { error } = await (supabase as any).from(tabela).delete().eq("id", item.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Excluído");
    void loadAll();
  }

  // agrupa playbooks por setor
  const playbooksBySetor = playbooks.reduce<Record<string, Item[]>>((acc, p) => {
    const s = p.setor || "Geral";
    (acc[s] = acc[s] || []).push(p);
    return acc;
  }, {});

  if (loading) {
    return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* Regimentos Internos */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Regimentos Internos</h2>
            <Badge variant="secondary" className="text-[10px]">Visível a toda a equipe</Badge>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => { resetForm(); setOpenDialog("regimento"); }}>
              <Plus className="w-4 h-4 mr-1" /> Novo regimento
            </Button>
          )}
        </div>
        {regimentos.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum regimento publicado.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {regimentos.map(r => (
              <ItemCard key={r.id} item={r} canDelete={isAdmin} onDownload={() => handleDownload(r)} onDelete={() => handleDelete("regimento", r)} />
            ))}
          </div>
        )}
      </section>

      {/* Playbooks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Playbooks por Setor</h2>
            {!isAdmin && meuSetor && (
              <Badge variant="secondary" className="text-[10px]">
                <Lock className="w-3 h-3 mr-1" /> Setor: {meuSetor}
              </Badge>
            )}
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => { resetForm(); setOpenDialog("playbook"); }}>
              <Plus className="w-4 h-4 mr-1" /> Novo playbook
            </Button>
          )}
        </div>
        {!isAdmin && !meuSetor && (
          <Card className="p-4 text-sm text-muted-foreground border-amber-500/30 bg-amber-500/5">
            Seu setor ainda não foi definido no seu perfil. Peça ao administrador para preencher o campo <strong>Setor</strong> para liberar o acesso ao playbook da sua área.
          </Card>
        )}
        {Object.keys(playbooksBySetor).length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground mt-2">
            Nenhum playbook disponível {isAdmin ? "" : "para o seu setor"}.
          </Card>
        ) : (
          <div className="space-y-5">
            {Object.entries(playbooksBySetor).map(([s, items]) => (
              <div key={s}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge>{s}</Badge>
                  <span className="text-xs text-muted-foreground">{items.length} documento(s)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map(p => (
                    <ItemCard key={p.id} item={p} canDelete={isAdmin} onDownload={() => handleDownload(p)} onDelete={() => handleDelete("playbook", p)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dialog de upload */}
      <Dialog open={openDialog !== null} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {openDialog === "regimento" ? "Novo regimento interno" : "Novo playbook de setor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Código de Conduta" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} />
            </div>
            {openDialog === "playbook" && (
              <div>
                <Label>Setor *</Label>
                <Select value={setor} onValueChange={setSetor}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    {setoresDisponiveis.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    <SelectItem value="Jurídico">Jurídico</SelectItem>
                    <SelectItem value="Agronômico">Agronômico</SelectItem>
                    <SelectItem value="Comercial">Comercial</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Administrativo">Administrativo</SelectItem>
                    <SelectItem value="Pós-venda">Pós-venda</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Só pessoas com este setor no perfil verão este playbook.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex.: Processo" />
              </div>
              <div>
                <Label>Versão</Label>
                <Input value={versao} onChange={e => setVersao(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Arquivo (PDF, DOCX...) *</Label>
              <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.xlsx,.ppt,.pptx" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Enviando..." : "Publicar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemCard({ item, canDelete, onDownload, onDelete }: {
  item: Item; canDelete: boolean; onDownload: () => void; onDelete: () => void;
}) {
  return (
    <Card className="p-4 hover:border-primary/40 transition">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{item.titulo}</h4>
            {item.versao && <Badge variant="outline" className="text-[10px]">v{item.versao}</Badge>}
          </div>
          {item.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descricao}</p>}
          {item.categoria && <p className="text-[11px] text-muted-foreground mt-1">{item.categoria}</p>}
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={onDownload}>
              <Download className="w-3.5 h-3.5 mr-1" /> Abrir
            </Button>
            {canDelete && (
              <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}