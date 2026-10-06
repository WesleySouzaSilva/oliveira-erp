import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, ArrowRight, Loader2, Clock, TrendingDown, FileText, Users, BarChart3, CalendarClock, ChevronDown } from "lucide-react";

const LS_KEY = "oliveira:olivia-alertas-expandido";

type Alerta = {
  tipo: string;
  titulo: string;
  itens?: string[];
  acao?: { tipo: string; rota: string };
};

const ICONES: Record<string, { Icon: any; cor: string }> = {
  vencimentos_d3: { Icon: CalendarClock, cor: "text-amber-500" },
  vencidos: { Icon: AlertTriangle, cor: "text-destructive" },
  tarefas_hoje: { Icon: Clock, cor: "text-primary" },
  tarefas_atrasadas: { Icon: AlertTriangle, cor: "text-destructive" },
  leads_parados: { Icon: TrendingDown, cor: "text-amber-500" },
  processos_travados: { Icon: AlertTriangle, cor: "text-amber-500" },
  laudos_rascunho: { Icon: FileText, cor: "text-amber-500" },
  onboardings_parados: { Icon: Users, cor: "text-amber-500" },
  lancamento_marketing_pendente: { Icon: BarChart3, cor: "text-primary" },
};

/**
 * Card de alertas proativos da Olívia.
 * Consome a edge function `olivia-briefing` (que já existe) e exibe até 4 alertas.
 * Insira em qualquer dashboard como <OliviaAlertasCard />.
 */
export function OliviaAlertasCard({ open, onToggle }: { open?: boolean; onToggle?: () => void } = {}) {
  const { user } = useAuth();
  const cacheKey = user ? `oliveira:olivia-briefing:${user.id}` : null;
  const hoje = new Date().toISOString().slice(0, 10);
  // Resumo já visto hoje aparece na hora; a atualização roda em segundo plano.
  const salvo = (() => {
    if (!cacheKey) return undefined;
    try {
      const j = JSON.parse(localStorage.getItem(cacheKey) || "null");
      return j && j.dia === hoje ? j : undefined;
    } catch { return undefined; }
  })();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["olivia-briefing", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("olivia-briefing", { body: {} });
      if (error) throw error;
      try { if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify({ dia: hoje, em: Date.now(), data })); } catch { /* ignore */ }
      return data;
    },
    initialData: salvo?.data,
    initialDataUpdatedAt: salvo?.em,
    staleTime: 1000 * 60 * 5,
    retry: 0,
  });
  const loading = isLoading;
  const alertas: Alerta[] = (data?.alertas || []).slice(0, 4);
  const vazio: string | null = isError && !data ? "Não foi possível carregar agora." : (data?.vazio_msg || null);
  const [abertoLocal, setAberto] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_KEY) !== "0"; } catch { return true; }
  });
  const controlado = open !== undefined;
  const aberto = controlado ? open! : abertoLocal;

  const toggle = () => {
    if (controlado) { onToggle?.(); return; }
    setAberto((prev) => {
      const next = !prev;
      try { localStorage.setItem(LS_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={aberto}
          className="w-full flex items-center justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </span>
            Olívia · O que precisa da sua atenção
            {!aberto && !loading && alertas.length > 0 && (
              <Badge variant="secondary" className="ml-1">{alertas.length}</Badge>
            )}
          </CardTitle>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${aberto ? "" : "-rotate-90"}`}
          />
        </button>
      </CardHeader>
      {aberto && (
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> analisando…
          </div>
        ) : alertas.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{vazio || "Tudo em dia por aqui."}</p>
        ) : (
          alertas.map((a, i) => (
            (() => {
              const { Icon, cor } = ICONES[a.tipo] || { Icon: AlertTriangle, cor: "text-amber-500" };
              return (
            <Link
              key={i}
              to={a.acao?.rota || "/inbox"}
              className="block rounded-md border bg-card p-2.5 hover:border-primary/40 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <Icon className={`w-3.5 h-3.5 ${cor} mt-0.5 shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{a.titulo}</p>
                    {a.itens && a.itens.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {a.itens.slice(0, 2).map((it, j) => (
                          <li key={j} className="text-[11px] text-muted-foreground truncate">• {it}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            </Link>
              );
            })()
          ))
        )}
        <div className="pt-1">
          <Link to="/inbox" className="text-[11px] text-primary hover:underline">Ver tudo na Inbox →</Link>
        </div>
      </CardContent>
      )}
    </Card>
  );
}

export default OliviaAlertasCard;