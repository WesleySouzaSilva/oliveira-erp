import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { curtoTipoProcesso } from "@/data/onboardingAgroTemplate";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useOperacoesCredito,
  diasRestantes,
  dataPlausivel,
  type OperacaoCredito,
} from "@/hooks/useOperacoesCredito";
import {
  useRadarEtapas,
  etapasDe,
  mesmaPessoa,
  responsavelLaudos,
  labelLaudo,
  LAUDO_PRELIMINAR,
} from "@/lib/radarEtapas";
import { PendenciaDocDialog } from "@/components/radar/PendenciaDocDialog";
import { rotuloUrgencia } from "@/lib/urgencia";
import { bancoGenerico, PENDENCIA_BANCO_GENERICO } from "@/lib/bancoGenerico";
import { EtapasConfigDialog } from "@/components/radar/EtapasConfigDialog";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import { AplicarSugestaoDialog } from "@/components/notificacoes/AplicarSugestaoDialog";
import { useVarreduraSugestoes } from "@/hooks/useVarreduraSugestoes";
import { normTexto } from "@/lib/varredura";

const formatDataBR = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const diasDe = (o: OperacaoCredito) => (dataPlausivel(o.vence_em) ? diasRestantes(o.vence_em as string) : null);

/** Ordem de trabalho da fila de digitação. */
const ROTULO_PRIORIDADE: Record<number, string> = {
  1: "1 — outra operação vence em até 60 dias",
  2: "2 — processo ou cobrança em andamento",
  3: "3 — entrada urgente nos últimos 30 dias",
  4: "4 — por data de importação",
};

