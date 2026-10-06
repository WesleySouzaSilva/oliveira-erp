import { Link, useParams } from "react-router-dom";
import { Landmark, LifeBuoy, Scale } from "lucide-react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { ChamadoThread } from "@/components/portal/ChamadoThread";
import {
  ChamadoStatusBadge,
  ChamadoTipoBadge,
  PortalCard,
  PortalCarregando,
  PortalPage,
  PortalVazio,
  fmtData,
} from "@/components/portal/portalUi";
import { useChamado, usePortalCliente, CHAMADO_STATUS_LABEL, faseLabel } from "@/hooks/usePortalCliente";

const EXPLICA_STATUS: Record<string, string> = {
  aberto: "A equipe já foi avisada e vai responder por aqui.",
  em_andamento: "Alguém da equipe está cuidando disso.",
  aguardando_cliente: "A equipe precisa de uma resposta sua para continuar.",
  resolvido: "Resolvido. Se precisar, é só responder e o chamado reabre.",
};

export default function PortalClienteChamadoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { clienteId, processos, contratos } = usePortalCliente();
  const { chamado } = useChamado(id);
  const c = chamado.data;

  const processo = c?.processo_id ? (processos.data || []).find((p) => p.id === c.processo_id) : null;
  const contrato = c?.contrato_id ? (contratos.data || []).find((k) => k.id === c.contrato_id) : null;

  return (
    <PortalLayout>
      <PortalPage
        voltar={{ to: "/portal/chamados", label: "Chamados" }}
        titulo={c?.titulo || "Chamado"}
        subtitulo={
          c ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <ChamadoTipoBadge tipo={c.tipo} />
              <span>aberto em {fmtData(c.created_at)}</span>
            </span>
          ) : undefined
        }
        acoes={c ? <ChamadoStatusBadge status={c.status} /> : null}
      >
        {chamado.isLoading ? (
          <PortalCarregando />
        ) : !c || !clienteId ? (
          <div className="rounded-2xl border border-border bg-card">
            <PortalVazio icone={LifeBuoy} titulo="Chamado não encontrado" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <div>
              <div className="mb-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{CHAMADO_STATUS_LABEL[c.status]}:</span> {EXPLICA_STATUS[c.status]}
              </div>
              <ChamadoThread chamadoId={c.id} clienteId={clienteId} modo="cliente" fechado={c.status === "resolvido"} />
            </div>
            <aside className="space-y-3">
              {c.banco && (
                <PortalCard titulo="Banco" icone={Landmark}>
                  <p className="text-sm text-foreground">{c.banco}</p>
                  {contrato && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Contrato {contrato.numero_contrato || "sem número"}
                      {contrato.vencimento_proxima_parcela ? ` · vence ${fmtData(contrato.vencimento_proxima_parcela)}` : ""}
                    </p>
                  )}
                  <Link to="/portal/contratos" className="mt-2 inline-block text-xs text-accent hover:underline">Ver meus contratos</Link>
                </PortalCard>
              )}
              {processo && (
                <PortalCard titulo="Processo" icone={Scale}>
                  <Link to={`/portal/processos/${processo.id}`} className="text-sm text-foreground hover:text-accent">
                    {processo.numero_processo || "Processo sem número"}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">Fase: {faseLabel(processo.fase_atual) || "não informada"}</p>
                </PortalCard>
              )}
              <PortalCard titulo="Como funciona" icone={LifeBuoy}>
                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                  <li>A equipe responde por aqui e você recebe um aviso no sino.</li>
                  <li>Pode anexar foto da carta, do extrato ou o PDF do banco.</li>
                  <li>Quando estiver resolvido, o chamado é fechado pela equipe.</li>
                </ul>
              </PortalCard>
            </aside>
          </div>
        )}
      </PortalPage>
    </PortalLayout>
  );
}
