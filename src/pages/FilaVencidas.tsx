import { useCallback, useEffect, useMemo, useState } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Archive, CheckCircle2, Clock, Copy, FileSearch, Gavel, RefreshCw, Undo2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import { useRadarEtapas, mesmaPessoa } from "@/lib/radarEtapas";
import {
  useOperacoesCredito,
  notifyRadarChanged,
  dataPlausivel,
  type OperacaoCredito,
} from "@/hooks/useOperacoesCredito";
import { normTexto } from "@/lib/varredura";
import { formatDataBR } from "@/lib/notificacoesBanco";
import { quemMapeia, quemProtocola, moedaBR } from "@/lib/complementacao";
import {
  acharDuplicatas,
  arquivoDePedido,
  AVISO_EM_JUIZO,
  OBS_FORA_DA_ACAO,
  chavePar,
  classificarVencida,
  ehAntiga,
  EXPLICA_SITUACAO,
  LABEL_MOTIVO_JUIZO,
  LABEL_SITUACAO,
  MARCA_EM_ATRASO,
  SAIDAS_SEM_PROVA,
  titularDaOperacao,
  type ClassificacaoVencida,
  type ProcessoJuizo,
  type ProtocoloConhecido,
  type SituacaoVencida,
} from "@/lib/filaVencidas";

const hojeISO = () => new Date().toISOString().slice(0, 10);

const ORDEM: SituacaoVencida[] = ["coberta", "em_atraso", "conferir_pasta", "em_juizo", "sem_prova"];

/** Tipos de ação já registrados na ficha do cliente. */
const LABEL_TIPO_JUDICIAL: Record<string, string> = {
  execucao: "Execução",
  busca_apreensao: "Busca e apreensão",
  consolidacao: "Consolidação de imóvel",
  consolidacao_imovel: "Consolidação de imóvel",
  monitoria: "Monitória",
  cobranca: "Cobrança",
};

interface DetalheProcesso {
  numero: string | null;
  tipo: string | null;
  distribuicao: string | null;
}

