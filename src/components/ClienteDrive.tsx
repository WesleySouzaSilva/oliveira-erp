import { useState, useEffect, useCallback } from "react";
import { Upload, FileText, Trash2, FolderOpen, Download, Plus, Loader2, HardDrive, Image, File } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { notifyOrg } from "@/lib/orgNotify";
import { User } from "lucide-react";
import { validarArquivos, ACCEPT_ARQUIVOS } from "@/lib/uploadLimits";


interface ArquivoCliente {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number;
  pasta: string;
  created_at: string;
  user_id?: string | null;
}

interface DocumentoLaudo {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number | null;
  categoria: string | null;
  created_at: string;
  laudo_numero?: string;
}

interface Props {
  nomeCliente: string;
}

const PASTAS_PADRAO = ["Geral", "Contratos", "Notas Fiscais", "Fotos", "Jurídico"];

const getFileIcon = (nome: string) => {
  if (/\.(jpg|jpeg|png|webp|gif|heic)$/i.test(nome)) return <Image className="w-5 h-5 text-accent" />;
  if (/\.pdf$/i.test(nome)) return <FileText className="w-5 h-5 text-destructive" />;
  return <File className="w-5 h-5 text-primary" />;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export function ClienteDrive({ nomeCliente }: Props) {
  const { user } = useAuth();
  const { orgId, members } = useOrgMembers();
  const nomePorUserId = new Map((members || []).map((m) => [m.user_id, m.nome || "Membro"] as const));
  const labelAutor = (uid?: string | null) => (uid ? nomePorUserId.get(uid) || "Membro" : "Membro");
  const [arquivos, setArquivos] = useState<ArquivoCliente[]>([]);
  const [docLaudos, setDocLaudos] = useState<DocumentoLaudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pastaAtiva, setPastaAtiva] = useState("Todos");
  const [novaPasta, setNovaPasta] = useState("");
  const [criandoPasta, setCriandoPasta] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pastasCustom = [...new Set(arquivos.map((a) => a.pasta))];
  const todasPastas = Array.from(
    new Set(["Todos", "Laudos", ...PASTAS_PADRAO, ...pastasCustom])
  );

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Load free uploads
    const { data: arqs } = await supabase
      .from("arquivos_cliente")
      .select("*").is("deleted_at", null)
      .ilike("nome_cliente", nomeCliente)
      .order("created_at", { ascending: false });

    // Load laudo-linked docs by finding laudos for this client
    const { data: laudos } = await supabase
      .from("laudos")
      .select("id, numero_laudo, dados_etapa1")
      .order("created_at", { ascending: false });

    const clienteLaudos = (laudos || []).filter((l: any) => {
      const d = l.dados_etapa1 as any;
      return d?.nomeProdutor?.toLowerCase().includes(nomeCliente.toLowerCase()) ||
        d?.nomePropriedade?.toLowerCase().includes(nomeCliente.toLowerCase());
    });

    let laudoDocs: DocumentoLaudo[] = [];
    if (clienteLaudos.length > 0) {
      const laudoIds = clienteLaudos.map((l: any) => l.id);
      const { data: docs } = await supabase
        .from("documentos")
        .select("*")
        .in("laudo_id", laudoIds)
        .order("created_at", { ascending: false });

      laudoDocs = (docs || []).map((d: any) => ({
        ...d,
        laudo_numero: clienteLaudos.find((l: any) => l.id === d.laudo_id)?.numero_laudo || "—",
      }));
    }

    setArquivos(arqs || []);
    setDocLaudos(laudoDocs);
    setLoading(false);
  }, [user, nomeCliente]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpload = useCallback(async (files: FileList) => {
    if (!user) return;
    const erroArquivo = validarArquivos(files);
    if (erroArquivo) { toast.error(erroArquivo); return; }
    setUploading(true);
    let count = 0;


    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${nomeCliente.replace(/\s+/g, "_")}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("cliente-drive").upload(path, file);
      if (uploadErr) { toast.error(`Erro ao enviar ${file.name}`); continue; }

      const pasta = pastaAtiva !== "Todos" && pastaAtiva !== "Laudos" ? pastaAtiva : "Geral";
      const { error: dbErr } = await supabase.from("arquivos_cliente").insert({
        user_id: user.id,
        organizacao_id: orgId,
        nome_cliente: nomeCliente,
        nome_arquivo: file.name,
        storage_path: path,
        tamanho_bytes: file.size,
        pasta,
      });
      if (dbErr) { toast.error(`Erro ao registrar ${file.name}`); continue; }
      count++;
    }

    if (count) {
      toast.success(`${count} arquivo(s) enviado(s)`);
      await notifyOrg({
        organizacaoId: orgId,
        authorUserId: user.id,
        mensagem: `${count} arquivo(s) adicionados ao Drive de ${nomeCliente}`,
        tipo: "info",
      });
    }
    setUploading(false);
    loadData();
  }, [user, nomeCliente, pastaAtiva, loadData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const isLaudoMirror = (path: string) => path.includes("/external/");

  const handleDelete = async (arq: ArquivoCliente) => {
    // Espelhos de laudos vivem no bucket "laudos" e são gerenciados pela Fase 1.
    // Aqui só removemos o registro de Drive — o arquivo original permanece intacto.
    if (!isLaudoMirror(arq.storage_path)) {
      await supabase.storage.from("cliente-drive").remove([arq.storage_path]);
    }
    await supabase.from("arquivos_cliente").delete().eq("id", arq.id);
    setArquivos((prev) => prev.filter((a) => a.id !== arq.id));
    toast.success("Arquivo removido do Drive");
  };

  const handleDownload = async (path: string, bucket: string, nome: string) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = nome;
      a.target = "_blank";
      a.click();
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  // Filter files by active folder
  const arquivosFiltrados = pastaAtiva === "Todos"
    ? arquivos
    : pastaAtiva === "Laudos"
      ? []
      : arquivos.filter((a) => a.pasta === pastaAtiva);

  const showLaudoDocs = pastaAtiva === "Todos" || pastaAtiva === "Laudos";
  const totalArquivos = arquivos.length + docLaudos.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-display font-bold text-foreground">Drive do Cliente</h2>
          <span className="text-xs text-muted-foreground">({totalArquivos} arquivo{totalArquivos !== 1 ? "s" : ""})</span>
        </div>
      </div>

      {/* Folder tabs */}
      <div className="flex flex-wrap gap-2">
        {todasPastas.map((p) => (
          <button
            key={p}
            onClick={() => setPastaAtiva(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              pastaAtiva === p
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground hover:bg-secondary"
            }`}
          >
            <FolderOpen className="w-3 h-3" />
            {p}
          </button>
        ))}
        {/* New folder */}
        {criandoPasta ? (
          <div className="flex items-center gap-1">
            <Input
              value={novaPasta}
              onChange={(e) => setNovaPasta(e.target.value)}
              placeholder="Nome da pasta"
              className="h-7 w-32 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && novaPasta.trim()) {
                  setCriandoPasta(false);
                  setPastaAtiva(novaPasta.trim());
                  setNovaPasta("");
                } else if (e.key === "Escape") {
                  setCriandoPasta(false);
                  setNovaPasta("");
                }
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setCriandoPasta(true)}
            className="px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition-all flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Nova pasta
          </button>
        )}
      </div>

      {/* Upload zone */}
      {pastaAtiva !== "Laudos" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.accept = ACCEPT_ARQUIVOS;

            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) handleUpload(files);
            };
            input.click();
          }}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
            dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-accent">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Enviando...</span>
            </div>
          ) : (
            <>
              <Upload className={`w-8 h-8 mx-auto mb-2 ${dragging ? "text-accent" : "text-muted-foreground"}`} />
              <p className="text-sm font-medium text-foreground">Arraste arquivos ou clique para enviar</p>
              <p className="text-xs text-muted-foreground mt-1">
                Salvando em: <span className="font-semibold text-accent">{pastaAtiva === "Todos" ? "Geral" : pastaAtiva}</span>
              </p>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando arquivos...</div>
      ) : (
        <div className="space-y-4">
          {/* Free uploads */}
          {arquivosFiltrados.length > 0 && (
            <div className="space-y-2">
              {pastaAtiva === "Todos" && (
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Arquivos do Drive</h3>
              )}
              {arquivosFiltrados.map((arq) => (
                <div key={arq.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 group hover:border-accent/30 transition-all">
                  {getFileIcon(arq.nome_arquivo)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{arq.nome_arquivo}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{arq.pasta} · {formatSize(arq.tamanho_bytes)} · {format(new Date(arq.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                      {arq.user_id && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-muted px-1.5 py-0.5 rounded">
                          <User className="w-2.5 h-2.5" />
                          {labelAutor(arq.user_id)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(arq.storage_path, isLaudoMirror(arq.storage_path) ? "laudos" : "cliente-drive", arq.nome_arquivo); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Baixar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(arq); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Laudo-linked documents */}
          {showLaudoDocs && docLaudos.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Documentos de Laudos</h3>
              {docLaudos.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 group hover:border-accent/30 transition-all">
                  {getFileIcon(doc.nome_arquivo)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.nome_arquivo}</p>
                    <p className="text-xs text-muted-foreground">
                      Laudo {doc.laudo_numero} · {doc.categoria || "Sem categoria"} · {formatSize(doc.tamanho_bytes)} · {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(doc.storage_path, "laudos", doc.nome_arquivo); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Baixar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {arquivosFiltrados.length === 0 && (!showLaudoDocs || docLaudos.length === 0) && (
            <div className="text-center py-10">
              <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum arquivo nesta pasta</p>
              {pastaAtiva !== "Laudos" && (
                <p className="text-xs text-muted-foreground mt-1">Arraste ou clique na área acima para enviar</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
