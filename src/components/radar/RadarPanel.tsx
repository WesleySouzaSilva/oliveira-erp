import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Radar as RadarIcon, CheckCircle2, BellOff, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import {
  useOperacoesCredito,
  diasRestantes,
  MOTIVO_CONFERENCIA,
  type OperacaoCredito,
} from "@/hooks/useOperacoesCredito";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ProtocoloDialog } from "@/components/radar/ProtocoloDialog";
import { DispensarAlertaDialog } from "@/components/radar/DispensarAlertaDialog";
import { VincularNomesPanel } from "@/components/radar/VincularNomesPanel";
import { SemBancoContratadoPanel } from "@/components/radar/SemBancoContratadoPanel";

import { useRadarEtapas, etapasDe, LAUDO_OPCOES, labelLaudo, laudoCompletoPendente } from "@/lib/radarEtapas";
import { DecisaoVencidaDialog } from "@/components/radar/DecisaoVencidaDialog";
import { rotuloUrgencia, labelDecisao } from "@/lib/urgencia";
import { curtoTipoProcesso } from "@/data/onboardingAgroTemplate";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import { EtiquetasGarantia } from "@/components/radar/EtiquetasGarantia";
import { GarantiasEstrategiaDialog } from "@/components/radar/GarantiasEstrategiaDialog";
import { labelEstrategia } from "@/lib/garantias";

type Secao = "execucao" | "vencidas" | "ate30" | "31a60" | "invalidas" | "aconferir";

const STORAGE_KEY = "radar:secoes-recolhidas";

const TODAS_SECOES: Secao[] = ["execucao", "vencidas", "ate30", "31a60", "invalidas", "aconferir"];

function loadRecolhidas(): Set<Secao> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(TODAS_SECOES); // padrão: todas recolhidas
    return new Set(JSON.parse(raw) as Secao[]);
  } catch {
    return new Set(TODAS_SECOES);
  }
}

