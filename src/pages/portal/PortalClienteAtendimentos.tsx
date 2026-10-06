import { MessageSquare } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalCarregando, PortalPage, PortalVazio, fmtData } from "@/components/portal/portalUi";
import { usePortalCliente } from "@/hooks/usePortalCliente";

/**
 * Atendimentos liberados pela equipe (view portal_cliente_atendimentos_view:
 * só do próprio cliente, só visivel_cliente=true, sem notas internas).
 */
export default function PortalClienteAtendimentos() {
  const { atendimentos } = usePortalCliente();

  return (
    <PortalLayout>
      <PortalPage
        titulo="Atendimentos"
        subtitulo="Resumo dos atendimentos que a equipe registrou e liberou para você. Reuniões, ligações e visitas."
      >
        {atendimentos.isLoading ? (
          <PortalCarregando />
        ) : (atendimentos.data || []).length === 0 ? (
          <div className="rounded-2xl border border-border bg-card">
            <PortalVazio icone={MessageSquare} titulo="Nenhum atendimento liberado ainda" texto="Depois de cada reunião ou ligação, a equipe pode registrar aqui um resumo para você." />
          </div>
        ) : (
          <ul className="space-y-3">
            {(atendimentos.data || []).map((a) => (
              <li key={a.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{a.titulo || "Atendimento"}</p>
                      <p className="text-[11px] text-muted-foreground">{fmtData(a.created_at)} · {a.tipo_contato || a.origem}</p>
                    </div>
                  </div>
                  <StatusBadge status={a.status} size="sm" />
                </div>
                {a.relatorio_cliente ? (
                  <p className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{a.relatorio_cliente}</p>
                ) : (
                  <p className="mt-3 text-xs italic text-muted-foreground">Sem resumo liberado.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </PortalPage>
    </PortalLayout>
  );
}
