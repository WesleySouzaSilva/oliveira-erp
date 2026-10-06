import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Radar as RadarIcon, ArrowRight, Siren } from "lucide-react";
import { useOperacoesCredito } from "@/hooks/useOperacoesCredito";

export function RadarDashboardCards() {
  const { loading, vencidas, ate30, entre31e60 } = useOperacoesCredito({ somentePendentes: true });
  // Entradas urgentes dos últimos 30 dias (inclui as já protocoladas).
  const { operacoes } = useOperacoesCredito({ incluirContratos: false });

  const urgencia = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    const recentes = operacoes.filter(
      (o) => o.entrada_urgente && new Date(o.urgencia_em || o.created_at || 0) >= limite,
    );
    const noPrazo = recentes.filter(
      (o) => o.notificado_em && (!o.vence_em || o.notificado_em <= o.vence_em),
    ).length;
    const aCompletar = recentes.filter((o) => o.pendencia_completar).length;
    return { total: recentes.length, noPrazo, aCompletar };
  }, [operacoes]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Link
        to="/vencimentos"
        className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 hover:bg-destructive/15 transition-colors"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-destructive flex items-center gap-1.5">
          <Siren className="w-3.5 h-3.5" /> Entradas urgentes (30 dias)
        </p>
        <p className="text-4xl font-bold text-destructive mt-1">{loading ? "—" : urgencia.total}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {urgencia.noPrazo} protocoladas a tempo · {urgencia.aCompletar} com documentação a completar
        </p>
      </Link>
      <Link
        to="/vencimentos#radar"
        className="rounded-lg border border-rose-900/30 bg-rose-950/10 p-4 hover:bg-rose-950/15 transition-colors"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-800 flex items-center gap-1.5">
          <RadarIcon className="w-3.5 h-3.5" /> Já vencidas
        </p>
        <p className="text-4xl font-bold text-rose-800 mt-1">{loading ? "—" : vencidas}</p>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          Ver radar <ArrowRight className="w-3 h-3" />
        </p>
      </Link>
      <Link
        to="/vencimentos#radar"
        className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 hover:bg-destructive/15 transition-colors"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-destructive flex items-center gap-1.5">
          <RadarIcon className="w-3.5 h-3.5" /> Vencem em até 30 dias
        </p>
        <p className="text-4xl font-bold text-destructive mt-1">{loading ? "—" : ate30}</p>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          Ver radar <ArrowRight className="w-3 h-3" />
        </p>
      </Link>
      <Link
        to="/vencimentos#radar"
        className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 hover:bg-amber-500/15 transition-colors"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 flex items-center gap-1.5">
          <RadarIcon className="w-3.5 h-3.5" /> Vencem em 31–60 dias
        </p>
        <p className="text-4xl font-bold text-amber-600 mt-1">{loading ? "—" : entre31e60}</p>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          Ver radar <ArrowRight className="w-3 h-3" />
        </p>
      </Link>
    </div>
  );
}
