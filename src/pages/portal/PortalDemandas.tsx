import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, Inbox } from "lucide-react";

type Demanda = {
  id: string; assunto: string; area: string | null; prioridade: string;
  status: string; prazo: string | null; created_at: string;
};
type Empresa = { id: string; razao_social: string; nome_fantasia: string | null };

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_empresa: "Aguardando sua resposta",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const STATUS_STYLE: Record<string, string> = {
  aberta: "bg-info/15 text-info",
  em_analise: "bg-primary/15 text-primary",
  aguardando_empresa: "bg-amber-500/15 text-amber-700",
  concluida: "bg-success/15 text-success",
  cancelada: "bg-muted text-muted-foreground",
};
const PRIORIDADE_STYLE: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-info/15 text-info",
  alta: "bg-amber-500/15 text-amber-700",
  urgente: "bg-destructive/15 text-destructive",
};

export default function PortalDemandas() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [eRes, dRes] = await Promise.all([
        (supabase as any).from("empresas_consultoria")
          .select("id, razao_social, nome_fantasia").maybeSingle(),
        (supabase as any).from("consultoria_demandas")
          .select("id,assunto,area,prioridade,status,prazo,created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ]);
      setEmpresa(eRes.data as Empresa | null);
      setDemandas((dRes.data || []) as Demanda[]);
      setLoading(false);
    })();
  }, []);

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-foreground">
          {empresa?.nome_fantasia || empresa?.razao_social || "Suas demandas"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o andamento das demandas em consultoria. Esta visão é somente leitura.
        </p>
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Carregando…</Card>
      ) : demandas.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
          <div className="font-medium text-foreground">Nenhuma demanda registrada ainda</div>
          <div className="text-sm text-muted-foreground mt-1">
            Quando sua consultoria abrir uma demanda, ela aparecerá aqui.
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {demandas.map((d) => (
            <Link key={d.id} to={`/portal/demandas/${d.id}`} className="block">
              <Card className="p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{d.assunto}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {d.area && <span>Área: {d.area}</span>}
                      <span>Aberta em {new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
                      {d.prazo && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          Prazo {new Date(d.prazo).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={STATUS_STYLE[d.status] || ""}>
                      {STATUS_LABEL[d.status] || d.status}
                    </Badge>
                    <Badge variant="outline" className={PRIORIDADE_STYLE[d.prioridade] || ""}>
                      {d.prioridade}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}