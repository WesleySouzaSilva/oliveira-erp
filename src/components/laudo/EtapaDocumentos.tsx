import { useState, useCallback } from "react";
import { Upload, FileText, Trash2, Sparkles, CheckCircle, Camera, Newspaper, AlertTriangle, Search, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validarArquivos } from "@/lib/uploadLimits";


interface Documento {
  id?: string;
  nome_arquivo: string;
  categoria: string;
  storage_path: string;
  tamanho_bytes: number;
}

interface Props {
  laudoId: string | null;
  documentos: Documento[];
  onDocumentosChange: (docs: Documento[]) => void;
  municipio?: string;
  uf?: string;
  cultura?: string;
  safra?: string;
}

const categorias = [
  { value: "contrato", label: "Contrato de financiamento" },
  { value: "matricula", label: "Matrícula do imóvel" },
  { value: "car", label: "CAR / Certidão ambiental" },
  { value: "nota_fiscal", label: "Notas fiscais de insumos" },
  { value: "laudo_anterior", label: "Laudo anterior" },
  { value: "foto_lavoura", label: "📸 Foto de lavoura" },
  { value: "foto_propriedade", label: "📸 Foto da propriedade" },
  { value: "decreto_calamidade", label: "📋 Decreto de calamidade" },
  { value: "recorte_noticia", label: "📰 Recorte de notícia" },
  { value: "outros", label: "Outros documentos" },
];

const fotoCategorias = ["foto_lavoura", "foto_propriedade"];
const evidenciaCategorias = ["decreto_calamidade", "recorte_noticia"];

