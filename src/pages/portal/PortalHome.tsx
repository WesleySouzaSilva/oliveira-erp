import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Landmark,
  LifeBuoy,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { NovoChamadoDialog } from "@/components/portal/NovoChamadoDialog";
import {
  ChamadoStatusBadge,
  ChamadoTipoBadge,
  FaseBadge,
  PortalCard,
  PortalCarregando,
  PortalPage,
  PortalVazio,
  fmtBRL,
  fmtData,
  fmtDataExtenso,
  tempoRelativo,
} from "@/components/portal/portalUi";
import { usePortalCliente, diasAte, situacaoContrato, type ChamadoTipo } from "@/hooks/usePortalCliente";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export default function PortalHome() {
  const { cliente, processos, andamentosRecentes, contratos, chamados } = usePortalCliente();
  const [novo, setNovo] = useState<ChamadoTipo | null>(null);

  const carregando = processos.isLoading || contratos.isLoading || chamados.isLoading;

  const proximos = useMemo(() => {
    return (contratos.data || [])
      .filter((c) => !c.resolvido && c.vencimento_proxima_parcela)
      .map((c) => ({ c, dias: diasAte(c.vencimento_proxima_parcela) ?? 9999 }))
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 4);
  }, [contratos.data]);

  const emAtraso = (contratos.data || []).filter((c) => !c.resolvido && c.parcelas_vencidas).length;
  const chamadosAbertos = (chamados.data || []).filter((c) => c.status !== "resolvido");
  const aguardandoVoce = chamadosAbertos.filter((c) => c.status === "aguardando_cliente");
  const processosMap = new Map((processos.data || []).map((p) => [p.id, p]));

  const primeiroNome = (cliente.data?.nome || "").trim().split(/\s+/)[0];
  const hojeRaw = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const hoje = hojeRaw.charAt(0).toUpperCase() + hojeRaw.slice(1);

  return (
    <PortalLayout>
      <PortalPage
        titulo={primeiroNome ? `Olá, ${primeiroNome}` : "Bem-vindo(a)"}
        subtitulo={hoje}
        acoes={
          <>
            <Button variant="outline" className="gap-2" onClick={() => setNovo("banco")}>
              <Landmark className="h-4 w-4 text-accent" /> O banco me procurou
            </Button>
            <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setNovo("pos_venda")}>
              <LifeBuoy className="h-4 w-4" /> Abrir chamado
            </Button>
          </>
        }
      >
        {carregando ? (
          <PortalCarregando />
        ) : (
          <>
            {/* Avisos que pedem ação */}
            {(aguardandoVoce.length > 0 || emAtraso > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {aguardandoVoce.length > 0 && (
                  <Link
                    to="/portal/chamados"
                    className="flex items-center gap-3 rounded-2xl border border-warning/50 bg-warning/10 px-4 py-3 hover:bg-warning/15"
                  >
                    <LifeBuoy className="h-5 w-5 text-warning shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        {aguardandoVoce.length === 1 ? "1 chamado aguarda a sua resposta" : `${aguardandoVoce.length} chamados aguardam a sua resposta`}
                      </p>
                      <p className="text-xs text-muted-foreground">A equipe precisa de um retorno seu para continuar.</p>
                    </div>
                    <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
                  </Link>
                )}
                {emAtraso > 0 && (
                  <Link
                    to="/portal/contratos"
                    className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 hover:bg-destructive/10"
                  >
                    <Landmark className="h-5 w-5 text-destructive shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        {emAtraso === 1 ? "1 contrato com parcela em atraso" : `${emAtraso} contratos com parcela em atraso`}
                      </p>
                      <p className="text-xs text-muted-foreground">Veja a situação e o que a equipe já fez.</p>
                    </div>
                    <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
                  </Link>
                )}
              </div>
            )}

            {/* Números rápidos */}
            <div className="grid grid-cols-3 gap-3">
              <Resumo to="/portal/processos" icone={Scale} valor={(processos.data || []).length} rotulo="processos" />
              <Resumo to="/portal/contratos" icone={Landmark} valor={(contratos.data || []).filter((c) => !c.resolvido).length} rotulo="contratos ativos" />
              <Resumo to="/portal/chamados" icone={LifeBuoy} valor={chamadosAbertos.length} rotulo="chamados abertos" />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              {/* Últimas atualizações processuais */}
              <PortalCard
                className="lg:col-span-3"
                titulo="Últimas atualizações nos processos"
                icone={Activity}
                acao={
                  <Link to="/portal/processos" className="text-xs text-accent hover:underline">Ver todos</Link>
                }
              >
                {(andamentosRecentes.data || []).length === 0 ? (
                  <PortalVazio
                    icone={Activity}
                    titulo="Nenhuma atualização liberada ainda"
                    texto="Quando houver movimentação no seu processo, ela aparece aqui e você recebe aviso."
                  />
                ) : (
                  <ol className="relative ml-2 border-l border-border space-y-4 pt-1">
                    {(andamentosRecentes.data || []).slice(0, 6).map((a) => {
                      const p = processosMap.get(a.processo_id);
                      return (
                        <li key={a.id} className="ml-4">
                          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-card" />
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <time className="font-medium text-foreground">{fmtData(a.data)}</time>
                            {a.tipo && <span className="uppercase tracking-wide">{a.tipo}</span>}
                            {p && (
                              <Link to={`/portal/processos/${p.id}`} className="hover:text-accent">
                                · {p.numero_processo || "processo"}
                              </Link>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-foreground leading-snug line-clamp-3">{a.descricao}</p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </PortalCard>

              {/* Próximos vencimentos */}
              <PortalCard
                className="lg:col-span-2"
                titulo="Próximos vencimentos"
                icone={CalendarClock}
                acao={<Link to="/portal/contratos" className="text-xs text-accent hover:underline">Ver contratos</Link>}
              >
                {proximos.length === 0 ? (
                  <PortalVazio icone={CalendarClock} titulo="Sem vencimentos cadastrados" texto="Assim que a equipe registrar seus contratos, eles aparecem aqui." />
                ) : (
                  <ul className="divide-y divide-border">
                    {proximos.map(({ c, dias }) => {
                      const sit = situacaoContrato(c);
                      return (
                        <li key={c.id} className="py-2.5 flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none",
                              dias < 0 ? "border-destructive/40 bg-destructive/5 text-destructive"
                              : dias <= 30 ? "border-warning/50 bg-warning/10 text-foreground"
                              : "border-border bg-muted/40 text-foreground",
                            )}
                          >
                            <span className="text-base font-semibold">{new Date(c.vencimento_proxima_parcela! + "T12:00:00").getDate()}</span>
                            <span className="text-[9px] uppercase">{new Date(c.vencimento_proxima_parcela! + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{c.banco || "Banco"}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {c.numero_contrato ? `Contrato ${c.numero_contrato}` : "Contrato"}{c.valor_parcela ? ` · parcela ${fmtBRL(c.valor_parcela)}` : ""}
                            </p>
                          </div>
                          <StatusBadge tone={sit.tone} size="sm">{sit.label}</StatusBadge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </PortalCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              {/* Chamados */}
              <PortalCard
                className="lg:col-span-3"
                titulo="Seus chamados"
                icone={LifeBuoy}
                acao={<Link to="/portal/chamados" className="text-xs text-accent hover:underline">Ver todos</Link>}
              >
                {chamadosAbertos.length === 0 ? (
                  <PortalVazio
                    icone={LifeBuoy}
                    titulo="Nenhum chamado em aberto"
                    texto="Recebeu contato do banco, tem uma dúvida ou precisa mandar um documento? Abra um chamado."
                    acao={<Button size="sm" variant="outline" onClick={() => setNovo("pos_venda")}>Abrir chamado</Button>}
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {chamadosAbertos.slice(0, 5).map((c) => (
                      <li key={c.id}>
                        <Link to={`/portal/chamados/${c.id}`} className="py-2.5 flex items-center gap-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{c.titulo}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <ChamadoTipoBadge tipo={c.tipo} />
                              <span>{tempoRelativo(c.ultima_mensagem_em)}</span>
                            </div>
                          </div>
                          <ChamadoStatusBadge status={c.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </PortalCard>

              {/* OlivIA + processos em andamento */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-2xl bg-primary text-primary-foreground p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <p className="font-semibold">OlivIA</p>
                  </div>
                  <p className="text-sm text-primary-foreground/80 leading-relaxed">
                    Pergunte em linguagem simples: "como está meu processo?", "quando vence a próxima parcela?", "o banco ligou, e agora?".
                  </p>
                  <p className="mt-3 text-[11px] text-primary-foreground/60">Use o botão OlivIA no topo da página.</p>
                </div>

                {(processos.data || []).length > 0 && (
                  <PortalCard titulo="Processos" icone={Scale}>
                    <ul className="space-y-2">
                      {(processos.data || []).slice(0, 3).map((p) => (
                        <li key={p.id}>
                          <Link to={`/portal/processos/${p.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:border-accent/60">
                            <span className="text-sm text-foreground truncate">{p.numero_processo || "Processo sem número"}</span>
                            <FaseBadge fase={p.fase_atual} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </PortalCard>
                )}
              </div>
            </div>

            <div className="lg:hidden flex gap-2">
              <Link to="/portal/atendimentos" className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-center text-sm text-foreground hover:border-accent/60">Atendimentos</Link>
              <Link to="/portal/acordos" className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-center text-sm text-foreground hover:border-accent/60">Acordos</Link>
            </div>

            {cliente.data?.nome_propriedade && (
              <p className="text-[11px] text-muted-foreground text-center">
                {cliente.data.nome_propriedade}{cliente.data.municipio ? ` · ${cliente.data.municipio}/${cliente.data.uf || ""}` : ""}{cliente.data.cultura_principal ? ` · ${cliente.data.cultura_principal}` : ""}
                {" · atualizado em "}{fmtDataExtenso(new Date().toISOString())}
              </p>
            )}
          </>
        )}
      </PortalPage>

      <NovoChamadoDialog aberto={novo !== null} onFechar={() => setNovo(null)} tipoInicial={novo || undefined} />
    </PortalLayout>
  );
}

function Resumo({ to, icone: Icone, valor, rotulo }: { to: string; icone: typeof Scale; valor: number; rotulo: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-border bg-card px-4 py-3 hover:border-accent/60 transition-colors">
      <Icone className="h-4 w-4 text-accent" />
      <p className="mt-1.5 font-display text-2xl font-semibold text-foreground leading-none">{valor}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{rotulo}</p>
    </Link>
  );
}
