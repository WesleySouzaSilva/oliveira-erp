import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePermissions } from "@/hooks/usePermissions";

interface Row {
  id: string;
  user_id: string;
  data_tentada: string;
  contexto: string;
  pagina: string | null;
  created_at: string;
}

export function TentativasDataFutura({ days = 30 }: { days?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const { members } = useOrgMembers();
  const { isAdmin, loading: permLoading } = usePermissions();

  useEffect(() => {
    if (permLoading || !isAdmin) {
      setLoading(false);
      return;
    }
    (async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - days);
      const { data } = await supabase
        .from("mkt_tentativas_data_futura")
        .select("id,user_id,data_tentada,contexto,pagina,created_at")
        .gte("created_at", desde.toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, [days, isAdmin, permLoading]);

  if (!isAdmin) return null;
  if (loading) return null;
  if (rows.length === 0) return null;

  const nome = (uid: string) => members.find((m) => m.user_id === uid)?.nome || uid.slice(0, 8);

  // Agrega por dia tentado
  const porDia = new Map<string, number>();
  for (const r of rows) porDia.set(r.data_tentada, (porDia.get(r.data_tentada) || 0) + 1);
  const diasOrdenados = Array.from(porDia.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <Card className="border-amber-200">
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <CardTitle className="text-base">Tentativas de lançamento em data futura</CardTitle>
        <Badge variant="secondary" className="ml-auto">{rows.length} nos últimos {days} dias</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {diasOrdenados.map(([dia, qtd]) => (
            <Badge key={dia} variant="outline" className="text-xs">
              {format(new Date(dia + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })} · {qtd}x
            </Badge>
          ))}
        </div>
        <div className="border rounded-md divide-y max-h-64 overflow-auto">
          {rows.slice(0, 50).map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs px-3 py-1.5">
              <span className="font-medium">{nome(r.user_id)}</span>
              <span className="text-muted-foreground">
                tentou {format(new Date(r.data_tentada + "T00:00:00"), "dd/MM", { locale: ptBR })} em {r.contexto}
              </span>
              <span className="text-muted-foreground">
                {format(new Date(r.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}