export function EtapaDocumentos({ laudoId, documentos, onDocumentosChange, municipio, uf, cultura, safra }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("contrato");
  const [iaStatus, setIaStatus] = useState<"idle" | "processing" | "done">("idle");
  const [buscandoNoticias, setBuscandoNoticias] = useState(false);
  const [noticiasEncontradas, setNoticiasEncontradas] = useState<Array<{ titulo: string; fonte: string; url: string; resumo: string }>>([]);
  const [buscandoDecretos, setBuscandoDecretos] = useState(false);
  const [decretosEncontrados, setDecretosEncontrados] = useState<Array<{ titulo: string; orgao: string; url: string; data: string }>>([]);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!laudoId) {
      toast.error("Salve o laudo primeiro (avance pela etapa 1).");
      return;
    }
    const erroArquivo = validarArquivos(files);
    if (erroArquivo) { toast.error(erroArquivo); return; }
    setUploading(true);

    const newDocs: Documento[] = [];

    for (const file of Array.from(files)) {
      const path = `${laudoId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("laudos").upload(path, file);
      if (error) {
        toast.error(`Erro ao enviar ${file.name}`);
        continue;
      }

      const { data: user } = await supabase.auth.getUser();
      const { data: doc, error: dbErr } = await supabase
        .from("documentos")
        .insert({
          laudo_id: laudoId,
          nome_arquivo: file.name,
          categoria: categoriaSelecionada,
          storage_path: path,
          tamanho_bytes: file.size,
          user_id: user.user!.id,
        })
        .select()
        .single();

      if (dbErr) {
        toast.error(`Erro ao registrar ${file.name}`);
      } else {
        newDocs.push(doc as Documento);
      }
    }

    onDocumentosChange([...documentos, ...newDocs]);
    setUploading(false);
    if (newDocs.length) toast.success(`${newDocs.length} documento(s) enviado(s)`);
  }, [laudoId, categoriaSelecionada, documentos, onDocumentosChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeDoc = async (doc: Documento) => {
    await supabase.storage.from("laudos").remove([doc.storage_path]);
    if (doc.id) await supabase.from("documentos").delete().eq("id", doc.id);
    onDocumentosChange(documentos.filter((d) => d.storage_path !== doc.storage_path));
    toast.success("Documento removido");
  };

  const runIaAnalysis = async () => {
    if (!documentos.length) { toast.error("Envie documentos primeiro"); return; }
    setIaStatus("processing");
    try {
      const { data, error } = await supabase.functions.invoke("ai-laudo", {
        body: {
          action: "analyze_documents",
          context: {
            documentos: documentos.map((d) => ({ nome: d.nome_arquivo, categoria: d.categoria })),
            dadosAtuais: {},
          },
        },
      });
      if (error) throw error;
      setIaStatus("done");
      toast.success("Análise de IA concluída");
    } catch (err: any) {
      setIaStatus("idle");
      toast.error(err.message || "Erro na análise de IA");
    }
  };

  const buscarNoticias = async () => {
    if (!municipio && !cultura) {
      toast.error("Preencha município e cultura na Etapa 1 para buscar notícias.");
      return;
    }
    setBuscandoNoticias(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-laudo", {
        body: {
          action: "search_news",
          context: {
            municipio: municipio || "",
            uf: uf || "",
            cultura: cultura || "",
            safra: safra || "",
          },
        },
      });
      if (error) throw error;
      const content = data?.content || "";
      // Parse AI response into structured news items
      const items = parseNewsItems(content);
      setNoticiasEncontradas(items);
      if (items.length === 0) toast.info("Nenhuma notícia relevante encontrada.");
      else toast.success(`${items.length} notícia(s) encontrada(s)`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar notícias");
    }
    setBuscandoNoticias(false);
  };

  const buscarDecretos = async () => {
    if (!municipio && !uf) {
      toast.error("Preencha município e UF na Etapa 1 para buscar decretos.");
      return;
    }
    setBuscandoDecretos(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-laudo", {
        body: {
          action: "search_decrees",
          context: {
            municipio: municipio || "",
            uf: uf || "",
            safra: safra || "",
          },
        },
      });
      if (error) throw error;
      const content = data?.content || "";
      const items = parseDecreeItems(content);
      setDecretosEncontrados(items);
      if (items.length === 0) toast.info("Nenhum decreto encontrado.");
      else toast.success(`${items.length} decreto(s) encontrado(s)`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar decretos");
    }
    setBuscandoDecretos(false);
  };

  const parseNewsItems = (text: string) => {
    const items: Array<{ titulo: string; fonte: string; url: string; resumo: string }> = [];
    const blocks = text.split(/\n(?=\d+\.|[-•])/);
    for (const block of blocks) {
      const titleMatch = block.match(/(?:título|notícia|manchete)[:\s]*(.+)/i) || block.match(/^\d+\.\s*(.+)/);
      const fonteMatch = block.match(/(?:fonte|veículo|jornal)[:\s]*(.+)/i);
      const urlMatch = block.match(/(?:url|link)[:\s]*(https?:\/\/\S+)/i);
      const resumoMatch = block.match(/(?:resumo|descrição)[:\s]*(.+)/i);
      if (titleMatch) {
        items.push({
          titulo: titleMatch[1].trim().replace(/\*\*/g, ""),
          fonte: fonteMatch?.[1]?.trim() || "Fonte não identificada",
          url: urlMatch?.[1]?.trim() || "",
          resumo: resumoMatch?.[1]?.trim() || block.slice(0, 200).trim(),
        });
      }
    }
    if (items.length === 0 && text.trim()) {
      items.push({ titulo: "Resultado da busca", fonte: "IA", url: "", resumo: text.slice(0, 500) });
    }
    return items;
  };

  const parseDecreeItems = (text: string) => {
    const items: Array<{ titulo: string; orgao: string; url: string; data: string }> = [];
    const blocks = text.split(/\n(?=\d+\.|[-•])/);
    for (const block of blocks) {
      const titleMatch = block.match(/(?:decreto|portaria|resolução|título)[:\s]*(.+)/i) || block.match(/^\d+\.\s*(.+)/);
      const orgaoMatch = block.match(/(?:órgão|emissor|publicação)[:\s]*(.+)/i);
      const urlMatch = block.match(/(?:url|link)[:\s]*(https?:\/\/\S+)/i);
      const dataMatch = block.match(/(?:data|publicado em)[:\s]*(.+)/i);
      if (titleMatch) {
        items.push({
          titulo: titleMatch[1].trim().replace(/\*\*/g, ""),
          orgao: orgaoMatch?.[1]?.trim() || "Órgão não identificado",
          url: urlMatch?.[1]?.trim() || "",
          data: dataMatch?.[1]?.trim() || "",
        });
      }
    }
    if (items.length === 0 && text.trim()) {
      items.push({ titulo: "Resultado da busca", orgao: "IA", url: "", data: "" });
    }
    return items;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const fotos = documentos.filter((d) => fotoCategorias.includes(d.categoria));
  const evidencias = documentos.filter((d) => evidenciaCategorias.includes(d.categoria));
  const outrosDocs = documentos.filter((d) => !fotoCategorias.includes(d.categoria) && !evidenciaCategorias.includes(d.categoria));

  return (
    <div className="space-y-8">
      {/* Upload de Documentos */}
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">Upload de Documentos</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Envie contratos, notas fiscais, fotos da lavoura, decretos de calamidade e recortes de notícias.
        </p>

        {/* Categoria selector */}
        <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-2 block">Categoria do documento</label>
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategoriaSelecionada(c.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  categoriaSelecionada === c.value
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
          }`}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.accept = fotoCategorias.includes(categoriaSelecionada)
              ? ".jpg,.jpeg,.png,.webp,.heic"
              : ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx";
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) handleFiles(files);
            };
            input.click();
          }}
        >
          {fotoCategorias.includes(categoriaSelecionada) ? (
            <Camera className={`w-10 h-10 mx-auto mb-3 ${dragging ? "text-accent" : "text-muted-foreground"}`} />
          ) : (
            <Upload className={`w-10 h-10 mx-auto mb-3 ${dragging ? "text-accent" : "text-muted-foreground"}`} />
          )}
          {uploading ? (
            <p className="text-sm text-accent font-medium">Enviando...</p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {fotoCategorias.includes(categoriaSelecionada)
                  ? "Arraste fotos aqui ou clique para selecionar"
                  : "Arraste arquivos aqui ou clique para selecionar"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {fotoCategorias.includes(categoriaSelecionada)
                  ? "JPG, PNG, WebP — fotos serão incluídas no Laudo de Perda"
                  : "PDF, imagens, Word, Excel — até 20 MB por arquivo"}
              </p>
            </>
          )}
        </div>
      </section>

      {/* Fotos da Lavoura */}
      {fotos.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Camera className="w-4 h-4 text-accent" />
            Fotos da Lavoura / Propriedade ({fotos.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {fotos.map((doc) => {
              const isImage = /\.(jpg|jpeg|png|webp)$/i.test(doc.nome_arquivo);
              return (
                <div key={doc.storage_path} className="relative group bg-card border border-border rounded-lg overflow-hidden">
                  {isImage ? (
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <FotoPreview storagePath={doc.storage_path} />
                    </div>
                  ) : (
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-medium text-foreground truncate">{doc.nome_arquivo}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {categorias.find((c) => c.value === doc.categoria)?.label}
                    </p>
                  </div>
                  <button
                    onClick={() => removeDoc(doc)}
                    className="absolute top-1 right-1 bg-destructive/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">
            ✅ Essas fotos serão inseridas automaticamente no Laudo de Perda (PDF).
          </p>
        </section>
      )}

      {/* Evidências (Decretos + Notícias) */}
      {evidencias.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-accent" />
            Decretos e Notícias ({evidencias.length})
          </h3>
          <div className="space-y-2">
            {evidencias.map((doc) => (
              <div key={doc.storage_path} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                {doc.categoria === "decreto_calamidade" ? (
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                ) : (
                  <Newspaper className="w-5 h-5 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.nome_arquivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {categorias.find((c) => c.value === doc.categoria)?.label}
                    {doc.tamanho_bytes ? ` · ${formatSize(doc.tamanho_bytes)}` : ""}
                  </p>
                </div>
                <button onClick={() => removeDoc(doc)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">
            ✅ Serão incluídos como anexos no Laudo de Perda (PDF).
          </p>
        </section>
      )}

      {/* Outros documentos */}
      {outrosDocs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Documentos enviados ({outrosDocs.length})
          </h3>
          <div className="space-y-2">
            {outrosDocs.map((doc) => (
              <div key={doc.storage_path} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.nome_arquivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {categorias.find((c) => c.value === doc.categoria)?.label || doc.categoria}
                    {doc.tamanho_bytes ? ` · ${formatSize(doc.tamanho_bytes)}` : ""}
                  </p>
                </div>
                <button onClick={() => removeDoc(doc)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Busca automática de Decretos e Notícias */}
      <section className="grid sm:grid-cols-2 gap-4">
        {/* Decretos de calamidade */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-1">Decretos de Calamidade</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Busca automática de decretos de emergência/calamidade para {municipio || "o município"}/{uf || "UF"}.
              </p>
              <button
                onClick={buscarDecretos}
                disabled={buscandoDecretos || (!municipio && !uf)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-warning/10 text-warning hover:bg-warning/20 disabled:opacity-40 transition-all flex items-center gap-2"
              >
                {buscandoDecretos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {buscandoDecretos ? "Buscando..." : "Buscar decretos"}
              </button>
              {decretosEncontrados.length > 0 && (
                <div className="mt-3 space-y-2">
                  {decretosEncontrados.map((d, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg p-3 text-xs">
                      <p className="font-semibold text-foreground">{d.titulo}</p>
                      <p className="text-muted-foreground">{d.orgao} {d.data && `· ${d.data}`}</p>
                      {d.url && (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1 mt-1">
                          <ExternalLink className="w-3 h-3" /> Acessar
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notícias */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Newspaper className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-1">Notícias Relevantes</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Busca automática de notícias sobre {cultura || "a cultura"} na safra {safra || "atual"} em {municipio || "sua região"}.
              </p>
              <button
                onClick={buscarNoticias}
                disabled={buscandoNoticias || (!municipio && !cultura)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 transition-all flex items-center gap-2"
              >
                {buscandoNoticias ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {buscandoNoticias ? "Buscando..." : "Buscar notícias"}
              </button>
              {noticiasEncontradas.length > 0 && (
                <div className="mt-3 space-y-2">
                  {noticiasEncontradas.map((n, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg p-3 text-xs">
                      <p className="font-semibold text-foreground">{n.titulo}</p>
                      <p className="text-muted-foreground">{n.fonte}</p>
                      <p className="text-muted-foreground mt-1">{n.resumo.slice(0, 150)}...</p>
                      {n.url && (
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1 mt-1">
                          <ExternalLink className="w-3 h-3" /> Ver notícia
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* IA Analysis */}
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground mb-1">Análise com IA</h3>
            <p className="text-xs text-muted-foreground mb-3">
              A IA pode extrair dados dos documentos enviados e pré-preencher campos das próximas etapas.
            </p>
            {iaStatus === "idle" && (
              <button
                onClick={runIaAnalysis}
                disabled={!documentos.length}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:shadow-card-hover disabled:opacity-40 transition-all"
              >
                Analisar documentos
              </button>
            )}
            {iaStatus === "processing" && (
              <div className="flex items-center gap-2 text-sm text-accent">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                Analisando documentos...
              </div>
            )}
            {iaStatus === "done" && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle className="w-4 h-4" />
                Análise concluída — dados pré-preenchidos nas próximas etapas.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function FotoPreview({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useState(() => {
    supabase.storage.from("laudos").createSignedUrl(storagePath, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
      else setError(true);
    });
  });

  if (error || !url) {
    return <Camera className="w-8 h-8 text-muted-foreground" />;
  }
  return <img src={url} alt="Foto" className="w-full h-full object-cover" />;
}
