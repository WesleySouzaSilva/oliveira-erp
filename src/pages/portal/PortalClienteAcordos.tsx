import { CalendarClock, CheckCircle2, Handshake } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalCarregando, PortalPage, PortalVazio, fmtData } from "@/components/portal/portalUi";
import { usePortalCliente, diasAte } from "@/hooks/usePortalCliente";
import { cn } from "@/lib/utils";

/**
 * Acordos liberados pela equipe (view portal_cliente_acordos_view: sem
 * valores, honorários ou responsáveis).
 */
export default function PortalClienteAcordos() {
  const { acordos } = usePortalCliente();
  const lista = acordos.data || [];
  const pendentes = lista.filter((a) => !a.concluida);
  const concluidos = lista.filter((a) => a.concluida);

  return (
    <PortalLayout>
      <PortalPage
        titulo="Acordos e compromissos"
        subtitulo="Compromissos combinados com o banco ou com a equipe, com a data de cada um."
      >
        {acordos.isLoading ? (
          <PortalCarregando />
        ) : lista.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card">
            <PortalVazio icone={Handshake} titulo="Nenhum acordo liberado ainda" texto="Quando houver um acordo ou compromisso combinado, ele aparece aqui com a data." />
          </div>
        ) : (
          <>
            {pendentes.length > 0 && (
              <section className="space-y-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Em andamento</h2>
                {pendentes.map((a) => {
                  const dias = diasAte(a.data_vencimento);
                  return (
                    <article key={a.id} className={cn("rounded-2xl border bg-card p-4 sm:p-5", dias !== null && dias < 0 ? "border-destructive/40" : dias !== null && dias <= 7 ? "border-warning/50" : "border-border")}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Handshake className="h-4 w-4 text-accent shrink-0" />
                          <p className="font-medium text-foreground">{a.titulo}</p>
                        </div>
                        <StatusBadge status={a.status} size="sm" />
                      </div>
                      {a.descricao && <p className="mt-2 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{a.descricao}</p>}
                      {a.observacoes && <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{a.observacoes}</p>}
                      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {fmtData(a.data_vencimento)}
                        {dias !== null && (
                          <span className={cn("font-medium", dias < 0 ? "text-destructive" : dias <= 7 ? "text-warning-foreground" : "text-foreground")}>
                            · {dias < 0 ? `venceu há ${-dias} dia(s)` : dias === 0 ? "vence hoje" : `em ${dias} dia(s)`}
                          </span>
                        )}
                      </p>
                    </article>
                  );
                })}
              </section>
            )}
            {concluidos.length > 0 && (
              <section className="space-y-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Concluídos</h2>
                {concluidos.map((a) => (
                  <article key={a.id} className="rounded-2xl border border-border bg-card/60 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      <p className="text-sm font-medium text-foreground">{a.titulo}</p>
                      <span className="ml-auto text-[11px] text-muted-foreground">{fmtData(a.data_vencimento)}</span>
                    </div>
                    {a.descricao && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{a.descricao}</p>}
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </PortalPage>
    </PortalLayout>
  );
}