function Fila({
  titulo,
  descricao,
  itens,
  destaque,
  extra,
  acao,
  iniciaFechada = false,
}: {
  titulo: string;
  descricao?: string;
  itens: OperacaoCredito[];
  destaque?: boolean;
  extra?: (o: OperacaoCredito) => string;
  acao?: (o: OperacaoCredito) => ReactNode;
  iniciaFechada?: boolean;
}) {
  const [aberta, setAberta] = useState(!iniciaFechada);
  if (itens.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className={`flex w-full items-center gap-1.5 px-4 py-3 text-left font-serif text-base font-bold hover:opacity-80 ${destaque ? "text-destructive" : ""}`}
      >
        {aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {titulo} <span className="font-sans text-sm font-semibold">({itens.length})</span>
      </button>
      {aberta && (
        <div className="px-4 pb-4">
          {descricao && <p className="mb-2 text-xs text-muted-foreground">{descricao}</p>}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Banco</th>
                  <th className="px-3 py-2 text-left">Nº</th>
                  <th className="px-3 py-2 text-left">Vence em</th>
                  <th className="px-3 py-2 text-left">Dias</th>
                  <th className="px-3 py-2 text-left">Situação</th>
                  {acao && <th className="px-3 py-2 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody>
                {itens.map((o) => {
                  const dias = diasDe(o);
                  return (
                    <tr key={o.id} className={`border-t border-border ${destaque ? "bg-destructive/5" : ""}`}>
                      <td className="px-3 py-2 font-semibold">
                        {o.cliente_nome || o.titular_nome || (o.grupo ? `${o.grupo} — titular a definir` : "—")}
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
                      </td>
                      <td className="px-3 py-2">{o.banco}</td>
                      <td className="px-3 py-2">{o.numero}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatDataBR(o.vence_em)}</td>
                      <td className={`px-3 py-2 font-bold ${destaque ? "text-destructive" : ""}`}>
                        {dias == null ? "—" : dias < 0 ? `${Math.abs(dias)} vencida` : dias}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{extra ? extra(o) : "—"}</td>
                      {acao && <td className="px-3 py-2 text-right">{acao(o)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export function MinhasOperacoesPanel() {
  const { operacoes, loading } = useOperacoesCredito();
  const { config, meuNome, reload: reloadCfg } = useRadarEtapas();
  const { isAdmin } = usePapelRadar();
  const [configAberta, setConfigAberta] = useState(false);
  const [visaoGestor, setVisaoGestor] = useState(false);
  const [membroFiltro, setMembroFiltro] = useState<string>("todos");
  const [pendenciaOp, setPendenciaOp] = useState<OperacaoCredito | null>(null);
  const [sugestaoOp, setSugestaoOp] = useState<{ op: OperacaoCredito; tipo: "instituicao" | "protocolo" } | null>(null);
  const { sugestoes } = useVarreduraSugestoes();
  const gestor = isAdmin && visaoGestor;

  /** Pessoas que aparecem na configuração de etapas (mapeiam ou protocolam alguma carteira). */
  const membrosEquipe = useMemo(() => {
    const nomes = new Set<string>();
    config.forEach((c) => {
      if (c.carteira !== "__laudos__") nomes.add(c.carteira);
      if (c.mapeia) nomes.add(c.mapeia);
      if (c.protocola) nomes.add(c.protocola);
    });
    // Lucas (laudos) não faz parte do filtro de conferência da equipe.
    return [...nomes]
      .filter((n) => !/^lucas\b/i.test(n.trim()))
      .sort((a, b) => a.localeCompare(b));
  }, [config]);

  /** Quando o gestor escolhe um membro, a fila passa a ser a daquela pessoa. */
  const nomeAlvo = gestor && membroFiltro !== "todos" ? membroFiltro : null;

  /** Quantas sugestões pendentes da varredura existem por cliente e tipo. */
  const sugestoesPorCliente = useMemo(() => {
    const m = new Map<string, number>();
    sugestoes
      .filter((s) => s.status === "pendente")
      .forEach((s) => {
        const k = `${normTexto(s.cliente_nome)}|${s.tipo}`;
        m.set(k, (m.get(k) || 0) + 1);
      });
    return m;
  }, [sugestoes]);

  const contaSugestoes = (o: OperacaoCredito, tipo: "instituicao" | "protocolo") => {
    const nome = normTexto(o.cliente_nome || o.titular_nome || o.grupo || "");
    if (!nome) return 0;
    let total = 0;
    sugestoesPorCliente.forEach((v, k) => {
      const [cli, t] = k.split("|");
      if (t === tipo && (cli === nome || cli.includes(nome) || nome.includes(cli))) total += v;
    });
    return total;
  };

  const botaoSugestao = (o: OperacaoCredito, tipo: "instituicao" | "protocolo") => {
    const n = contaSugestoes(o, tipo);
    if (n === 0) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <Button size="sm" variant="outline" onClick={() => setSugestaoOp({ op: o, tipo })}>
        Sugestões ({n})
      </Button>
    );
  };

  const dados = useMemo(() => {
    const abertas = operacoes.filter((o) => !o.dispensar_alerta);

    // Prioridade da fila de digitação: olha todas as operações do mesmo cliente.
    const chaveCliente = (o: OperacaoCredito) =>
      o.cliente_id || o.cliente_nome?.toLowerCase().trim() || o.grupo?.toLowerCase().trim() || o.id;
    const temVence60 = new Set<string>();
    const temExecucao = new Set<string>();
    const temUrgente = new Set<string>();
    operacoes.forEach((o) => {
      const k = chaveCliente(o);
      const d = diasDe(o);
      if (!o.notificado_em && d != null && d <= 60) temVence60.add(k);
      if (o.execucao_ativa) temExecucao.add(k);
      if (o.entrada_urgente) {
        const ref = o.urgencia_em || o.created_at;
        const dias = ref ? (Date.now() - new Date(ref).getTime()) / 86_400_000 : 999;
        if (dias <= 30) temUrgente.add(k);
      }
    });
    const prioridade = (o: OperacaoCredito) => {
      const k = chaveCliente(o);
      if (temVence60.has(k)) return 1;
      if (temExecucao.has(k)) return 2;
      if (temUrgente.has(k)) return 3;
      return 4;
    };
    const minhasComo = (campo: "mapeia" | "protocola") =>
      gestor && !nomeAlvo
        ? abertas
        : abertas.filter((o) => mesmaPessoa(nomeAlvo || meuNome, etapasDe(o.responsavel, config)[campo]));


    const paraMapear = minhasComo("mapeia");
    const paraProtocolar = minhasComo("protocola");
    // Tudo que é meu, em qualquer das duas etapas.
    const idsProtocolar = new Set(paraProtocolar.map((o) => o.id));
    const minhas = [...paraProtocolar, ...paraMapear.filter((o) => !idsProtocolar.has(o.id))];
    const semProtocolo = (o: OperacaoCredito) => !o.notificado_em;
    const porVencimento = (a: OperacaoCredito, b: OperacaoCredito) =>
      (a.vence_em || "9999").localeCompare(b.vence_em || "9999");

    const souLaudos =
      (gestor && !nomeAlvo) || mesmaPessoa(nomeAlvo || meuNome, responsavelLaudos(config));

    // Cada operação entra em um grupo só: o primeiro da ordem abaixo.
    const usados = new Set<string>();
    const unico = (arr: OperacaoCredito[]) => {
      const out: OperacaoCredito[] = [];
      arr.forEach((o) => {
        if (usados.has(o.id)) return;
        usados.add(o.id);
        out.push(o);
      });
      return out;
    };

    const urgentes = unico(paraProtocolar.filter((o) => o.entrada_urgente && semProtocolo(o)).sort(porVencimento));
    const pendenciasDoc = unico(minhas.filter((o) => o.pendencia_completar).sort(porVencimento));
    const vencidasSemProtocolo = unico(
      minhas
        .filter((o) => {
          const d = diasDe(o);
          return semProtocolo(o) && d != null && d < 0;
        })
        .sort(porVencimento),
    );
    const laudosUrgentes = unico(
      souLaudos ? minhas.filter((o) => LAUDO_PRELIMINAR.includes(o.laudo_status || "")).sort(porVencimento) : [],
    );
    // Fila pessoal de protocolo: de hoje até 15 dias. Sem escalonamento de outras carteiras.
    const ate15 = unico(
      paraProtocolar
        .filter((o) => {
          const d = diasDe(o);
          return semProtocolo(o) && d != null && d >= 0 && d <= 15;
        })
        .sort(porVencimento),
    );
    const prontas = unico(paraProtocolar.filter((o) => o.pronta_protocolar && semProtocolo(o)).sort(porVencimento));
    const atrasoMapeamento = unico(
      paraProtocolar
        .filter((o) => {
          const d = diasDe(o);
          return semProtocolo(o) && !o.pronta_protocolar && d != null && d <= 30;
        })
        .sort(porVencimento),
    );
    const bancoGenericoLista = unico(
      paraMapear
        .filter((o) => bancoGenerico(o.banco) && semProtocolo(o))
        .sort((a, b) => prioridade(a) - prioridade(b) || porVencimento(a, b)),
    );
    const faltando60 = unico(
      paraMapear
        .filter((o) => {
          const d = diasDe(o);
          return semProtocolo(o) && !o.pronta_protocolar && d != null && d <= 60;
        })
        .sort(porVencimento),
    );
    const naoConferidas = unico(
      paraMapear.filter((o) => o.data_conferida === false && semProtocolo(o)).sort(porVencimento),
    );
    const aDigitar = unico(
      paraMapear
        .filter((o) => o.status_conferencia === "a_digitar")
        .sort(
          (a, b) => prioridade(a) - prioridade(b) || (a.created_at || "").localeCompare(b.created_at || ""),
        ),
    );
    const semVencimento = unico(paraMapear.filter((o) => o.status_conferencia === "sem_vencimento"));
    const laudos = unico(souLaudos ? minhas.filter((o) => o.laudo_status === "precisa").sort(porVencimento) : []);
    const aguardandoBanco = unico(minhas.filter((o) => !!o.notificado_em).sort(porVencimento));

    return {
      souMapeador: paraMapear.length > 0,
      souProtocolador: paraProtocolar.length > 0,
      prioridadeDigitar: prioridade,
      naoConferidas,
      aDigitar,
      semVencimento,
      faltando60,
      aguardandoBanco,
      vencidasSemProtocolo,
      prontas,
      atrasoMapeamento,
      urgentes,
      pendenciasDoc,
      bancoGenerico: bancoGenericoLista,
      laudosUrgentes,
      laudos,
      escalonadas: ate15,
    };
  }, [operacoes, config, meuNome, gestor, nomeAlvo]);

  const contagemPrioridade = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    dados.aDigitar.forEach((o) => {
      c[dados.prioridadeDigitar(o)] += 1;
    });
    return c;
  }, [dados]);

  const contagemGenerico = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    dados.bancoGenerico.forEach((o) => {
      c[dados.prioridadeDigitar(o)] += 1;
    });
    return c;
  }, [dados]);


  const nada =
    !loading &&
    dados.naoConferidas.length + dados.aDigitar.length + dados.semVencimento.length + dados.faltando60.length +
      dados.aguardandoBanco.length + dados.prontas.length + dados.atrasoMapeamento.length + dados.laudos.length +
      dados.escalonadas.length + dados.urgentes.length + dados.pendenciasDoc.length + dados.laudosUrgentes.length +
      dados.bancoGenerico.length ===
      0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
            <ListChecks className="h-5 w-5 text-accent" />{" "}
            {gestor ? (nomeAlvo ? `Operações de ${nomeAlvo}` : "Operações da equipe") : "Minhas operações"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {gestor
              ? nomeAlvo
                ? `A fila de ${nomeAlvo} conforme a etapa: mapeamento, protocolo ou laudo.`
                : "Visão do gestor: tudo o que está pendente em todas as carteiras."
              : "A sua fila conforme a etapa: mapeamento, protocolo ou laudo."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="flex rounded-md border border-border p-0.5">
              <Button
                size="sm"
                variant={visaoGestor ? "ghost" : "secondary"}
                onClick={() => setVisaoGestor(false)}
              >
                Minha carteira
              </Button>
              <Button
                size="sm"
                variant={visaoGestor ? "secondary" : "ghost"}
                onClick={() => setVisaoGestor(true)}
              >
                Visão da equipe
              </Button>
            </div>
          )}
          {gestor && (
            <Select value={membroFiltro} onValueChange={setMembroFiltro}>
              <SelectTrigger className="h-8 w-[200px]" aria-label="Filtrar por membro da equipe">
                <SelectValue placeholder="Toda a equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda a equipe</SelectItem>
                {membrosEquipe.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={() => setConfigAberta(true)}>
            Etapas da equipe
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : nada ? (
        <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          {gestor ? "Nada pendente na equipe no momento." : "Nada na sua fila no momento."}
        </div>
      ) : (
        <div className="space-y-3">
          <Fila
            titulo="Entradas urgentes — protocolar já"
            descricao="Cliente que chegou com o vencimento em cima: protocola sem esperar o laudo."
            itens={dados.urgentes}
            destaque
            iniciaFechada
            extra={(o) => `${o.responsavel || "Sem responsável"} · ${labelLaudo(o.laudo_status)}`}
          />
          <Fila
            titulo="Completar documentação do pedido"
            descricao="Protocolo feito em regime de urgência: falta juntar o que não existia na hora."
            itens={dados.pendenciasDoc}
            destaque
            iniciaFechada
            extra={(o) => (o.pendencia_prazo ? `Prazo até ${formatDataBR(o.pendencia_prazo)}` : "Sem prazo")}
            acao={(o) => (
              <Button size="sm" variant="outline" onClick={() => setPendenciaOp(o)}>
                Resolver
              </Button>
            )}
          />
          <Fila
            titulo={PENDENCIA_BANCO_GENERICO}
            descricao={`Por prioridade: ${contagemGenerico[1]} com vencimento nos próximos 60 dias · ${contagemGenerico[2]} com processo ou cobrança em andamento · ${contagemGenerico[3]} de entrada urgente · ${contagemGenerico[4]} restantes. Sem a cooperativa singular o processo não pode ser aberto no ADVBOX.`}
            itens={dados.bancoGenerico}
            iniciaFechada
            extra={(o) => ROTULO_PRIORIDADE[dados.prioridadeDigitar(o)]}
            acao={(o) => botaoSugestao(o, "instituicao")}
          />
          <Fila
            titulo="Já vencidas — sem protocolo"
            descricao="A varredura das pastas pode ter achado o protocolo: confira e aplique operação por operação."
            itens={dados.vencidasSemProtocolo}
            destaque
            iniciaFechada
            extra={(o) => `${o.responsavel || "Sem responsável"} · ${labelLaudo(o.laudo_status)}`}
            acao={(o) => botaoSugestao(o, "protocolo")}
          />
          <Fila
            titulo="Urgente — nota técnica preliminar"
            descricao="Fila de laudos em regime de urgência, pelo vencimento mais próximo."
            itens={dados.laudosUrgentes}
            destaque
            iniciaFechada
            extra={(o) => labelLaudo(o.laudo_status)}
          />
          <Fila
            titulo="Faltam 15 dias ou menos, sem protocolo"
            descricao="Sua fila de protocolo, de hoje até 15 dias. As já vencidas ficam no grupo acima; o escalonamento de todas as carteiras fica no Radar crítico."
            itens={dados.escalonadas}
            destaque
            iniciaFechada
            extra={(o) => `${o.responsavel || "Sem responsável"} · ${labelLaudo(o.laudo_status)}`}
          />
          <Fila
            titulo="Faltam de 16 a 30 dias e ainda não estão prontas"
            descricao="Cobre o mapeamento: sem a marcação de pronta, o protocolo não pode ser feito."
            itens={dados.atrasoMapeamento}
            destaque
            iniciaFechada
            extra={(o) => labelLaudo(o.laudo_status)}
          />

          <Fila
            titulo="Prontas para protocolar"
            itens={dados.prontas}
            iniciaFechada
            extra={(o) => `${o.responsavel || "Sem responsável"} · ${labelLaudo(o.laudo_status)}`}
          />
          <Fila
            titulo="Vencem em até 60 dias e ainda não estão prontas"
            itens={dados.faltando60}
            iniciaFechada
            extra={(o) => labelLaudo(o.laudo_status)}
          />
          <Fila
            titulo="Datas a conferir"
            descricao="Trabalho de mapeamento: cai para quem mapeia a carteira, não para quem protocola."
            itens={dados.naoConferidas}
            iniciaFechada
            extra={(o) =>
              gestor
                ? `Mapeia ${etapasDe(o.responsavel, config).mapeia || "—"} · carteira ${o.responsavel || "sem responsável"}`
                : o.origem_arquivo || "—"
            }
          />
          <Fila
            titulo="Contratos a digitar"
            descricao={`Por prioridade: ${contagemPrioridade[1]} com outra operação vencendo em até 60 dias · ${contagemPrioridade[2]} com processo ou cobrança em andamento · ${contagemPrioridade[3]} com entrada urgente nos últimos 30 dias · ${contagemPrioridade[4]} restantes, por data de importação.`}
            itens={dados.aDigitar}
            iniciaFechada
            extra={(o) => {
              const p = dados.prioridadeDigitar(o);
              const rotulo = ROTULO_PRIORIDADE[p];
              return gestor
                ? `${rotulo} · mapeia ${etapasDe(o.responsavel, config).mapeia || "—"}`
                : rotulo;
            }}
          />
          <Fila
            titulo="Sem data de vencimento"
            itens={dados.semVencimento}
            iniciaFechada
            extra={(o) => o.origem_arquivo || "—"}
          />
          <Fila
            titulo="Precisam de laudo"
            itens={dados.laudos}
            iniciaFechada
            extra={(o) => o.responsavel || "Sem responsável"}
          />
          <Fila
            titulo="Protocolados aguardando resposta do banco"
            itens={dados.aguardandoBanco}
            iniciaFechada
            extra={(o) => `Protocolado em ${formatDataBR(o.notificado_em)}`}
          />
        </div>
      )}

      {!loading && (
        <p className="text-xs text-muted-foreground">
          Nomes a vincular ficam logo abaixo, no radar.{" "}
          {meuNome && <Badge variant="outline" className="font-normal">Você: {meuNome}</Badge>}
        </p>
      )}

      <EtapasConfigDialog open={configAberta} onOpenChange={setConfigAberta} config={config} onSaved={reloadCfg} />
      <AplicarSugestaoDialog
        operacao={sugestaoOp?.op ?? null}
        tipo={sugestaoOp?.tipo ?? "instituicao"}
        open={!!sugestaoOp}
        onOpenChange={(v) => !v && setSugestaoOp(null)}
        meuNome={meuNome}
      />
      <PendenciaDocDialog
        operacao={pendenciaOp}
        open={!!pendenciaOp}
        onOpenChange={(v) => !v && setPendenciaOp(null)}
      />
    </div>
  );
}
