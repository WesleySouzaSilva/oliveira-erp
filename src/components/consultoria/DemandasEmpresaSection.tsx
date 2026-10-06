import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  NovaDemandaDialog, PRIORIDADE_STYLE, STATUS_STYLE, STATUS_LABEL,
} from "@/components/consultoria/NovaDemandaDialog";

type Empresa = { id: string; organizacao_id: string; razao_social: string; nome_fantasia: string | null };
type Demanda = {
  id: string; assunto: string; area: string | null;
  prioridade: string; status: string; prazo: string | null; created_at: string;
};

export function DemandasEmpresaSection({ empresa }: { empresa: Empresa }) {
  const [rows, setRows] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaOpen, setNovaOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("consultoria_demandas")
      .select("id,assunto,area,prioridade,status,prazo,created_at")
      .eq("empresa_id", empresa.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setRows((data || []) as Demanda[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [empresa.id]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif font-semibold flex items-center gap-2">
          <Inbox className="w-5 h-5 text-primary" /> Demandas
        </h2>
        <Button size="sm" onClick={() => setNovaOpen(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="w-4 h-4 mr-1" /> Nova demanda
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma demanda registrada para esta empresa.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              to={`/consultoria/demandas/${r.id}`}
              className="flex items-center justify-between gap-3 p-3 border rounded-md hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{r.assunto}</div>
                <div className="text-xs text-muted-foreground">
                  {r.area || "—"}
                  {r.prazo ? ` · prazo ${new Date(r.prazo).toLocaleDateString("pt-BR")}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={PRIORIDADE_STYLE[r.prioridade]}>{r.prioridade}</Badge>
                <Badge className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      <NovaDemandaDialog
        open={novaOpen}
        onClose={() => setNovaOpen(false)}
        onSaved={() => { setNovaOpen(false); load(); }}
        empresa={empresa}
      />
    </Card>
  );
}