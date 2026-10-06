import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VencRow {
  origem: "contrato" | "kanban";
  ref_id: string;
  processo_id: string | null;
  cliente: string;
  banco: string | null;
  data: string;
  dias_restantes: number;
  observacao: string | null;
}

/**
 * Seção ADITIVA: lista prazos vindos do Kanban (cards com due_date),
 * somados aos contratos. Não altera nem substitui a tabela principal de Vencimentos.
 */
export function KanbanPrazosSection() {
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
        // Apenas a fatia Kanban — os contratos já são exibidos pela tabela principal.
        setRows(all.filter((r) => r.origem === "kanban").sort((a, b) => a.dias_restantes - b.dias_restantes));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
        Carregando prazos do pipeline...
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-bold text-foreground">
          <Calendar className="h-4 w-4 text-primary" /> Prazos do Pipeline (Kanban)
        </h2>
        <p className="text-sm text-muted-foreground">
          Nenhum prazo definido nos cards do pipeline no momento. Quando um card do Kanban receber uma data
          de prazo, ele aparece aqui.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" /> Prazos do Pipeline (Kanban)
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            {rows.length}
          </span>
        </h2>
        <span className="text-[11px] text-muted-foreground">
          Prazos definidos diretamente nos cards do pipeline
        </span>
      </header>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const venc = r.dias_restantes < 0;
          const hoje = r.dias_restantes === 0;
          const urgente = r.dias_restantes > 0 && r.dias_restantes <= 3;
          return (
            <li key={`${r.origem}-${r.ref_id}`} className="py-2 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{r.cliente}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.banco || "—"} · {new Date(r.data).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  venc
                    ? "border-destructive/30 text-destructive bg-destructive/5"
                    : hoje
                      ? "border-accent/30 text-accent bg-accent/5"
                      : urgente
                        ? "border-warning/30 text-warning bg-warning/5"
                        : "border-success/30 text-success bg-success/5"
                }
              >
                {venc ? `Vencido há ${Math.abs(r.dias_restantes)}d` : hoje ? "Hoje" : `${r.dias_restantes}d`}
              </Badge>
              {r.processo_id && (
                <Link
                  to={`/processos/${r.processo_id}`}
                  className="text-muted-foreground hover:text-primary"
                  aria-label="Abrir processo"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}