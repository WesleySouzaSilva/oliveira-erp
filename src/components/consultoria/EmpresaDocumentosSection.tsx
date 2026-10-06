import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { FileText, Upload, Download, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { validarArquivo, ACCEPT_ARQUIVOS } from "@/lib/uploadLimits";

type Doc = {
  id: string;
  titulo: string;
  descricao: string | null;
  arquivo_path: string;
  arquivo_nome: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  visivel_cliente: boolean;
  enviado_por: string | null;
  created_at: string;
};

// Mesma lista aceita pela validação de upload (evita escolher arquivo que será recusado).
const ACCEPT = ACCEPT_ARQUIVOS;

function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function EmpresaDocumentosSection({ empresaId }: { empresaId: string }) {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const confirm = useConfirm();
  const nomePorId = new Map((members || []).map((m) => [m.user_id, m.nome || "Membro"] as const));

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("empresa_documentos")
      .select("*")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setDocs((data || []) as Doc[]);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setFile(null); setTitulo(""); setDescricao(""); setVisivel(false);
  };

  const handleUpload = async () => {
    if (!file || !titulo.trim() || !user) return;
    const erroArquivo = validarArquivo(file);
    if (erroArquivo) {
      toast.error(erroArquivo);
      return;
    }

    setSaving(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${empresaId}/${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("empresa-documentos").upload(path, file, {
      contentType: file.type || undefined,
    });
    if (upErr) {
      setSaving(false);
      toast.error("Erro ao enviar arquivo", { description: upErr.message });
      return;
    }
    const { error: dbErr } = await (supabase as any).from("empresa_documentos").insert({
      empresa_id: empresaId,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      arquivo_path: path,
      arquivo_nome: file.name,
      mime_type: file.type || null,
      tamanho_bytes: file.size,
      visivel_cliente: visivel,
      enviado_por: user.id,
    });
    setSaving(false);
    if (dbErr) {
      await supabase.storage.from("empresa-documentos").remove([path]);
      toast.error("Erro ao registrar documento", { description: dbErr.message });
      return;
    }
    toast.success("Documento enviado");
    setUploadOpen(false);
    reset();
    load();
  };

  const toggleVisivel = async (d: Doc) => {
    const next = !d.visivel_cliente;
    const { error } = await (supabase as any)
      .from("empresa_documentos")
      .update({ visivel_cliente: next })
      .eq("id", d.id);
    if (error) { toast.error("Erro ao alterar visibilidade"); return; }
    setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, visivel_cliente: next } : x)));
    toast.success(next ? "Liberado para o cliente" : "Ocultado do cliente");
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage
      .from("empresa-documentos")
      .createSignedUrl(d.arquivo_path, 300);
    if (error || !data?.signedUrl) { toast.error("Erro ao gerar link"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = d.arquivo_nome || d.titulo;
    a.target = "_blank";
    a.click();
  };

  const excluir = async (d: Doc) => {
    const ok = await confirm({
      title: "Excluir documento?",
      description: `"${d.titulo}" será removido definitivamente do repositório da empresa.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await (supabase as any)
      .from("empresa_documentos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    await supabase.storage.from("empresa-documentos").remove([d.arquivo_path]);
    setDocs((prev) => prev.filter((x) => x.id !== d.id));
    toast.success("Documento removido");
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-serif font-semibold">Documentos</h2>
          <p className="text-xs text-muted-foreground">
            Laudos, pareceres e relatórios. Marque "visível ao cliente" para liberar no portal.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setUploadOpen(true)}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Upload className="w-4 h-4 mr-1" /> Enviar documento
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-10">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3 border rounded-md group">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.titulo}</div>
                {d.descricao && (
                  <div className="text-xs text-muted-foreground truncate">{d.descricao}</div>
                )}
                <div className="text-[11px] text-muted-foreground">
                  {d.arquivo_nome} · {fmtSize(d.tamanho_bytes)} ·{" "}
                  {format(new Date(d.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  {d.enviado_por && ` · ${nomePorId.get(d.enviado_por) || "Membro"}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleVisivel(d)}
                  title={d.visivel_cliente ? "Cliente vê no portal" : "Interno — cliente NÃO vê"}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                    d.visivel_cliente
                      ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d.visivel_cliente ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {d.visivel_cliente ? "Cliente vê" : "Interno"}
                </button>
                <Button variant="ghost" size="sm" onClick={() => download(d)} title="Baixar">
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => excluir(d)} title="Excluir">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Arquivo (PDF, Word ou imagem — até 20MB)</Label>
              <Input
                type="file"
                accept={ACCEPT}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  if (f && !titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
                }}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} · {fmtSize(file.size)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Parecer trabalhista out/2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Visível ao cliente</div>
                <div className="text-xs text-muted-foreground">
                  Se ligado, aparece na aba "Relatórios" do portal da empresa.
                </div>
              </div>
              <Switch checked={visivel} onCheckedChange={setVisivel} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              onClick={handleUpload}
              disabled={!file || !titulo.trim() || saving}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</> : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}