export default function FilaVencidas() {
  const { user } = useAuth();
  const { isAdmin } = usePapelRadar();
  const { meuNome } = useRadarEtapas();
  const { operacoes, loading, reload } = useOperacoesCredito({ incluirContratos: false });

  const [protocolos, setProtocolos] = useState<Map<string, ProtocoloConhecido[]>>(new Map());
  const [documentos, setDocumentos] = useState<Map<string, string[]>>(new Map());
  const [processos, setProcessos] = useState<Map<string, ProcessoJuizo[]>>(new Map());
  const [detalhes, setDetalhes] = useState<Record<string, DetalheProcesso>>({});
  const [buscandoAdvbox, setBuscandoAdvbox] = useState(false);
  const [carregandoProvas, setCarregandoProvas] = useState(true);
  const [arquivadas, setArquivadas] = useState(0);
  const [placar, setPlacar] = useState<Record<string, number>>({});
  const [aba, setAba] = useState<"fila" | "historico" | "duplicatas">("fila");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");
  /** Número da operação como consta no pedido da ação, por operação. */
  const [numInicial, setNumInicial] = useState<Record<string, string>>({});
  /** Número do processo informado à mão, por operação. */
  const [numProcesso, setNumProcesso] = useState<Record<string, string>>({});

  const nomeResponsavel = (r?: string | null) => (r && r.trim() ? r.trim() : "a definir");

  /** Junta o que sabemos do processo: número, tipo de ação e distribuição. */
  const dadosProcesso = (p: ProcessoJuizo) => {
    const d = p.advbox_lawsuits_id ? detalhes[p.advbox_lawsuits_id] : undefined;
    return {
      numero: p.numero || d?.numero || null,
      tipo: p.tipo || d?.tipo || null,
      distribuicao: p.distribuicao || d?.distribuicao || null,
    };
  };
  const textoProcesso = (p: ProcessoJuizo) => {
    const d = dadosProcesso(p);
    return [
      d.numero ? `nº ${d.numero}` : "número a conferir",
      d.distribuicao ? `distribuída em ${formatDataBR(d.distribuicao)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const podeDecidir = isAdmin || mesmaPessoa(meuNome, "Willian");
  const somar = (chave: string) => setPlacar((p) => ({ ...p, [chave]: (p[chave] || 0) + 1 }));

  // Provas: protocolos por titular + banco e documentos de pedido na pasta do cliente.
  useEffect(() => {
    (async () => {
      const [notifs, arquivos] = await Promise.all([
        supabase
          .from("notificacoes_banco")
          .select("titular_nome, banco, protocolo_data, protocolo_ref, estado")
          .eq("estado", "protocolada"),
        lerTudo(() => supabase.from("arquivos_cliente").select("nome_cliente, nome_arquivo").is("deleted_at", null)),
      ]);

      const mapa = new Map<string, ProtocoloConhecido[]>();
      const juntar = (titular: string, banco: string, p: ProtocoloConhecido) => {
        const k = chavePar(titular, banco);
        mapa.set(k, [...(mapa.get(k) ?? []), p]);
      };
      ((notifs.data as any[]) || []).forEach((n) => {
        if (n.protocolo_data)
          juntar(n.titular_nome, n.banco, {
            data: n.protocolo_data,
            referencia: n.protocolo_ref,
            origem: "ficha da notificação",
          });
      });
      operacoes
        .filter((o) => o.notificado_em)
        .forEach((o) =>
          juntar(titularDaOperacao(o), o.banco, {
            data: o.notificado_em as string,
            referencia: o.protocolo_ref ?? null,
            origem: `operação ${o.numero}`,
          }),
        );

      const docs = new Map<string, string[]>();
      ((arquivos.data as any[]) || []).forEach((a) => {
        if (!arquivoDePedido(a.nome_arquivo || "")) return;
        const k = normTexto(a.nome_cliente || "");
        docs.set(k, [...(docs.get(k) ?? []), a.nome_arquivo]);
      });

      // Processos: par titular + banco com processo no ADVBOX, e execução /
      // busca e apreensão / consolidação já registradas na ficha do cliente.
      const procs = new Map<string, ProcessoJuizo[]>();
      const juntarProc = (chave: string, p: ProcessoJuizo) =>
        procs.set(chave, [...(procs.get(chave) ?? []), p]);

      operacoes
        .filter((o) => o.advbox_lawsuits_id)
        .forEach((o) =>
          juntarProc(chavePar(titularDaOperacao(o), o.banco), {
            numero: null,
            tipo: null,
            distribuicao: null,
            origem: "ADVBOX",
            advbox_lawsuits_id: String(o.advbox_lawsuits_id),
          }),
        );

      const { data: execs } = await supabase
        .from("cliente_execucoes")
        .select("cliente_id, tipo, numero_processo, vara, status, created_at")
        .neq("status", "encerrado");
      ((execs as any[]) || []).forEach((e) => {
        if (!e.cliente_id) return;
        juntarProc(e.cliente_id, {
          numero: e.numero_processo ?? null,
          tipo: LABEL_TIPO_JUDICIAL[e.tipo as string] ?? e.tipo ?? null,
          distribuicao: (e.created_at || "").slice(0, 10) || null,
          origem: "ficha do cliente",
          daFicha: true,
        });
      });

      setProtocolos(mapa);
      setDocumentos(docs);
      setProcessos(procs);
      setCarregandoProvas(false);
    })();
  }, [operacoes]);

  /** Busca número, tipo de ação e distribuição dos processos do ADVBOX. */
  const detalharProcessos = async () => {
    const ids = Array.from(
      new Set(
        [...processos.values()]
          .flat()
          .map((p) => p.advbox_lawsuits_id)
          .filter((id): id is string => !!id && !detalhes[id]),
      ),
    ).slice(0, 20);
    if (!ids.length) {
      toast.info("Nada novo para conferir no ADVBOX.");
      return;
    }
    setBuscandoAdvbox(true);
    const { data, error } = await supabase.functions.invoke("advbox-sync", {
      body: { action: "processos_resumo", params: { ids } },
    });
    setBuscandoAdvbox(false);
    if (error) {
      toast.error("Não foi possível consultar o ADVBOX agora.");
      return;
    }
    setDetalhes((d) => ({ ...d, ...(((data as any)?.processos as Record<string, DetalheProcesso>) || {}) }));
    toast.success(`${ids.length} processo(s) conferido(s) no ADVBOX.`);
  };

  const hoje = hojeISO();

  const vencidas = useMemo(
    () =>
      operacoes.filter(
        (o) =>
          o.origem !== "contrato" &&
          !o.notificado_em &&
          !o.dispensar_alerta &&
          !o.historico_em &&
          o.duplicata_status !== "confirmada" &&
          !!o.vence_em &&
          dataPlausivel(o.vence_em) &&
          (o.vence_em as string) < hoje,
      ),
    [operacoes, hoje],
  );

  /**
   * O processo do ADVBOX só vira ação judicial depois que sabemos o número e o
   * tipo. Aqui juntamos o que já foi conferido no ADVBOX aos registros.
   */
  const processosEnriquecidos = useMemo(() => {
    const m = new Map<string, ProcessoJuizo[]>();
    processos.forEach((lista, chave) =>
      m.set(
        chave,
        lista.map((p) => {
          const d = p.advbox_lawsuits_id ? detalhes[p.advbox_lawsuits_id] : undefined;
          return d ? { ...p, numero: p.numero ?? d.numero, tipo: p.tipo ?? d.tipo, distribuicao: p.distribuicao ?? d.distribuicao } : p;
        }),
      ),
    );
    return m;
  }, [processos, detalhes]);

  const classificadas = useMemo<ClassificacaoVencida[]>(
    () =>
      vencidas.map((o) =>
        classificarVencida(o, { protocolos, documentos, processos: processosEnriquecidos, hoje }),
      ),
    [vencidas, protocolos, documentos, processosEnriquecidos, hoje],
  );

  const responsaveis = useMemo(() => {
    const nomes = new Map<string, number>();
    classificadas.forEach((c) => {
      const n = nomeResponsavel(c.operacao.responsavel);
      nomes.set(n, (nomes.get(n) || 0) + 1);
    });
    return [...nomes.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [classificadas]);

  const filtradas = useMemo(
    () =>
      filtroResponsavel === "todos"
        ? classificadas
        : classificadas.filter((c) => nomeResponsavel(c.operacao.responsavel) === filtroResponsavel),
    [classificadas, filtroResponsavel],
  );

  const porSituacao = useMemo(() => {
    const m: Record<SituacaoVencida, ClassificacaoVencida[]> = {
      coberta: [],
      em_atraso: [],
      conferir_pasta: [],
      em_juizo: [],
      sem_prova: [],
    };
    filtradas.forEach((c) => m[c.situacao].push(c));
    // Mais antigas no topo.
    ORDEM.forEach((s) => m[s].sort((a, b) => (a.operacao.vence_em || "").localeCompare(b.operacao.vence_em || "")));
    return m;
  }, [filtradas]);

  const historico = useMemo(
    () => operacoes.filter((o) => !!o.historico_em).sort((a, b) => (a.vence_em || "").localeCompare(b.vence_em || "")),
    [operacoes],
  );

  const duplicatas = useMemo(
    () =>
      acharDuplicatas(operacoes.filter((o) => o.origem !== "contrato" && o.duplicata_status !== "descartada")).filter(
        (g) => g.some((o) => o.duplicata_status !== "confirmada"),
      ),
    [operacoes],
  );

  const pendencia = async (tipo: string, titulo: string, descricao: string) => {
    await supabase.from("advbox_pendencias").insert({ tipo, titulo, descricao, status: "aberta" } as any);
  };

  const darBaixa = async (c: ClassificacaoVencida, atraso: boolean) => {
    const p = c.protocolo;
    if (!p) return;
    setSalvando(c.operacao.id);
    const { error } = await supabase
      .from("operacoes_credito")
      .update({
        notificado_em: p.data,
        protocolo_ref: p.referencia,
        protocolo_atraso: atraso,
      } as any)
      .eq("id", c.operacao.id);
    if (!error && atraso) {
      await pendencia(
        "notificacao",
        `Acompanhar protocolo em atraso — ${titularDaOperacao(c.operacao)} / ${c.operacao.banco}`,
        `Operação ${c.operacao.numero}, vencida em ${formatDataBR(c.operacao.vence_em)}: ${MARCA_EM_ATRASO} ` +
          `(protocolo de ${formatDataBR(p.data)}${p.referencia ? `, ref. ${p.referencia}` : ""}). ` +
          `A estratégia muda: a MP 1.376 trava em inadimplência. Protocola: ${quemProtocola(c.operacao.responsavel)}.`,
      );
    }
    setSalvando(null);
    if (error) {
      toast.error("Não foi possível dar baixa");
      return;
    }
    somar(atraso ? "em_atraso" : "coberta");
    toast.success(atraso ? "Baixa registrada com a marca de atraso" : "Baixa registrada — protocolada em tempo");
    notifyRadarChanged();
    reload();
  };

  const tarefaDigitarNumero = async (c: ClassificacaoVencida) => {
    setSalvando(c.operacao.id);
    await pendencia(
      "mapeamento",
      `Digitar o número do protocolo — ${titularDaOperacao(c.operacao)}/${c.operacao.banco}`,
      `Para ${quemMapeia(c.operacao.responsavel)}. Operação ${c.operacao.numero}, vencida em ` +
        `${formatDataBR(c.operacao.vence_em)}. Documento(s) na pasta: ${c.documentos.join(", ")}.`,
    );
    setSalvando(null);
    somar("conferir_pasta");
    toast.success("Tarefa criada para quem mapeia");
  };

  /**
   * Saídas da conferência: só sai do radar quem confirma que a operação está no
   * pedido da ação, informando o número dela conforme consta na inicial.
   */
  const conferirJuizo = async (c: ClassificacaoVencida, naAcao: boolean) => {
    const o = c.operacao;
    const naInicial = (numInicial[o.id] || "").trim();
    if (naAcao && !naInicial) {
      toast.error("Informe o número da operação como consta no pedido da ação.");
      return;
    }
    setSalvando(o.id);
    const listaProc = c.judiciais
      .map((p) => `${p.tipo || "ação"} ${textoProcesso(p) || ""}`.trim())
      .join("; ");
    const update: any = {
      juizo_conferencia: naAcao ? "na_acao" : "fora_da_acao",
      juizo_conferido_em: new Date().toISOString(),
      juizo_obs: naAcao
        ? `Confirmada no pedido da ação como "${naInicial}" (${listaProc}).`
        : OBS_FORA_DA_ACAO,
    };
    if (naAcao) {
      update.juizo_operacao_na_inicial = naInicial;
      update.dispensar_alerta = true;
      update.dispensa_motivo = "Já está no pedido da ação — acompanhamento processual.";
    }
    const { error } = await supabase.from("operacoes_credito").update(update).eq("id", o.id);
    if (!error && naAcao)
      await pendencia(
        "processo",
        `Acompanhamento processual — ${titularDaOperacao(o)} / ${o.banco}`,
        `Operação ${o.numero} (venceu em ${formatDataBR(o.vence_em)}) já está no pedido da ação: ${listaProc}. ` +
          `Não cabe pedido administrativo novo. Carteira: ${o.responsavel || "a definir"}.`,
      );
    setSalvando(null);
    if (error) {
      toast.error("Não foi possível registrar a conferência");
      return;
    }
    somar(naAcao ? "na_acao" : "fora_da_acao");
    toast.success(
      naAcao ? "Saiu do radar: segue em acompanhamento processual" : "Voltou para a fila de decisão — pode caber aditamento da inicial",
    );
    notifyRadarChanged();
    reload();
  };

  /** Marcar à mão que há ação judicial, informando o número do processo. */
  const marcarJuizoManual = async (c: ClassificacaoVencida) => {
    const o = c.operacao;
    const numero = (numProcesso[o.id] || "").trim();
    if (!numero) {
      toast.error("Informe o número do processo.");
      return;
    }
    setSalvando(o.id);
    const { error } = await supabase
      .from("operacoes_credito")
      .update({ juizo_manual: true, juizo_processo_numero: numero, juizo_conferencia: null } as any)
      .eq("id", o.id);
    setSalvando(null);
    if (error) {
      toast.error("Não foi possível marcar a ação judicial");
      return;
    }
    somar("marcado_mao");
    toast.success("Marcada como ação judicial — falta confirmar se a operação está no pedido");
    reload();
  };

  const decidir = async (c: ClassificacaoVencida, saida: string) => {
    setSalvando(c.operacao.id);
    const base: any = {
      decisao_vencida: saida,
      decisao_em: new Date().toISOString(),
      decisao_por: user?.id ?? null,
    };
    if (saida === "nao_existe") {
      base.dispensar_alerta = true;
      base.dispensa_motivo = "Operação não existe mais / quitada — decisão registrada na fila de vencidas.";
    }
    const { error } = await supabase.from("operacoes_credito").update(base).eq("id", c.operacao.id);
    if (!error && saida === "cabe_pedido")
      await pendencia(
        "peticionamento",
        `Peticionamento URGENTE — ${titularDaOperacao(c.operacao)} / ${c.operacao.banco}`,
        `ATENÇÃO: o vencimento é ${formatDataBR(c.operacao.vence_em)} e não há pedido protocolado. ` +
          `Protocolar imediatamente, ainda que em pedido genérico. Operação ${c.operacao.numero}. ` +
          `Protocola: ${quemProtocola(c.operacao.responsavel)}.`,
      );
    if (!error && saida === "perdeu_prazo")
      await pendencia(
        "notificacao",
        `Avaliar ação judicial — ${titularDaOperacao(c.operacao)} / ${c.operacao.banco}`,
        `Perdeu o prazo do pedido na operação ${c.operacao.numero} (venceu em ${formatDataBR(c.operacao.vence_em)}). ` +
          `Seguir a régua de próximo passo na tela Notificações.`,
      );
    setSalvando(null);
    if (error) {
      toast.error("Não foi possível registrar a decisão");
      return;
    }
    somar(`decisao_${saida}`);
    toast.success("Decisão registrada");
    notifyRadarChanged();
    reload();
  };

  const voltarDoHistorico = async (o: OperacaoCredito) => {
    await supabase
      .from("operacoes_credito")
      .update({ historico_em: null, historico_motivo: null, historico_manual: true } as any)
      .eq("id", o.id);
    toast.success("Operação de volta ao radar");
    notifyRadarChanged();
    reload();
  };

  const marcarDuplicata = async (o: OperacaoCredito, manter: OperacaoCredito, duplicata: boolean) => {
    await supabase
      .from("operacoes_credito")
      .update({
        duplicata_de: duplicata ? manter.id : null,
        duplicata_status: duplicata ? "confirmada" : "descartada",
        duplicata_motivo: duplicata
          ? `Mesmo número e vencimento em ${titularDaOperacao(manter)}.`
          : "Conferido: são operações diferentes.",
        dispensar_alerta: duplicata ? true : o.dispensar_alerta,
        dispensa_motivo: duplicata ? `Duplicata: a operação é de ${titularDaOperacao(manter)}.` : o.dispensa_motivo,
      } as any)
      .eq("id", o.id);
    somar(duplicata ? "duplicata" : "duplicata_descartada");
    toast.success(duplicata ? "Marcada como duplicata — não conta no radar" : "Marcada como operação distinta");
    notifyRadarChanged();
    reload();
  };

  const totalVencidasAntes =
    vencidas.length +
    (placar.coberta || 0) +
    (placar.em_atraso || 0) +
    (placar.decisao_cabe_pedido || 0) +
    (placar.decisao_perdeu_prazo || 0) +
    (placar.decisao_nao_existe || 0) +
    arquivadas;

  const esperandoDecisao = porSituacao.sem_prova.length;
  // Placar do critério novo: por que cada operação entrou em "em juízo".
  const emJuizoLista = classificadas.filter((c) => c.situacao === "em_juizo");
  const emJuizo = emJuizoLista.length;
  const porMotivo = (m: string) => emJuizoLista.filter((c) => c.motivoJuizo === m).length;
  const juizoPorMotivo = {
    cnj: porMotivo("cnj"),
    tipo: porMotivo("tipo"),
    ficha: porMotivo("ficha"),
    manual: porMotivo("manual"),
  };
  /** Tinham cadastro no ADVBOX, mas sem CNJ e sem tipo judicial: não é ação. */
  const soCadastroAdvbox = classificadas.filter(
    (c) => c.situacao !== "em_juizo" && c.processos.length > 0 && c.judiciais.length === 0,
  );
  const voltaramSemProva = soCadastroAdvbox.filter((c) => c.situacao === "sem_prova").length;
  const voltaramConferirPasta = soCadastroAdvbox.filter((c) => c.situacao === "conferir_pasta").length;

  const linhaOperacao = (c: ClassificacaoVencida) => {
    const o = c.operacao;
    return (
      <div key={o.id} className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="font-serif text-base font-bold">{titularDaOperacao(o)}</p>
          <span className="text-sm text-muted-foreground">— {o.banco}</span>
          <Badge variant="outline" className="font-normal">
            nº {o.numero}
          </Badge>
          <Badge variant="outline" className="font-normal">
            venceu em {formatDataBR(o.vence_em)} · há {c.diasVencida} dia(s)
          </Badge>
          {ehAntiga(c) && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              há mais de 1 ano
            </Badge>
          )}
          <Badge variant="outline" className="font-normal">
            {moedaBR(o.saldo_devedor)}
          </Badge>
          <Badge variant="outline" className="font-normal">
            carteira: {o.responsavel || "a definir"}
          </Badge>
        </div>

        {c.protocolo && (
          <p className="mt-1 text-sm text-muted-foreground">
            Protocolo de {formatDataBR(c.protocolo.data)}
            {c.protocolo.referencia ? ` · ${c.protocolo.referencia}` : ""} ({c.protocolo.origem})
          </p>
        )}
        {c.situacao === "conferir_pasta" && (
          <p className="mt-1 text-sm text-muted-foreground">Na pasta: {c.documentos.join(", ")}</p>
        )}
        {c.situacao === "em_juizo" && (
          <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2">
            <p className="text-sm font-semibold text-destructive">
              <Gavel className="mr-1 inline h-4 w-4" />
              {AVISO_EM_JUIZO}
            </p>
            {c.motivoJuizo && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Entrou aqui por: {LABEL_MOTIVO_JUIZO[c.motivoJuizo]}.
              </p>
            )}
            <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              {c.judiciais.map((p, i) => {
                const d = dadosProcesso(p);
                return (
                  <li key={`${p.origem}-${p.advbox_lawsuits_id ?? i}`}>
                    {d.tipo || "Ação"} — {textoProcesso(p)} ({p.origem})
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          {c.situacao === "coberta" && (
            <Button size="sm" disabled={salvando === o.id} onClick={() => darBaixa(c, false)}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar e dar baixa
            </Button>
          )}
          {c.situacao === "em_atraso" && (
            <Button size="sm" disabled={salvando === o.id} onClick={() => darBaixa(c, true)}>
              <AlertTriangle className="mr-1 h-4 w-4" /> Dar baixa em acompanhamento
            </Button>
          )}
          {c.situacao === "conferir_pasta" && (
            <Button size="sm" disabled={salvando === o.id} onClick={() => tarefaDigitarNumero(c)}>
              <FileSearch className="mr-1 h-4 w-4" /> Criar tarefa para digitar o número
            </Button>
          )}
          {c.situacao === "em_juizo" && (
            <>
              <Input
                className="h-9 w-56"
                placeholder="Nº da operação na inicial"
                value={numInicial[o.id] || ""}
                onChange={(e) => setNumInicial((v) => ({ ...v, [o.id]: e.target.value }))}
              />
              <Button
                size="sm"
                disabled={salvando === o.id || !(numInicial[o.id] || "").trim()}
                onClick={() => conferirJuizo(c, true)}
              >
                <Gavel className="mr-1 h-4 w-4" /> Sim, está no pedido da ação
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={salvando === o.id}
                onClick={() => conferirJuizo(c, false)}
              >
                Não está na ação
              </Button>
            </>
          )}
          {c.situacao === "sem_prova" &&
            (podeDecidir ? (
              SAIDAS_SEM_PROVA.map((s) => (
                <Button
                  key={s.value}
                  size="sm"
                  variant={s.value === "cabe_pedido" ? "default" : "outline"}
                  disabled={salvando === o.id}
                  title={s.ajuda}
                  onClick={() => decidir(c, s.value)}
                >
                  {s.label}
                </Button>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Esperando a decisão do Willian.</span>
            ))}
          {c.situacao === "sem_prova" && (
            <Button size="sm" variant="ghost" asChild>
              <Link to="/notificacoes">Abrir a régua de próximo passo</Link>
            </Button>
          )}
        </div>
        {c.situacao === "sem_prova" && o.juizo_conferencia === "fora_da_acao" && (
          <p className="mt-2 text-sm text-muted-foreground">{OBS_FORA_DA_ACAO}</p>
        )}
        {(c.situacao === "sem_prova" || c.situacao === "conferir_pasta") && !o.juizo_manual && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Há ação judicial com este banco?</span>
            <Input
              className="h-9 w-64"
              placeholder="Número do processo"
              value={numProcesso[o.id] || ""}
              onChange={(e) => setNumProcesso((v) => ({ ...v, [o.id]: e.target.value }))}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={salvando === o.id || !(numProcesso[o.id] || "").trim()}
              onClick={() => marcarJuizoManual(c)}
            >
              <Gavel className="mr-1 h-4 w-4" /> Marcar em juízo
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Limpeza da fila de vencidas</h1>
          <p className="text-sm text-muted-foreground">
            Cada operação vencida recebe a mesma classificação, e a fila aparece separada por situação.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/vencimentos#radar">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao radar
          </Link>
        </Button>
      </div>

      {/* Placar */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Vencidas havia</p>
          <p className="font-serif text-xl font-bold">{totalVencidasAntes}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Baixas em tempo</p>
          <p className="font-serif text-xl font-bold">{placar.coberta || 0}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Baixas em atraso</p>
          <p className="font-serif text-xl font-bold">{placar.em_atraso || 0}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Em juízo — a conferir</p>
          <p className="font-serif text-xl font-bold">{emJuizo}</p>
          <p className="text-xs text-muted-foreground">
            {juizoPorMotivo.cnj} com CNJ · {juizoPorMotivo.tipo} por tipo de ação ·{" "}
            {juizoPorMotivo.ficha} da ficha · {juizoPorMotivo.manual} à mão
          </p>
          <p className="text-xs text-muted-foreground">
            {placar.na_acao || 0} confirmadas na ação · {placar.fora_da_acao || 0} fora da ação
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Tarefas de digitar número</p>
          <p className="font-serif text-xl font-bold">{placar.conferir_pasta || 0}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Foram para o Histórico</p>
          <p className="font-serif text-xl font-bold">{arquivadas}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Esperando decisão</p>
          <p className="font-serif text-xl font-bold">{esperandoDecisao}</p>
        </div>
      </div>

      {aba === "fila" && soCadastroAdvbox.length > 0 && (
        <p className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {soCadastroAdvbox.length} operação(ões) têm processo no ADVBOX sem número CNJ e sem tipo de ação
          judicial — é cadastro administrativo nosso, feito só para lançar tarefa, então não entram em
          juízo: {voltaramSemProva} voltaram para "sem prova" e {voltaramConferirPasta} para "conferir pasta".
        </p>
      )}

      {aba === "fila" && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {emJuizo} vencida(s) confirmada(s) com ação judicial neste banco.
          </span>
          <Button size="sm" variant="outline" disabled={buscandoAdvbox} onClick={detalharProcessos}>
            <RefreshCw className={`mr-1 h-4 w-4 ${buscandoAdvbox ? "animate-spin" : ""}`} />
            Buscar número e data no ADVBOX
          </Button>
        </div>
      )}

      {/* Filtro por responsável da carteira */}
      {aba === "fila" && responsaveis.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Responsável:</span>
          <Button
            size="sm"
            variant={filtroResponsavel === "todos" ? "default" : "outline"}
            onClick={() => setFiltroResponsavel("todos")}
          >
            Todos ({classificadas.length})
          </Button>
          {responsaveis.map(([nome, qtd]) => (
            <Button
              key={nome}
              size="sm"
              variant={filtroResponsavel === nome ? "default" : "outline"}
              onClick={() => setFiltroResponsavel(nome)}
            >
              {nome} ({qtd})
            </Button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: "fila", label: `Fila por situação (${classificadas.length})` },
          { id: "historico", label: `Histórico (${historico.length})` },
          { id: "duplicatas", label: `Possíveis duplicatas (${duplicatas.length})` },
        ].map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={aba === t.id ? "default" : "outline"}
            onClick={() => setAba(t.id as typeof aba)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {(loading || carregandoProvas) && <p className="text-sm text-muted-foreground">Conferindo a base…</p>}

      {aba === "fila" && !loading && (
        <div className="space-y-6">
          {ORDEM.map((s) => (
            <section key={s}>
              <p className="font-serif text-lg font-bold">
                {LABEL_SITUACAO[s]}{" "}
                <span className="font-sans text-sm font-semibold text-muted-foreground">
                  ({porSituacao[s].length})
                </span>
              </p>
              <p className="mb-2 text-sm text-muted-foreground">{EXPLICA_SITUACAO[s]}</p>
              {porSituacao[s].length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma operação nesta situação.</p>
              ) : (
                <div className="space-y-2">{porSituacao[s].map(linhaOperacao)}</div>
              )}
            </section>
          ))}
        </div>
      )}

      {aba === "historico" && !loading && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Archive className="mr-1 inline h-4 w-4" />
            Só entra aqui a operação que recebeu um destino: quitada, renegociada/substituída, duplicata, não é
            operação, protocolada em acompanhamento, banco fora do contrato ou cliente encerrado. Idade, sozinha, nunca
            arquiva nada. Não sumiram: voltam com um clique.
          </p>
          {historico.length === 0 && <p className="text-sm text-muted-foreground">Nada no histórico.</p>}
          {historico.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
              <span className="font-serif font-bold">{titularDaOperacao(o)}</span>
              <span className="text-sm text-muted-foreground">
                — {o.banco} · nº {o.numero} · venceu em {formatDataBR(o.vence_em)}
              </span>
              <Badge variant="outline" className="font-normal">
                {o.historico_motivo || "saída registrada à mão"}
              </Badge>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => voltarDoHistorico(o)}>
                <Undo2 className="mr-1 h-4 w-4" /> Voltar ao radar
              </Button>
            </div>
          ))}
        </div>
      )}

      {aba === "duplicatas" && !loading && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <Copy className="mr-1 inline h-4 w-4" />
            Mesmo número e mesmo vencimento em clientes diferentes. Enquanto não houver conferência, as duas não são
            contadas como casos distintos no radar.
          </p>
          {duplicatas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma duplicata em aberto.</p>}
          {duplicatas.map((grupo) => (
            <div key={grupo.map((o) => o.id).join("-")} className="rounded-lg border border-border bg-card p-3">
              <p className="font-serif text-base font-bold">
                {grupo[0].numero && grupo[0].numero !== "—"
                  ? `nº ${grupo[0].numero}`
                  : (grupo[0].origem_arquivo || "").replace(/^.*[\\/]/, "")}
                {grupo[0].vence_em ? ` · vence em ${formatDataBR(grupo[0].vence_em)}` : " · sem vencimento"}
              </p>
              <p className="text-xs text-muted-foreground">possível duplicata - conferir (segue ativa até alguém confirmar)</p>

              <div className="mt-2 space-y-2">
                {grupo.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                    <span className="text-sm">{titularDaOperacao(o)}</span>
                    <span className="text-xs text-muted-foreground">{o.banco}</span>
                    {o.duplicata_status && (
                      <Badge variant="outline" className="font-normal">
                        {o.duplicata_status === "confirmada" ? "duplicata confirmada" : "possível duplicata"}
                      </Badge>
                    )}
                    {o.duplicata_status !== "confirmada" && (
                      <span className="ml-auto flex gap-2">
                        {grupo
                          .filter((outra) => outra.id !== o.id)
                          .map((outra) => (
                            <Button
                              key={outra.id}
                              size="sm"
                              variant="outline"
                              onClick={() => marcarDuplicata(o, outra, true)}
                            >
                              É cópia da ficha de {titularDaOperacao(outra).split(" ")[0]}
                            </Button>
                          ))}
                        <Button size="sm" variant="ghost" onClick={() => marcarDuplicata(o, o, false)}>
                          São diferentes
                        </Button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        <Clock className="mr-1 inline h-3 w-3" />
        Nada é aplicado em lote automático, salvo o envio ao Histórico das vencidas há mais de um ano sem movimento.
      </p>
    </AppLayout>
  );
}
