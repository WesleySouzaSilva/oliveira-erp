import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Demanda = {
  id: string; assunto: string; descricao: string | null; area: string | null;
  prioridade: string; status: string; prazo: string | null; created_at: string;
};
type Interacao = {
  id: string; tipo: string; conteudo: string; created_at: string; visivel_empresa: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta", em_analise: "Em análise",
  aguardando_empresa: "Aguardando sua resposta",
  concluida: "Concluída", cancelada: "Cancelada",
};

export default function PortalDemandaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Demanda | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [dRes, iRes] = await Promise.all([
        (supabase as any).from("consultoria_demandas")
          .select("id,assunto,descricao,area,prioridade,status,prazo,created_at")
          .eq("id", id).maybeSingle(),
        // RLS já filtra para visivel_empresa = true; mantemos filtro explícito
        // como defesa adicional.
        (supabase as any).from("demanda_interacoes")
          .select("id,tipo,conteudo,created_at,visivel_empresa")
          .eq("demanda_id", id)
          .eq("visivel_empresa", true)
          .order("created_at", { ascending: true }),
      ]);
      setD(dRes.data as Demanda | null);
      setInteracoes((iRes.data || []) as Interacao[]);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <PortalLayout><Card className="p-6 text-sm">Carregando…</Card></PortalLayout>;
  if (!d) return (
    <PortalLayout>
      <Card className="p-6 text-sm">Demanda não encontrada.</Card>
      <div className="mt-3"><Button asChild variant="outline" size="sm"><Link to="/portal">Voltar</Link></Button></div>
    </PortalLayout>
  );

  return (
    <PortalLayout>
      <Button asChild variant="ghost" size="sm" className="gap-2 mb-3">
        <Link to="/portal"><ArrowLeft className="h-4 w-4" /> Minhas demandas</Link>
      </Button>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-serif text-xl text-foreground">{d.assunto}</h1>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Aberta em {new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
              {d.area && <span>· Área: {d.area}</span>}
              {d.prazo && <span>· Prazo: {new Date(d.prazo).toLocaleDateString("pt-BR")}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge>{STATUS_LABEL[d.status] || d.status}</Badge>
            <Badge variant="outline">{d.prioridade}</Badge>
          </div>
        </div>
        {d.descricao && (
          <p className="mt-4 text-sm text-foreground whitespace-pre-wrap">{d.descricao}</p>
        )}
      </Card>

      <div className="mt-6">
        <h2 className="font-serif text-lg mb-2 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Atualizações
        </h2>
        {interacoes.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">
            Sua consultoria ainda não publicou atualizações nesta demanda.
          </Card>
        ) : (
          <div className="space-y-2">
            {interacoes.map((i) => (
              <Card key={i.id} className="p-4">
                <div className="text-[11px] text-muted-foreground mb-1">
                  {new Date(i.created_at).toLocaleString("pt-BR")}
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap">{i.conteudo}</div>
              </Card>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          Você só visualiza as atualizações marcadas como visíveis pela consultoria.
          Em breve será possível responder por aqui.
        </p>
      </div>
    </PortalLayout>
  );
}