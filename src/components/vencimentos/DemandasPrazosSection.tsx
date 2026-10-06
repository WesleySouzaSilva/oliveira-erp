import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VencRow {
  origem: string;
  ref_id: string;
  cliente: string;
  banco: string | null;
  data: string;
  dias_restantes: number;
  observacao: string | null;
}

/**
 * Lista prazos vindos das Demandas de Consultoria (Fase 2A).
 * Reaproveita o agregador unificado get_proximos_vencimentos_kanban.
 */
export function DemandasPrazosSection() {
  const [rows, setRows] = useState<VencRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_proximos_vencimentos_kanban" as any);
      if (!active) return;
      if (error) {
        setRows([]);
      } else {
        const all = ((data as any[]) ?? []) as VencRow[];
        setRows(
          all
            .filter((r) => r.origem === "demanda")
            .sort((a, b) => a.dias_restantes - b.dias_restantes),
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading || rows.length === 0) return null;

  return (
    <section className="mb-5 rounded-xl border border-border bg-card p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" /> Prazos de Demandas (Consultoria)
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            {rows.length}
          </span>
        </h2>
      </header>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const overdue = r.dias_restantes < 0;
          return (
            <li key={r.ref_id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.cliente}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.banco || "—"}
                  {r.observacao ? ` · ${r.observacao}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={overdue ? "destructive" : "secondary"} className="text-[10px]">
                  {overdue ? `Vencido há ${Math.abs(r.dias_restantes)}d` : `${r.dias_restantes}d`}
                </Badge>
                <Link
                  to={`/consultoria/demandas/${r.ref_id}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Abrir <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}