function saveRecolhidas(set: Set<Secao>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

const formatDataBR = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const formatBRL = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const VITORIA_NOME_COMPLETO = "Vitoria Isabela Barbosa da Silva";

const responsavelCanonico = (nome: string | null | undefined) =>
  nome?.trim().toLocaleLowerCase("pt-BR") === "vitoria" ? VITORIA_NOME_COMPLETO : nome?.trim() || null;

export function RadarPanel() {
  const {
    loading,
    reload,
    vencidas,
    ate30,
    entre31e60,
    listaVencidas,
    lista0a30,
    lista31a60,
    listaDataInvalida,
    listaAConferir,
    listaExecucao,
  } = useOperacoesCredito({ somentePendentes: true });
  const { user } = useAuth();
  const { config } = useRadarEtapas();
  const { podeProtocolar, isAdmin } = usePapelRadar();

  /** Operação dentro do radar: vencida há até 90 dias ou vencendo em até 60. */
  const noRadar = (op: OperacaoCredito) => {
    if (op.notificado_em || op.dispensar_alerta || !op.vence_em) return false;
    const d = diasRestantes(op.vence_em);
    return d >= -90 && d <= 60;
  };

  const podeMarcarPronta = (op: OperacaoCredito) =>
    op.origem !== "contrato" &&
    op.data_conferida !== false &&
    (op.laudo_status === "pronto" || op.laudo_status === "nao_precisa");

  const salvarLaudo = async (op: OperacaoCredito, valor: string) => {
    const { error } = await supabase.from("operacoes_credito").update({ laudo_status: valor }).eq("id", op.id);
    if (error) {
      toast.error("Não foi possível atualizar o laudo");
      return;
    }
    toast.success("Situação do laudo atualizada");
    reload();
  };

  const marcarPronta = async (op: OperacaoCredito) => {
    const { error } = await supabase
      .from("operacoes_credito")
      .update({
        pronta_protocolar: !op.pronta_protocolar,
        pronta_por: !op.pronta_protocolar ? user?.id ?? null : null,
        pronta_em: !op.pronta_protocolar ? new Date().toISOString() : null,
      })
      .eq("id", op.id);
    if (error) {
      toast.error("Só é possível marcar com a data conferida e o laudo pronto ou dispensado");
      return;
    }
    toast.success(op.pronta_protocolar ? "Marcação retirada" : "Operação pronta para protocolar");
    reload();
  };

  /** Operação que voltou de um arquivamento por duplicata: libera a criação de tarefa no ADVBOX. */
  const confirmarRestaurada = async (op: OperacaoCredito) => {
    const { error } = await supabase
      .from("operacoes_credito")
      .update({ restaurada_conferir: false, alteracao_motivo: "operação restaurada confirmada" })
      .eq("id", op.id);
    if (error) {
      toast.error("Não foi possível confirmar a operação");
      return;
    }
    toast.success("Operação confirmada - já pode gerar tarefa no ADVBOX");
    reload();
  };

  const marcarConferida = async (op: OperacaoCredito) => {
    const { error } = await supabase
      .from("operacoes_credito")
      .update({ data_conferida: true, data_conferida_por: user?.id ?? null, data_conferida_em: new Date().toISOString() })
      .eq("id", op.id);
    if (error) {
      toast.error("Não foi possível marcar como conferida");
      return;
    }
    toast.success("Data conferida");
    reload();
  };
  const [fResp, setFResp] = useState("all");
  const [fBanco, setFBanco] = useState("all");
  const [fModalidade, setFModalidade] = useState("all");
  const [protocoloOp, setProtocoloOp] = useState<OperacaoCredito | null>(null);
  const [garantiasOp, setGarantiasOp] = useState<OperacaoCredito | null>(null);
  const [decisaoOp, setDecisaoOp] = useState<OperacaoCredito | null>(null);
  const [dispensaOp, setDispensaOp] = useState<OperacaoCredito | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [loteAberto, setLoteAberto] = useState(false);
  const [recolhidas, setRecolhidas] = useState<Set<Secao>>(() => loadRecolhidas());

  const toggleSecao = (s: Secao) => {
    setRecolhidas((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      saveRecolhidas(next);
      return next;
    });
  };

  const todas = useMemo(
    () => [...listaVencidas, ...lista0a30, ...lista31a60, ...listaDataInvalida].map((x) => x.op),
    [listaVencidas, lista0a30, lista31a60, listaDataInvalida]
  );

  const responsaveis = useMemo(
    () => Array.from(new Set(todas.map((o) => responsavelCanonico(o.responsavel)).filter(Boolean))).sort() as string[],
    [todas]
  );
  const semResponsavel = useMemo(() => todas.filter((o) => !o.responsavel).length, [todas]);
  const bancos = useMemo(() => Array.from(new Set(todas.map((o) => o.banco).filter(Boolean))).sort(), [todas]);
  const modalidades = useMemo(
    () => Array.from(new Set(todas.map((o) => o.modalidade).filter(Boolean))).sort(),
    [todas]
  );

  const aplicaFiltros = useMemo(
    () => (itens: { op: OperacaoCredito; dias: number }[]) =>
      itens
        .map((x) => x.op)
        .filter((o) => (fResp === "all" ? true : fResp === "__sem__" ? !o.responsavel : responsavelCanonico(o.responsavel) === fResp))
        .filter((o) => fBanco === "all" || o.banco === fBanco)
        .filter((o) => fModalidade === "all" || o.modalidade === fModalidade),
    [fResp, fBanco, fModalidade]
  );

  const secVencidas = useMemo(() => aplicaFiltros(listaVencidas), [aplicaFiltros, listaVencidas]);
  const sec0a30 = useMemo(() => aplicaFiltros(lista0a30), [aplicaFiltros, lista0a30]);
  const sec31a60 = useMemo(() => aplicaFiltros(lista31a60), [aplicaFiltros, lista31a60]);
  const secInvalidas = useMemo(() => aplicaFiltros(listaDataInvalida), [aplicaFiltros, listaDataInvalida]);
  const secExecucao = useMemo(
    () => aplicaFiltros((listaExecucao || []).map((op) => ({ op, dias: NaN }))),
    [aplicaFiltros, listaExecucao]
  );
  const secAConferir = useMemo(
    () => aplicaFiltros((listaAConferir || []).map((op) => ({ op, dias: NaN }))),
    [aplicaFiltros, listaAConferir]
  );

  const selectCls = "h-9 rounded-md border border-input bg-background px-3 text-sm";
  const vazio = secVencidas.length + sec0a30.length + sec31a60.length + secInvalidas.length + secExecucao.length === 0;

  const selecionadasVencidas = secVencidas.filter((o) => selecionados.includes(o.id));
  const toggleSel = (id: string) =>
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const Tabela = ({
    itens,
    tipo,
    selecionavel,
  }: {
    itens: OperacaoCredito[];
    tipo: "vencida" | "critica" | "atencao" | "invalida";
    selecionavel?: boolean;
  }) => (
    <div className="rounded-lg border border-border overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            {selecionavel && <th className="w-10 px-3 py-2" />}
            <th className="text-left px-3 py-2">Cliente</th>
            <th className="text-left px-3 py-2">Banco</th>
            <th className="text-left px-3 py-2">Operação</th>
            <th className="text-left px-3 py-2">Modalidade</th>
            <th className="text-left px-3 py-2">Garantias</th>
            <th className="text-left px-3 py-2">Vence em</th>
            <th className="text-left px-3 py-2">{tipo === "vencida" ? "Vencida há" : "Dias restantes"}</th>
            <th className="text-right px-3 py-2">Saldo devedor</th>
            <th className="text-left px-3 py-2">Responsável</th>
            <th className="text-left px-3 py-2">Mapeia</th>
            <th className="text-left px-3 py-2">Protocola</th>
            <th className="text-left px-3 py-2">Laudo</th>
            <th className="text-right px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((o) => {
            const dias = tipo === "invalida" || !o.vence_em ? null : diasRestantes(o.vence_em);
            const semDono = !o.responsavel;
            const destaque = tipo === "vencida" ? "bg-rose-950/10" : tipo === "critica" ? "bg-destructive/10" : "";
            return (
              <tr
                key={o.id}
                className={`border-t border-border ${destaque} ${semDono ? "border-l-4 border-l-orange-500" : ""}`}
              >
                {selecionavel && (
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selecionados.includes(o.id)}
                      onCheckedChange={() => toggleSel(o.id)}
                      aria-label={`Selecionar operação ${o.numero}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2 font-semibold">
                  {o.cliente_nome || o.titular_nome || (o.grupo ? `${o.grupo} — titular a definir` : "—")}
                  {o.data_conferida === false && (
                    <Badge variant="outline" className="ml-2 border-orange-500 text-orange-600 font-normal">
                      data não conferida
                    </Badge>
                  )}
                  {o.restaurada_conferir && (
                    <Badge variant="outline" className="ml-2 border-amber-500 text-amber-700 font-normal">
                      restaurada - conferir (sem tarefa no ADVBOX)
                    </Badge>
                  )}
                  {o.execucao_ativa && (
                    <Badge className="ml-2 bg-destructive font-normal text-destructive-foreground">
                      {curtoTipoProcesso(o.execucao_tipo || "")}
                    </Badge>
                  )}
                  {o.entrada_urgente && (
                    <Badge className="ml-2 bg-destructive font-normal text-destructive-foreground">
                      {rotuloUrgencia(o.vence_em)}
                    </Badge>
                  )}
                  {laudoCompletoPendente(o.laudo_status) && (
                    <Badge variant="outline" className="ml-2 border-amber-500 font-normal text-amber-700">
                      laudo completo pendente
                    </Badge>
                  )}
                  {o.decisao_vencida && (
                    <Badge variant="outline" className="ml-2 font-normal">
                      {labelDecisao(o.decisao_vencida)}
                    </Badge>
                  )}
                  {o.natureza_credito && (
                    <Badge variant="secondary" className="ml-2 font-normal">
                      {o.natureza_credito}
                    </Badge>
                  )}
                  {o.trecho && (
                    <span className="block text-xs text-muted-foreground font-normal mt-0.5">"{o.trecho}"</span>
                  )}
                </td>
                <td className="px-3 py-2">{o.banco}</td>
                <td className="px-3 py-2">{o.numero}</td>
                <td className="px-3 py-2">{o.modalidade}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left"
                    title="Garantias e estratégia"
                    onClick={() => setGarantiasOp(o)}
                  >
                    <EtiquetasGarantia tipos={o.garantias_tipos} temAvalista={o.tem_avalista} />
                    {o.estrategia && (
                      <span className="block text-[10px] text-muted-foreground mt-0.5">
                        {labelEstrategia(o.estrategia)}
                      </span>
                    )}
                  </button>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDataBR(o.vence_em)}</td>
                <td
                  className={`px-3 py-2 text-2xl font-bold ${
                    tipo === "vencida" ? "text-rose-800" : tipo === "critica" ? "text-destructive" : ""
                  }`}
                >
                  {dias == null ? "—" : Math.abs(dias)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatBRL(o.saldo_devedor)}</td>
                <td className={`px-3 py-2 ${semDono ? "text-orange-600 font-semibold" : ""}`}>
                  {o.responsavel || "Sem responsável"}
                  {o.pronta_protocolar && (
                    <Badge variant="outline" className="ml-2 border-emerald-600 font-normal text-emerald-700">
                      pronta para protocolar
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2">{etapasDe(o.responsavel, config).mapeia || "—"}</td>
                <td className="px-3 py-2">{etapasDe(o.responsavel, config).protocola || "—"}</td>
                <td className="px-3 py-2">
                  {o.origem === "contrato" ? (
                    "—"
                  ) : (
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={o.laudo_status || "nao_avaliado"}
                      onChange={(e) => salvarLaudo(o, e.target.value)}
                      aria-label={`Situação do laudo da operação ${o.numero}`}
                    >
                      {LAUDO_OPCOES.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1 whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!podeProtocolar}
                      title={podeProtocolar ? undefined : "Somente quem protocola pode marcar"}
                      onClick={() => setProtocoloOp(o)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marcar como protocolado
                    </Button>
                    {o.origem !== "contrato" && (
                      <Button
                        size="sm"
                        variant={o.pronta_protocolar ? "secondary" : "ghost"}
                        disabled={!o.pronta_protocolar && !podeMarcarPronta(o)}
                        title={
                          !o.pronta_protocolar && !podeMarcarPronta(o)
                            ? "Confira a data e defina o laudo como pronto ou não necessário"
                            : undefined
                        }
                        onClick={() => marcarPronta(o)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        {o.pronta_protocolar ? "Retirar pronta" : "Pronta para protocolar"}
                      </Button>
                    )}
                    {o.data_conferida === false && (
                      <Button size="sm" variant="ghost" onClick={() => marcarConferida(o)}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Conferido
                      </Button>
                    )}
                    {o.restaurada_conferir && (
                      <Button size="sm" variant="ghost" onClick={() => confirmarRestaurada(o)}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmar operação
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!isAdmin && noRadar(o)}
                      title={!isAdmin && noRadar(o) ? "Operação no radar: só o administrador dispensa" : undefined}
                      onClick={() => setDispensaOp(o)}
                    >
                      <BellOff className="w-3.5 h-3.5 mr-1" /> Dispensar alerta
                    </Button>
                    {tipo === "vencida" && o.origem !== "contrato" && !o.decisao_vencida && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-800"
                        disabled={!isAdmin}
                        title={isAdmin ? undefined : "Somente o administrador registra a decisão"}
                        onClick={() => setDecisaoOp(o)}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Perdeu o prazo do pedido?
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
          <RadarIcon className="w-6 h-6 text-accent" /> Radar de Vencimentos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operações de crédito com pedido de prorrogação ainda não protocolado.
        </p>
        <p className="mt-2 text-sm font-semibold">
          <span className="text-rose-800">{vencidas} já vencidas</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-destructive">{ate30} vencendo em 30 dias</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-amber-600">{entre31e60} em 60 dias</span>
        </p>
      </div>

      {semResponsavel > 0 && (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {semResponsavel} {semResponsavel === 1 ? "operação sem responsável" : "operações sem responsável"} — nenhuma pessoa está cuidando destas
        </div>
      )}

      <div className="mb-4">
        <SemBancoContratadoPanel />
      </div>

      <VincularNomesPanel />


      <div className="flex flex-wrap gap-2 mb-4">
        <select className={selectCls} value={fResp} onChange={(e) => setFResp(e.target.value)} aria-label="Filtrar por responsável">
          <option value="all">Todos os responsáveis</option>
          <option value="__sem__">Sem responsável</option>
          {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className={selectCls} value={fBanco} onChange={(e) => setFBanco(e.target.value)} aria-label="Filtrar por banco">
          <option value="all">Todos os bancos</option>
          {bancos.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className={selectCls} value={fModalidade} onChange={(e) => setFModalidade(e.target.value)} aria-label="Filtrar por modalidade">
          <option value="all">Todas as modalidades</option>
          {modalidades.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : vazio ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground max-w-2xl">
          Nenhuma operação no radar. Isso só significa "em dia" se as operações estiverem cadastradas com data de vencimento.
        </div>
      ) : (
        <div className="space-y-8">
          {secExecucao.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => toggleSecao("execucao")}
                className="flex items-center gap-1.5 text-lg font-serif font-bold text-destructive mb-2 hover:opacity-80"
              >
                {recolhidas.has("execucao") ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Em execução / cobrança <span className="text-sm font-sans font-semibold">({secExecucao.length})</span>
              </button>
              <p className="mb-2 text-xs text-muted-foreground">
                Processo ou cobrança em andamento contra o cliente. Ficam aqui, fora da regra dos 90 dias, até o
                administrador encerrar no módulo com motivo. O pedido de prorrogação segue normalmente.
              </p>
              {!recolhidas.has("execucao") && <Tabela itens={secExecucao} tipo="atencao" />}
            </section>
          )}

          {secVencidas.length > 0 && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => toggleSecao("vencidas")}
                  className="flex items-center gap-1.5 text-lg font-serif font-bold text-rose-800 hover:opacity-80"
                >
                  {recolhidas.has("vencidas") ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Já vencidas <span className="text-sm font-sans font-semibold">({secVencidas.length})</span>
                </button>
                {!recolhidas.has("vencidas") && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSelecionados(
                          selecionadasVencidas.length === secVencidas.length ? [] : secVencidas.map((o) => o.id)
                        )
                      }
                    >
                      {selecionadasVencidas.length === secVencidas.length ? "Limpar seleção" : "Selecionar todas"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={selecionadasVencidas.length === 0 || !isAdmin}
                      title={!isAdmin ? "Operações no radar: só o administrador dispensa" : undefined}
                      onClick={() => setLoteAberto(true)}
                    >
                      <BellOff className="w-3.5 h-3.5 mr-1" /> Dispensar selecionadas ({selecionadasVencidas.length})
                    </Button>
                  </div>
                )}
              </div>
              {!recolhidas.has("vencidas") && <Tabela itens={secVencidas} tipo="vencida" selecionavel />}
            </section>
          )}

          {sec0a30.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => toggleSecao("ate30")}
                className="flex items-center gap-1.5 text-lg font-serif font-bold text-destructive mb-2 hover:opacity-80"
              >
                {recolhidas.has("ate30") ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Vencem em até 30 dias <span className="text-sm font-sans font-semibold">({sec0a30.length})</span>
              </button>
              {!recolhidas.has("ate30") && <Tabela itens={sec0a30} tipo="critica" />}
            </section>
          )}

          {sec31a60.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => toggleSecao("31a60")}
                className="flex items-center gap-1.5 text-lg font-serif font-bold text-amber-600 mb-2 hover:opacity-80"
              >
                {recolhidas.has("31a60") ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Vencem em 31 a 60 dias <span className="text-sm font-sans font-semibold">({sec31a60.length})</span>
              </button>
              {!recolhidas.has("31a60") && <Tabela itens={sec31a60} tipo="atencao" />}
            </section>
          )}

          {secInvalidas.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => toggleSecao("invalidas")}
                className="flex items-center gap-1.5 text-lg font-serif font-bold mb-1 hover:opacity-80"
              >
                {recolhidas.has("invalidas") ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Datas a conferir{" "}
                <span className="text-sm font-sans font-semibold">({secInvalidas.length})</span>
              </button>
              {!recolhidas.has("invalidas") && (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    Data provavelmente digitada errada — corrija antes que a operação possa ser acompanhada.
                  </p>
                  <Tabela itens={secInvalidas} tipo="invalida" />
                </>
              )}
            </section>
          )}
        </div>
      )}

      {secAConferir.length > 0 && (
        <section className="mt-8">
          <button
            type="button"
            onClick={() => toggleSecao("aconferir")}
            className="flex items-center gap-1.5 text-lg font-serif font-bold mb-1 hover:opacity-80"
          >
            {recolhidas.has("aconferir") ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <AlertTriangle className="w-4 h-4 text-muted-foreground" /> Contratos a conferir{" "}
            <span className="text-sm font-sans font-semibold">({secAConferir.length})</span>
          </button>
          {!recolhidas.has("aconferir") && (
            <>
              <p className="text-sm text-muted-foreground mb-2">
                Fora do radar: documentos escaneados a digitar, contratos sem data de vencimento e vencimentos antigos
                (mais de 90 dias) guardados como histórico.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Cliente / grupo</th>
                      <th className="text-left px-3 py-2">Banco</th>
                      <th className="text-left px-3 py-2">Nº</th>
                      <th className="text-left px-3 py-2">Vencimento</th>
                      <th className="text-left px-3 py-2">Motivo</th>
                      <th className="text-left px-3 py-2">Responsável</th>
                      <th className="text-left px-3 py-2">Quem mapeia</th>
                      <th className="text-left px-3 py-2">Arquivo de origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {secAConferir.map((o) => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="px-3 py-2 font-semibold">
                          {o.cliente_nome || o.titular_nome || "—"}
                          {o.titular_a_definir && (
                            <Badge variant="outline" className="ml-2 font-normal">titular a definir</Badge>
                          )}
                          {o.grupo && (
                            <span className="block text-xs text-muted-foreground font-normal">{o.grupo}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{o.banco}</td>
                        <td className="px-3 py-2">{o.numero}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDataBR(o.vence_em)}</td>
                        <td className="px-3 py-2">
                          {MOTIVO_CONFERENCIA[(o.status_conferencia as "historico" | "sem_vencimento" | "a_digitar") || "sem_vencimento"]}
                        </td>
                        <td className={`px-3 py-2 ${!o.responsavel ? "text-orange-600 font-semibold" : ""}`}>
                          {o.responsavel || "Sem responsável"}
                        </td>
                        <td className="px-3 py-2">{etapasDe(o.responsavel, config).mapeia || "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{o.origem_arquivo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      <GarantiasEstrategiaDialog
        operacao={garantiasOp}
        open={!!garantiasOp}
        onOpenChange={(v) => !v && setGarantiasOp(null)}
        onSaved={reload}
      />
      <ProtocoloDialog
        operacao={protocoloOp}
        open={!!protocoloOp}
        onOpenChange={(v) => !v && setProtocoloOp(null)}
        onSaved={reload}
      />
      <DecisaoVencidaDialog
        operacao={decisaoOp}
        open={!!decisaoOp}
        onOpenChange={(v) => !v && setDecisaoOp(null)}
        onSaved={reload}
      />
      <DispensarAlertaDialog
        operacao={dispensaOp}
        open={!!dispensaOp}
        onOpenChange={(v) => !v && setDispensaOp(null)}
        onSaved={reload}
      />
      <DispensarAlertaDialog
        operacoes={selecionadasVencidas}
        open={loteAberto}
        onOpenChange={setLoteAberto}
        onSaved={() => {
          setSelecionados([]);
          reload();
        }}
      />
    </>
  );
}
