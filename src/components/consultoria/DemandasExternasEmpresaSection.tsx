import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DemandaExternaDialog } from "@/components/consultoria/DemandaExternaDialog";
import { STATUS, STATUS_STYLE, TIPOS } from "@/pages/consultoria/DemandasExternas";

type Empresa = { id: string; organizacao_id: string; razao_social: string; nome_fantasia: string | null };
type Row = {
  id: string; titulo: string; tipo: string; parte_contraria: string | null;
  valor: number | null; status: string; prazo: string | null;
};
const fmtBRL = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DemandasExternasEmpresaSection({ empresa }: { empresa: Empresa }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaOpen, setNovaOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("empresa_demandas_externas")
      .select("id,titulo,tipo,parte_contraria,valor,status,prazo")
      .eq("empresa_id", empresa.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setRows((data || []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [empresa.id]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif font-semibold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" /> Demandas externas & Acordos
        </h2>
        <Button size="sm" onClick={() => setNovaOpen(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="w-4 h-4 mr-1" /> Nova
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma demanda externa registrada.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} to={`/consultoria/demandas-externas/${r.id}`}
              className="flex items-center justify-between gap-3 p-3 border rounded-md hover:bg-muted/30">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{r.titulo}</div>
                <div className="text-xs text-muted-foreground">
                  {TIPOS.find((t) => t.v === r.tipo)?.l ?? r.tipo}
                  {r.parte_contraria ? ` · ${r.parte_contraria}` : ""}
                  {r.prazo ? ` · prazo ${new Date(r.prazo).toLocaleDateString("pt-BR")}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">{fmtBRL(r.valor)}</span>
                <Badge variant="secondary" className={STATUS_STYLE[r.status]}>
                  {STATUS.find((s) => s.v === r.status)?.l ?? r.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
      <DemandaExternaDialog
        open={novaOpen}
        onClose={() => setNovaOpen(false)}
        onSaved={() => { setNovaOpen(false); load(); }}
        empresa={empresa}
      />
    </Card>
  );
}