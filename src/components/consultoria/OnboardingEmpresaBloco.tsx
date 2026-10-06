import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string; status: "em_andamento" | "concluido"; iniciado_em: string;
  total: number; ok: number;
};

export function OnboardingEmpresaBloco({ empresaId }: { empresaId: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: obs } = await (supabase as any)
        .from("consultoria_onboarding")
        .select("id, status, iniciado_em")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .order("iniciado_em", { ascending: false });
      const list = (obs as any[]) || [];
      if (!list.length) { setRows([]); setLoading(false); return; }
      const { data: itens } = await (supabase as any)
        .from("consultoria_onboarding_itens")
        .select("onboarding_id, concluido")
        .in("onboarding_id", list.map((o) => o.id));
      const stats = new Map<string, { total: number; ok: number }>();
      ((itens as any[]) || []).forEach((it) => {
        const s = stats.get(it.onboarding_id) || { total: 0, ok: 0 };
        s.total++; if (it.concluido) s.ok++;
        stats.set(it.onboarding_id, s);
      });
      setRows(list.map((o: any) => ({ ...o, ...(stats.get(o.id) || { total: 0, ok: 0 }) })));
      setLoading(false);
    })();
  }, [empresaId]);

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-serif font-semibold">Onboarding</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/consultoria/onboarding")}>
          Ir para Onboarding <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum onboarding iniciado para esta empresa.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const pct = r.total ? Math.round((r.ok / r.total) * 100) : 0;
            return (
              <div key={r.id}
                className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:border-primary"
                onClick={() => navigate(`/consultoria/onboarding/${r.id}`)}>
                <Badge variant={r.status === "concluido" ? "default" : "outline"} className="text-[10px]">
                  {r.status === "concluido"
                    ? <CheckCircle2 className="w-3 h-3 mr-1" />
                    : <Clock className="w-3 h-3 mr-1" />}
                  {r.status === "concluido" ? "Concluído" : "Em andamento"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">
                    Iniciado {new Date(r.iniciado_em).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-xs font-medium tabular-nums">{r.ok}/{r.total}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}