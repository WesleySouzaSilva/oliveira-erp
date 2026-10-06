import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, Loader2 } from "lucide-react";

type Pedido = {
  id: string;
  titulo: string | null;
  marca: "agro" | "juridico";
  status: string;
  observacao: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  solicitado: "Solicitado",
  em_analise: "Em análise",
  proposta_enviada: "Proposta enviada",
  aceito: "Aceito",
  recusado: "Recusado",
  concluido: "Concluído",
};
const STATUS_STYLE: Record<string, string> = {
  solicitado: "bg-info/15 text-info",
  em_analise: "bg-primary/15 text-primary",
  proposta_enviada: "bg-amber-500/15 text-amber-700",
  aceito: "bg-success/15 text-success",
  recusado: "bg-destructive/15 text-destructive",
  concluido: "bg-muted text-muted-foreground",
};

export default function PortalMeusPedidos() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("pedidos_servico")
        .select("id, titulo, marca, status, observacao, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      setPedidos((data as Pedido[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <PortalLayout>
      <div className="mb-4">
        <h1 className="font-serif text-2xl text-foreground">Meus Pedidos</h1>
        <p className="text-sm text-muted-foreground">Histórico dos serviços solicitados.</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : pedidos.length === 0 ? (
        <Card className="p-8 text-center">
          <Inbox className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <div className="font-medium text-foreground">Nenhum pedido ainda</div>
          <p className="text-sm text-muted-foreground mt-1">
            Explore a aba <span className="text-foreground">Serviços</span> para fazer sua primeira solicitação.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {pedidos.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{p.titulo || "Pedido"}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge variant="outline" className="text-[11px] capitalize">{p.marca}</Badge>
                    <span>Enviado em {new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {p.observacao && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.observacao}</p>
                  )}
                </div>
                <Badge className={STATUS_STYLE[p.status] || ""}>
                  {STATUS_LABEL[p.status] || p.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}