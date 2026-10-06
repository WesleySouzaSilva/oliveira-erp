import { useMemo, useState } from "react";
import { CalendarClock, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { NovoChamadoDialog } from "@/components/portal/NovoChamadoDialog";
import { PortalCard, PortalCarregando, PortalPage, PortalVazio, fmtBRL, fmtData } from "@/components/portal/portalUi";
import { usePortalCliente, diasAte, situacaoContrato, type PortalContrato } from "@/hooks/usePortalCliente";
import { cn } from "@/lib/utils";

export default function PortalClienteContratos() {
  const { contratos } = usePortalCliente();
  const [chamadoPara, setChamadoPara] = useState<PortalContrato | null | "novo">(null);

  const porBanco = useMemo(() => {
    const m = new Map<string, PortalContrato[]>();
    (contratos.data || []).forEach((c) => {
      const k = c.banco || "Banco não informado";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [contratos.data]);

  const ativos = (contratos.data || []).filter((c) => !c.resolvido);
  const totalParcelasMes = ativos
    .filter((c) => {
      const d = diasAte(c.vencimento_proxima_parcela);
      return d !== null && d >= 0 && d <= 30;
    })
    .reduce((s, c) => s + (Number(c.valor_parcela) || 0), 0);

  return (
    <PortalLayout>
      <PortalPage
        titulo="Meus contratos"
        subtitulo="Contratos bancários acompanhados pelo escritório, com o próximo vencimento e a situação de cada um."
        acoes={
          <Button variant="outline" className="gap-2" onClick={() => setChamadoPara("novo")}>
            <Landmark className="h-4 w-4 text-accent" /> O banco me procurou
          </Button>
        }
      >
        {contratos.isLoading ? (
          <PortalCarregando />
        ) : (contratos.data || []).length === 0 ? (
          <div className="rounded-2xl border border-border bg-card">
            <PortalVazio
              icone={Landmark}
              titulo="Nenhum contrato registrado ainda"
              texto="A equipe cadastra seus contratos conforme recebe os documentos. Se você tem um contrato que não aparece aqui, abra um chamado e envie o arquivo."
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Kpi rotulo="contratos ativos" valor={String(ativos.length)} />
              <Kpi rotulo="com parcela em atraso" valor={String(ativos.filter((c) => c.parcelas_vencidas).length)} destaque={ativos.some((c) => c.parcelas_vencidas)} />
              <Kpi rotulo="a vencer em 30 dias" valor={totalParcelasMes ? fmtBRL(totalParcelasMes) : "R$ 0"} />
            </div>

            {porBanco.map(([banco, lista]) => (
              <PortalCard key={banco} titulo={banco} icone={Landmark} padding={false}>
                <ul className="divide-y divide-border">
                  {lista.map((c) => {
                    const sit = situacaoContrato(c);
                    const dias = diasAte(c.vencimento_proxima_parcela);
                    return (
                      <li key={c.id} className="px-5 py-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {c.numero_contrato ? `Contrato ${c.numero_contrato}` : "Contrato sem número"}
                            </p>
                            <StatusBadge tone={sit.tone} size="sm">{sit.label}</StatusBadge>
                          </div>
                          <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
                            <Dado rotulo="Próximo vencimento" valor={c.vencimento_proxima_parcela ? fmtData(c.vencimento_proxima_parcela) : "não informado"} alerta={dias !== null && dias <= 30} />
                            <Dado rotulo="Parcela" valor={c.valor_parcela ? fmtBRL(c.valor_parcela) : "não informado"} />
                            <Dado rotulo="Valor da operação" valor={c.valor_total_operacao ? fmtBRL(c.valor_total_operacao) : "não informado"} />
                            <Dado rotulo="Último vencimento" valor={c.vencimento_ultima_parcela ? fmtData(c.vencimento_ultima_parcela) : "não informado"} />
                          </dl>
                          {(c.protocolo_realizado || c.data_notificacao) && (
                            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <CalendarClock className="h-3 w-3" />
                              {c.protocolo_realizado ? "Pedido de prorrogação protocolado no banco" : ""}
                              {c.protocolo_realizado && c.data_notificacao ? " · " : ""}
                              {c.data_notificacao ? `Banco notificado em ${fmtData(c.data_notificacao)}` : ""}
                            </p>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" className="justify-self-start sm:justify-self-end text-accent hover:text-accent" onClick={() => setChamadoPara(c)}>
                          Informar contato do banco
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </PortalCard>
            ))}

            <p className="text-[11px] text-muted-foreground">
              Os valores vêm do cadastro feito pela equipe a partir dos seus contratos. Se algo estiver diferente do que o banco informa, abra um chamado com o documento.
            </p>
          </>
        )}
      </PortalPage>

      <NovoChamadoDialog
        aberto={chamadoPara !== null}
        onFechar={() => setChamadoPara(null)}
        tipoInicial="banco"
        contratoInicial={chamadoPara && chamadoPara !== "novo" ? chamadoPara : null}
      />
    </PortalLayout>
  );
}

function Kpi({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-card px-4 py-3", destaque ? "border-destructive/40" : "border-border")}>
      <p className={cn("font-display text-xl sm:text-2xl font-semibold leading-none", destaque ? "text-destructive" : "text-foreground")}>{valor}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{rotulo}</p>
    </div>
  );
}

function Dado({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className={cn("font-medium", alerta ? "text-warning-foreground" : "text-foreground")}>{valor}</dd>
    </div>
  );
}
