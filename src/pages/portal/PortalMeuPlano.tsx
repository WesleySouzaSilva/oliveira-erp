import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, CalendarDays, Layers, Loader2 } from "lucide-react";

type Plano = {
  avenca_id: string;
  empresa_id: string;
  titulo: string | null;
  status: string | null;
  escopo_areas: string[] | null;
  dia_vencimento: number | null;
  valor_mensal: number | null;
};

const STATUS_STYLE: Record<string, string> = {
  ativo: "bg-success/15 text-success",
  ativa: "bg-success/15 text-success",
  suspensa: "bg-amber-500/15 text-amber-700",
  encerrada: "bg-muted text-muted-foreground",
};

function formatBRL(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PortalMeuPlano() {
  const [loading, setLoading] = useState(true);
  const [plano, setPlano] = useState<Plano | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("portal_empresa_plano_view")
        .select("*")
        .maybeSingle();
      setPlano(data ?? null);
      setLoading(false);
    })();
  }, []);

  return (
    <PortalLayout>
      <div className="mb-4">
        <h1 className="font-serif text-2xl text-foreground">Meu Plano</h1>
        <p className="text-sm text-muted-foreground">Dados da sua avença ativa.</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !plano ? (
        <Card className="p-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <div className="font-medium text-foreground">Você ainda não possui um plano ativo</div>
          <p className="text-sm text-muted-foreground mt-1">Fale com a equipe para conhecer nossas opções.</p>
        </Card>
      ) : (
        <Card className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Plano</div>
              <div className="text-lg font-medium text-foreground">{plano.titulo || "Avença"}</div>
            </div>
            {plano.status && (
              <Badge className={STATUS_STYLE[plano.status] || ""}>{plano.status}</Badge>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-border/60 p-3">
              <div className="text-xs text-muted-foreground">Valor mensal</div>
              <div className="text-xl font-semibold text-foreground mt-1">{formatBRL(plano.valor_mensal)}</div>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Dia de vencimento</div>
              <div className="text-xl font-semibold text-foreground mt-1">
                {plano.dia_vencimento ? `Dia ${plano.dia_vencimento}` : "—"}
              </div>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3" /> Escopo</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {plano.escopo_areas && plano.escopo_areas.length > 0 ? (
                  plano.escopo_areas.map((a) => (
                    <Badge key={a} variant="outline" className="text-[11px]">{a}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </PortalLayout>
  );
}