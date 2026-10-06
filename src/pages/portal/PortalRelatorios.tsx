import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type Doc = {
  id: string;
  titulo: string;
  descricao: string | null;
  arquivo_path: string;
  arquivo_nome: string | null;
  tamanho_bytes: number | null;
  created_at: string;
};

function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function PortalRelatorios() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // RLS já filtra por empresa do usuário + visivel_cliente + not deleted.
      const { data } = await (supabase as any)
        .from("empresa_documentos")
        .select("id,titulo,descricao,arquivo_path,arquivo_nome,tamanho_bytes,created_at")
        .order("created_at", { ascending: false });
      setDocs((data || []) as Doc[]);
      setLoading(false);
    })();
  }, []);

  const baixar = async (d: Doc) => {
    setDownloading(d.id);
    const { data, error } = await supabase.storage
      .from("empresa-documentos")
      .createSignedUrl(d.arquivo_path, 300);
    setDownloading(null);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar o link");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = d.arquivo_nome || d.titulo;
    a.target = "_blank";
    a.click();
  };

  return (
    <PortalLayout>
      <div className="mb-4">
        <h1 className="font-serif text-2xl text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Documentos que a equipe do escritório disponibilizou para você.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <div className="font-medium text-foreground">Nenhum relatório disponível ainda.</div>
          <p className="text-sm text-muted-foreground mt-1">Quando a equipe publicar um documento para você, ele aparecerá aqui.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map((d) => (
            <Card key={d.id} className="p-4 flex items-start gap-4">
              <div className="mt-0.5">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">{d.titulo}</div>
                {d.descricao && (
                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{d.descricao}</p>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {d.arquivo_nome} · {fmtSize(d.tamanho_bytes)} ·{" "}
                  {format(new Date(d.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => baixar(d)}
                disabled={downloading === d.id}
              >
                {downloading === d.id ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Baixar
              </Button>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}