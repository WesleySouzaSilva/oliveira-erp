import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/loaders";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Download, Pencil, ArrowLeft, Eye } from "lucide-react";
import PdfViewer from "@/components/pdf/PdfViewer";
import { detectarTipoLaudo, tituloLaudo } from "@/lib/laudoTitulo";

interface Anexo {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  categoria: string | null;
  tamanho_bytes: number | null;
  created_at: string;
}

const ETAPA_LABELS: Record<string, string> = {
  dados_etapa1: "1. Identificação do produtor e propriedade",
  dados_etapa2: "2. Dados da lavoura / contrato",
  dados_etapa3: "3. Produção e produtividade",
  dados_etapa4: "4. Custos e receitas",
  dados_etapa5: "5. Capacidade de pagamento",
  dados_etapa6: "6. Dados complementares",
};

function humanizeKey(k: string) {
  return k
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

function ValueView({ value }: { value: any }) {
  if (typeof value === "boolean") return <span>{value ? "Sim" : "Não"}</span>;
  if (typeof value === "number") return <span className="tabular-nums">{value.toLocaleString("pt-BR")}</span>;
  if (typeof value === "string") return <span className="whitespace-pre-wrap break-words">{value}</span>;
  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded-md border border-border/70 bg-background p-2">
            {typeof item === "object" && item !== null ? <ObjectView data={item} /> : <ValueView value={item} />}
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object" && value !== null) return <ObjectView data={value} />;
  return <span>—</span>;
}

function ObjectView({ data }: { data: Record<string, any> }) {
  const entries = Object.entries(data).filter(([, v]) => !isEmptyValue(v));
  if (entries.length === 0) return <p className="text-xs text-muted-foreground">Sem informações preenchidas.</p>;
  return (
    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
      {entries.map(([k, v]) => {
        const complex = typeof v === "object" && v !== null;
        return (
          <div key={k} className={complex ? "sm:col-span-2" : ""}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{humanizeKey(k)}</dt>
            <dd className="text-sm text-foreground mt-0.5">
              <ValueView value={v} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5 shadow-card">
      <h2 className="text-sm font-display font-bold text-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function LaudoVisualizar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [laudo, setLaudo] = useState<any>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [previewData, setPreviewData] = useState<Uint8Array | null>(null);
  const [previewHref, setPreviewHref] = useState<string | null>(null);
  const [previewNome, setPreviewNome] = useState<string>("");
  const [previewAnexo, setPreviewAnexo] = useState<Anexo | null>(null);
  const [previewErro, setPreviewErro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [lRes, dRes] = await Promise.all([
        supabase.from("laudos").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("documentos")
          .select("id, nome_arquivo, storage_path, categoria, tamanho_bytes, created_at")
          .eq("laudo_id", id)
          .order("created_at", { ascending: false }),
      ]);
      setLaudo(lRes.data);
      setAnexos((dRes.data || []) as Anexo[]);
      setLoading(false);

      const first = (dRes.data || [])[0] as Anexo | undefined;
      if (first && /\.pdf$/i.test(first.nome_arquivo)) {
        await carregarPreview(first);
      }
    })();
  }, [id]);

  const carregarPreview = async (a: Anexo) => {
    const { data, error } = await supabase.storage.from("laudos").createSignedUrl(a.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error("Erro ao abrir arquivo"); return; }
    setPreviewNome(a.nome_arquivo);
    setPreviewHref(data.signedUrl);
    setPreviewAnexo(a);
    setPreviewData(null);
    setPreviewErro(false);
    try {
      const resp = await fetch(data.signedUrl);
      if (!resp.ok) throw new Error("download falhou");
      const buf = await resp.arrayBuffer();
      setPreviewData(new Uint8Array(buf));
    } catch {
      setPreviewErro(true);
    }
  };

  const abrirAnexo = async (a: Anexo) => {
    if (/\.pdf$/i.test(a.nome_arquivo)) {
      await carregarPreview(a);
      return;
    }
    const { data, error } = await supabase.storage.from("laudos").createSignedUrl(a.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error("Erro ao abrir arquivo"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const baixarAnexo = async (a: Anexo) => {
    const { data, error } = await supabase.storage.from("laudos").createSignedUrl(a.storage_path, 300);
    if (error || !data?.signedUrl) { toast.error("Erro ao gerar download"); return; }
    const el = document.createElement("a");
    el.href = data.signedUrl;
    el.download = a.nome_arquivo;
    el.target = "_blank";
    el.click();
  };

  if (loading) {
    return (
      <AppLayout>
        <ListSkeleton rows={6} />
      </AppLayout>
    );
  }

  if (!laudo) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-sm text-muted-foreground mb-4">Laudo não encontrado.</p>
          <Link to="/laudos" className="text-sm font-semibold text-accent">Voltar para Meus Laudos</Link>
        </div>
      </AppLayout>
    );
  }

  const e1 = (laudo.dados_etapa1 || {}) as Record<string, any>;
  const produtor = e1.nome || e1.nomeProdutor || e1.produtor || "Sem nome";
  const tipo = detectarTipoLaudo(e1.tipo_laudo, anexos.map((a) => a.nome_arquivo));
  const titulo = tituloLaudo(produtor, tipo);
  const etapas = ["dados_etapa1", "dados_etapa2", "dados_etapa3", "dados_etapa4", "dados_etapa5", "dados_etapa6"] as const;

  return (
    <AppLayout>
      <PageHeader
        icon={FileText}
        title={titulo}
        subtitle={`${laudo.numero_laudo} · criado em ${new Date(laudo.created_at).toLocaleDateString("pt-BR")}`}
        breadcrumb={[{ label: "Agro" }, { label: "Meus Laudos", to: "/laudos" }, { label: titulo }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/laudos")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={() => navigate(`/novo-laudo?id=${laudo.id}`)}
              className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground px-4 py-2 rounded-lg text-sm font-semibold shadow-card hover:shadow-card-hover transition-all"
            >
              <Pencil className="w-4 h-4" /> Editar
            </button>
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <StatusBadge status={(anexos.length > 0 && laudo.status !== "exportado" ? "finalizado" : laudo.status) as any} />
        {anexos.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-success/15 text-success">
            <FileText className="w-3 h-3" /> {anexos.length} arquivo{anexos.length > 1 ? "s" : ""} anexado{anexos.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {anexos.length > 0 && (
          <Section title="Arquivos anexados">
            <ul className="space-y-1.5 mb-4">
              {anexos.map((a) => (
                <li key={a.id} className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-background">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{a.nome_arquivo}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {a.categoria || "Sem categoria"} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <button onClick={() => abrirAnexo(a)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10" aria-label="Visualizar">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => baixarAnexo(a)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10" aria-label="Baixar">
                    <Download className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            {previewHref && (
              previewErro ? (
                <div className="rounded-lg border border-border h-[30vh] flex flex-col items-center justify-center gap-2 text-center px-4">
                  <p className="text-sm text-muted-foreground">Não foi possível carregar este PDF.</p>
                  <a href={previewHref} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent">
                    Abrir em nova aba
                  </a>
                </div>
              ) : (
                <PdfViewer
                  data={previewData}
                  href={previewHref}
                  nome={previewNome}
                  onDownload={previewAnexo ? () => baixarAnexo(previewAnexo) : undefined}
                />
              )
            )}
          </Section>
        )}

        {laudo.pdf_url && (
          <Section title="PDF gerado pelo sistema">
            <a href={laudo.pdf_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent inline-flex items-center gap-1.5">
              <Download className="w-4 h-4" /> Abrir PDF
            </a>
          </Section>
        )}

        {etapas.map((k) => {
          const data = laudo[k];
          if (isEmptyValue(data)) return null;
          return (
            <Section key={k} title={ETAPA_LABELS[k]}>
              <ObjectView data={data as Record<string, any>} />
            </Section>
          );
        })}

        {Array.isArray(laudo.hipoteses_selecionadas) && laudo.hipoteses_selecionadas.length > 0 && (
          <Section title="Hipóteses selecionadas">
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
              {laudo.hipoteses_selecionadas.map((h: string, i: number) => <li key={i}>{h}</li>)}
            </ul>
          </Section>
        )}

        {laudo.texto_analise_narrativa && (
          <Section title="Análise narrativa">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{laudo.texto_analise_narrativa}</p>
          </Section>
        )}

        {laudo.texto_conclusao && (
          <Section title="Conclusão">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{laudo.texto_conclusao}</p>
          </Section>
        )}
      </div>
    </AppLayout>
  );
}