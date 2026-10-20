import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle, BarChart3, Bell, CheckCircle2, Clock, Kanban, LayoutList,
  ListChecks, Plus, Save, Search, User, X,
} from "lucide-react";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ErroApi, mensagemDeErro, usuarioApi } from "@/lib/api/http";
import {
  atualizarTarefa, criarTarefa, listarHistoricoTarefa, listarTarefas, prazoDaTarefa,
  type BuscaTarefas, type Tarefa,
} from "@/lib/api/tarefas";
import { buscarContrato } from "@/lib/api/contratos";
import { TabelaTarefas } from "@/pages/erp/TarefasLista";
import { corDePrioridade } from "@/lib/prioridade";
import { CalendarioTarefas } from "@/pages/erp/TarefasCalendario";
import { EncaminharTarefa, TarefaTimeline } from "@/components/erp/TarefaMovimentacao";
import { mapaDeNomes, listarMembros, type Membro } from "@/lib/api/membros";
import { listarSetores, type Setor } from "@/lib/api/setores";
import { ClienteBusca, type ClienteEscolhido } from "@/components/erp/ClienteBusca";
import {
  aoAbrirTarefa,
  recarregarNotificacoes,
  useNotificacoes,
} from "@/hooks/useNotificacoes";

/**
 * Tarefas — painel "Minhas tarefas" migrado da tela legada `/tarefas`
 * (`fonts-lovable/src/pages/Tarefas.tsx`), em duas visões:
 *
 * - **Lista**: tabela no padrão ADVBOX com os quatro marcadores; no topo, os KPIs e o
 *   calendario de 270px (`.col-md-small-fixed` do original) — clicar num dia filtra a
 *   tabela embaixo do card, como o `type:"selector"` do plugin do ADVBOX;
 * - **Kanban**: as mesmas quatro colunas em quadro com arrastar-e-soltar — soltar
 *   em "Concluídas" conclui; soltar em uma coluna de prazo reagenda a tarefa
 *   (Ontem / Hoje / +7 dias).
 *
 * Enquanto a API não expõe a lista de membros (`identity/membro`), todo mundo vê
 * só as próprias tarefas (`minhas=1`); o painel por colaborador (admin vendo a
 * equipe) entra quando o endpoint de membros existir — ver
 * `oliveira-api/docs/planejamento-tarefas-api.md`.
 */

const HOJE = new Date().toISOString().split("T")[0];

/**
 * Prioridade é SELECT, não texto (pedido do titular 16/10/2026): Normal, Alta e Urgente.
 * Os valores gravados são as chaves — o legado usava "normal"/"urgente", que continuam
 * válidos; tarefas antigas com outro texto caem em "normal" na edição.
 */
const PRIORIDADES = [
  { valor: "normal", rotulo: "Normal" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "urgente", rotulo: "Urgente" },
];

const prioridadeValida = (valor?: string | null) =>
  PRIORIDADES.some((item) => item.valor === valor) ? (valor as string) : "normal";

type Vista = "lista" | "kanban";

const COLUNAS_KANBAN = [
  { id: "atrasadas", rotulo: "Atrasadas", tom: "text-destructive" },
  { id: "hoje", rotulo: "Hoje", tom: "text-[hsl(var(--warning-foreground))]" },
  { id: "proximas", rotulo: "Próximas", tom: "text-foreground" },
  { id: "concluidas", rotulo: "Concluídas", tom: "text-success" },
] as const;

type ColunaKanban = (typeof COLUNAS_KANBAN)[number]["id"];

const dataBr = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

function statusDaTarefa(t: Tarefa): ColunaKanban {
  if (t.concluida) return "concluidas";
  if (t.dataVencimento < HOJE) return "atrasadas";
  if (t.dataVencimento === HOJE) return "hoje";
  return "proximas";
}

/**
 * Campos em que a busca de texto procura — o select ao lado do campo (decisão do titular,
 * 20/10/2026, mesmo estilo da lista de contratos): título, descrição ou cliente.
 */
const CAMPOS_BUSCA: { valor: BuscaTarefas; rotulo: string; placeholder: string }[] = [
  { valor: "titulo", rotulo: "Título", placeholder: "Buscar por título..." },
  { valor: "descricao", rotulo: "Descrição", placeholder: "Buscar na descrição..." },
  { valor: "cliente", rotulo: "Cliente", placeholder: "Buscar por cliente..." },
];

export default function TarefasApi() {
  const usuario = usuarioApi();
  /** Sino (store único com o menu): total de não lidas + as que ainda não foram vistas. */
  const { naoLidas, novas } = useNotificacoes();
  const location = useLocation();
  const navigate = useNavigate();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  /** Campo em que a busca de texto procura (select ao lado do campo). */
  const [buscaEm, setBuscaEm] = useState<BuscaTarefas>("titulo");
  const [vista, setVista] = useState<Vista>("lista");
  const [semMaisPaginas, setSemMaisPaginas] = useState(true);
  /** Dia clicado no calendario: filtra a tabela da aba Lista (null = todas). */
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const [dialogNova, setDialogNova] = useState(false);
  const [tarefaAberta, setTarefaAberta] = useState<Tarefa | null>(null);
  /** Timeline aberta na janela central grande (botão "Histórico" da lista). */
  const [tarefaHistorico, setTarefaHistorico] = useState<Tarefa | null>(null);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(50);
  /** Dia escolhido no calendario para a nova tarefa com o vencimento ja preenchido. */
  const [dataPreta, setDataPreta] = useState<string | null>(null);
  /** Cliente vindo da lista de Clientes (botao "Nova tarefa" da linha). */
  const [clientePreta, setClientePreta] = useState<ClienteEscolhido | null>(null);
  const clienteVindo = (location.state as { cliente?: ClienteEscolhido } | null)?.cliente ?? null;

  // Consumo o estado passado pela lista de Clientes: abre o form ja com o cliente e
  // limpa o state da rota, para reabrir manualmente depois nao reaparecer preenchido.
  useEffect(() => {
    if (!clienteVindo) return;
    setClientePreta(clienteVindo);
    setDialogNova(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [clienteVindo, location.pathname, navigate]);
  /** userId -> nome, para a coluna "Responsavel" nao virar UUID na tela. */
  const [nomes, setNomes] = useState<Map<string, string>>(() => new Map());

  /**
   * Abrir uma tarefa (lista, kanban ou notificação): é a LEITURA dela — só aqui a
   * notificação some do sininho (decisão do titular 16/10/2026).
   */
  const abrirTarefa = useCallback((tarefa: Tarefa) => {
    aoAbrirTarefa(tarefa.id);
    setTarefaAberta(tarefa);
  }, []);

  /** Card de alerta "você recebeu uma tarefa de X" (mesmo estilo dos avisos do sistema). */
  useEffect(() => {
    novas.forEach((notificacao) => {
      toast(`Você recebeu uma tarefa de ${notificacao.deUsuarioNome || "outro usuário"}`, {
        description: notificacao.tarefaTitulo ?? undefined,
        duration: 20000,
        action: {
          label: "Abrir",
          onClick: () => void abrirNotificacao(notificacao.tarefaId),
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novas]);

  /** Sino clicado: abre a tarefa mais antiga ainda não vista (ou avisa que não há). */
  const abrirNotificacao = useCallback(async (tarefaId: string) => {
    const tarefa = tarefas.find((t) => t.id === tarefaId);
    if (tarefa) {
      abrirTarefa(tarefa);
      return;
    }
    try {
      const resultado = await listarTarefas({ minhas: true, page: 0, size: 200 });
      setTarefas(resultado.content);
      const achada = resultado.content.find((t) => t.id === tarefaId);
      if (achada) abrirTarefa(achada);
      else toast.error("Esta tarefa não está na sua lista.");
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  }, [abrirTarefa, tarefas]);

  useEffect(() => {
    let vivo = true;
    mapaDeNomes().then((mapa) => {
      if (vivo) setNomes(mapa);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // `campo` usa o padrão da propria chamada: trocar o select e chamar `carregar(busca)`
  // ja busca no campo novo, sem depender do estado dentro do useCallback.
  const carregar = useCallback(async (texto: string, campo: BuscaTarefas = buscaEm) => {
    setCarregando(true);
    try {
      const termo = texto.trim();
      const resultado = await listarTarefas({
        minhas: true,
        busca: termo || undefined,
        buscaEm: termo ? campo : undefined,
        page: 0,
        size: 200,
      });
      setTarefas(resultado.content);
      setSemMaisPaginas(resultado.page.last);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setCarregando(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- campo = buscaEm le o estado na hora da chamada
  }, []);

  useEffect(() => {
    carregar("");
  }, [carregar]);

  // Busca com debounce (mesmo padrão da tela de Clientes).
  const primeiraBusca = useRef(true);
  const timerBusca = useRef<number | null>(null);
  useEffect(() => {
    if (primeiraBusca.current) {
      primeiraBusca.current = false;
      return;
    }
    if (timerBusca.current) window.clearTimeout(timerBusca.current);
    setPagina(0);
    timerBusca.current = window.setTimeout(() => carregar(busca), 300);
    return () => {
      if (timerBusca.current) window.clearTimeout(timerBusca.current);
    };
  }, [busca, carregar]);

  /**
   * Conclusão só pelo Status (decisão do titular 16/10/2026): virar concluída é pedido de
   * conclusão; concluída NÃO volta (sem reabertura) — para continuar o fluxo, abre-se
   * outra tarefa.
   */
  const alternarConcluida = useCallback(async (tarefa: Tarefa, concluida: boolean) => {
    // Reabertura não existe mais: conclusão é definitiva.
    if (tarefa.concluida && !concluida) {
      toast.error("Tarefa concluída não pode ser reaberta — abra uma nova tarefa.");
      return;
    }
    // Otimista: a tela responde na hora; se a API negar, volta ao estado anterior.
    setTarefas((atual) =>
      atual.map((t) => (t.id === tarefa.id ? { ...t, concluida } : t)),
    );
    setTarefaAberta((atual) =>
      atual?.id === tarefa.id ? { ...atual, concluida } : atual,
    );
    try {
      await atualizarTarefa(tarefa.id, { concluida });
      toast.success("Tarefa concluída");
      recarregarNotificacoes();
    } catch (erro) {
      setTarefas((atual) =>
        atual.map((t) => (t.id === tarefa.id ? { ...t, concluida: tarefa.concluida } : t)),
      );
      toast.error(mensagemDeErro(erro));
    }
  }, []);

  /**
   * Reagendar (arrastar no kanban): só em tarefa ABERTA — concluída não se move mais
   * (decisão do titular 16/10/2026); para movimentar de novo, abre-se outra tarefa.
   */
  const reagendar = useCallback(async (tarefa: Tarefa, coluna: ColunaKanban) => {
    if (tarefa.concluida) {
      toast.error("Tarefa concluída não pode ser movida — abra uma nova tarefa.");
      return;
    }
    const novaData =
      coluna === "atrasadas"
        ? format(addDays(new Date(), -1), "yyyy-MM-dd")
        : coluna === "hoje"
        ? HOJE
        : format(addDays(new Date(), 7), "yyyy-MM-dd");
    if (tarefa.dataVencimento === novaData && !tarefa.concluida) return;
    setTarefas((atual) =>
      atual.map((t) => (t.id === tarefa.id ? { ...t, dataVencimento: novaData } : t)),
    );
    try {
      await atualizarTarefa(tarefa.id, { dataVencimento: novaData });
      toast.success(`Reagendada para ${dataBr(novaData)}`);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
      carregar(busca);
    }
  }, [busca, carregar]);

  const soltar = useCallback(
    (coluna: ColunaKanban) => {
      const tarefa = tarefas.find((t) => t.id === arrastandoId);
      setArrastandoId(null);
      if (!tarefa || statusDaTarefa(tarefa) === coluna) return;
      if (tarefa.concluida) {
        // Concluída não se move mais — nem volta para as colunas de prazo.
        if (coluna !== "concluidas") {
          toast.error("Tarefa concluída não pode ser movida — abra uma nova tarefa.");
        }
        return;
      }
      if (coluna === "concluidas") {
        alternarConcluida(tarefa, true);
      } else {
        reagendar(tarefa, coluna);
      }
    },
    [alternarConcluida, arrastandoId, reagendar, tarefas],
  );

  const hoje0 = HOJE;
  /**
   * Recorte pelo dia escolhido no calendario — mesma regra de data do badge
   * (prazo fatal, ou vencimento quando nao ha prazo), para o numero do dia e as
   * linhas de baixo (tabela e colunas do kanban) sempre baterem.
   */
  const tarefasFiltradas = useMemo(
    () =>
      diaSelecionado
        ? tarefas.filter((tarefa) => prazoDaTarefa(tarefa) === diaSelecionado)
        : tarefas,
    [tarefas, diaSelecionado],
  );

  const campoBuscaPlaceholder =
    CAMPOS_BUSCA.find((opcao) => opcao.valor === buscaEm)?.placeholder ?? CAMPOS_BUSCA[0].placeholder;

  const agrupadas = useMemo(() => {
    const pendentes = tarefasFiltradas.filter((t) => !t.concluida);
    return {
      atrasadas: pendentes.filter((t) => t.dataVencimento < hoje0),
      hoje: pendentes.filter((t) => t.dataVencimento === hoje0),
      proximas: pendentes.filter((t) => t.dataVencimento > hoje0),
      concluidas: tarefasFiltradas.filter((t) => t.concluida),
    };
  }, [tarefasFiltradas, hoje0]);

  // Trocar o dia zera a pagina da tabela.
  useEffect(() => setPagina(0), [diaSelecionado]);

  const temAlgo = tarefas.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6">
      <PageHeader
        icon={ListChecks}
        title="Tarefas"
        subtitle="Suas tarefas do fluxo — lista ou kanban"
        breadcrumb={[{ label: "Módulos na API" }, { label: "Tarefas" }]}
        actions={
          <div className="flex items-center gap-3">
            <Tabs value={vista} onValueChange={(valor) => setVista(valor as Vista)}>
              <TabsList>
                <TabsTrigger value="lista" className="gap-1.5">
                  <LayoutList className="w-3.5 h-3.5" /> Lista
                </TabsTrigger>
                <TabsTrigger value="kanban" className="gap-1.5">
                  <Kanban className="w-3.5 h-3.5" /> Kanban
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {/* Sino ao lado das abas: movimentações de tarefas recebidas. Some quando a
                pessoa ABRE a tarefa (lista/kanban) — não ao clicar aqui. */}
            <button
              type="button"
              onClick={() => {
                const pendente = novas[0];
                if (pendente) {
                  void abrirNotificacao(pendente.tarefaId);
                } else {
                  toast("Nenhuma notificação de tarefa.", { duration: 3000 });
                }
              }}
              aria-label={
                naoLidas > 0
                  ? `${naoLidas} notificação(ões) de tarefa — abrir a mais antiga`
                  : "Nenhuma notificação de tarefa"
              }
              title={
                naoLidas > 0
                  ? `${naoLidas} tarefa(s) movida(s) para você — clique para abrir`
                  : "Sem notificações"
              }
              className="relative w-10 h-10 inline-flex items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Bell className="w-4 h-5" />
              {naoLidas > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
                  {naoLidas > 99 ? "99+" : naoLidas}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                // Com um dia escolhido no calendario, a nova tarefa ja nasce nele.
                setDataPreta(diaSelecionado);
                setDialogNova(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all"
            >
              <Plus className="w-4 h-4" /> Nova tarefa
            </button>
          </div>
        }
      />

      {/* Busca com TIPO (mesmo estilo das outras telas): titulo, descricao ou cliente. */}
      <div className="flex items-center gap-2 max-w-xl">
        <select
          aria-label="Tipo de busca"
          value={buscaEm}
          onChange={(evento) => {
            const novoCampo = evento.target.value as BuscaTarefas;
            setBuscaEm(novoCampo);
            if (timerBusca.current) window.clearTimeout(timerBusca.current);
            carregar(busca, novoCampo);
          }}
          className="h-10 w-36 shrink-0 rounded-md border border-input bg-background px-3 text-sm"
        >
          {CAMPOS_BUSCA.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder={campoBuscaPlaceholder}
            className="pl-9"
            aria-label={campoBuscaPlaceholder}
          />
        </div>
      </div>

      {/* KPIs (esquerda, 2 colunas x 2 linhas) + calendario maior no canto — so na aba Lista */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Total" value={tarefas.length} icon={BarChart3} className="p-4" />
          <KpiCard
            label="Pendentes"
            value={agrupadas.atrasadas.length + agrupadas.hoje.length + agrupadas.proximas.length}
            icon={Clock}
            tone="info"
            className="p-4"
          />
          <KpiCard label="Atrasadas" value={agrupadas.atrasadas.length} icon={AlertTriangle} tone="danger" className="p-4" />
          <KpiCard label="Concluídas" value={agrupadas.concluidas.length} icon={CheckCircle2} tone="success" className="p-4" />
        </div>

        {/* Calendario nas DUAS abas (pedido 16/10): o dia escolhido filtra o que
            aparece embaixo — a tabela na aba Lista e as colunas na aba Kanban */}
        <CalendarioTarefas
          tarefas={tarefas}
          diaSelecionado={diaSelecionado}
          onSelecionar={setDiaSelecionado}
          className="w-full max-w-[380px] mx-auto lg:mx-0"
        />
      </div>

      {/* Filtro do dia escolhido no calendario (vale para as duas abas) */}
      {diaSelecionado && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary font-medium text-foreground">
            <CalendarDays className="w-3.5 h-3.5" />
            Tarefas de {dataBr(diaSelecionado)}
            <span className="text-muted-foreground">({tarefasFiltradas.length})</span>
          </span>
          <button
            type="button"
            onClick={() => setDiaSelecionado(null)}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpar (ver todas)
          </button>
        </div>
      )}

      {carregando ? (
        <ListSkeleton rows={6} />
      ) : vista === "lista" ? (
        tarefasFiltradas.length > 0 ? (
          <TabelaTarefas
            tarefas={tarefasFiltradas}
            pagina={pagina}
            porPagina={porPagina}
            onPagina={setPagina}
            onPorPagina={(quantidade) => {
              setPorPagina(quantidade);
              setPagina(0);
            }}
            onAbrir={abrirTarefa}
            onHistorico={setTarefaHistorico}
            nomeDeResponsavel={(userId) => nomes.get(userId) || "—"}
          />
        ) : diaSelecionado ? (
          <EmptyState
            icon={CalendarDays}
            title="Nenhuma tarefa neste dia"
            description={`Nenhuma tarefa com prazo em ${dataBr(diaSelecionado)}. Escolha outro dia ou limpe o filtro.`}
          />
        ) : (
          <EmptyState
            icon={ListChecks}
            title={busca ? "Nada encontrado" : "Nenhuma tarefa ainda"}
            description={
              busca
                ? "Nenhuma tarefa corresponde à busca."
                : "Cadastre um cliente ou crie uma tarefa manual para começar."
            }
          />
        )
      ) : temAlgo ? (
        <VisaoKanban
          agrupadas={agrupadas}
          arrastandoId={arrastandoId}
          onArrastar={setArrastandoId}
          onSoltar={soltar}
          onAbrir={abrirTarefa}
        />
      ) : (
        <EmptyState
          icon={ListChecks}
          title={busca ? "Nada encontrado" : "Nenhuma tarefa ainda"}
          description={
            busca
              ? "Nenhuma tarefa corresponde à busca."
              : "Cadastre um cliente ou crie uma tarefa manual para começar."
          }
        />
      )}

      {!semMaisPaginas && (
        <p className="text-xs text-muted-foreground text-center">
          Mostrando as 200 primeiras tarefas — use a busca para refinar.
        </p>
      )}

      {/* Histórico (timeline) da tarefa numa JANELA CENTRAL GRANDE — mesma medida da
          listagem de clientes, para ler a interação inteira sem apertar (pedido 15/10) */}
      <Dialog
        open={Boolean(tarefaHistorico)}
        onOpenChange={(aberto) => {
          if (!aberto) setTarefaHistorico(null);
        }}
      >
        <DialogContent className="max-w-5xl w-[92vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico — {tarefaHistorico?.titulo}</DialogTitle>
            <DialogDescription>
              Toda a movimentação da tarefa: quem criou, quem recebeu, para quem foi, o que
              mudou, recados e anexos.
            </DialogDescription>
          </DialogHeader>
          {tarefaHistorico && <TarefaTimeline tarefaId={tarefaHistorico.id} />}
        </DialogContent>
      </Dialog>

      <DetalheTarefa
        tarefa={tarefaAberta}
        onFechar={() => setTarefaAberta(null)}
        onAtualizada={(atualizada) => {
          setTarefas((atual) => atual.map((t) => (t.id === atualizada.id ? atualizada : t)));
          setTarefaAberta(atualizada);
        }}
        onSalvar={async (tarefa, campos) => {
          try {
            const atualizada = await atualizarTarefa(tarefa.id, campos);
            setTarefas((atual) => atual.map((t) => (t.id === tarefa.id ? atualizada : t)));
            setTarefaAberta(atualizada);
            toast.success("Tarefa atualizada");
          } catch (erro) {
            toast.error(mensagemDeErro(erro));
          }
        }}
        nomeUsuario={usuario?.nome || usuario?.email || ""}
      />

      <DialogNovaTarefa
        aberto={dialogNova}
        onFechar={() => {
          setDialogNova(false);
          setDataPreta(null);
          setClientePreta(null);
        }}
        dataInicial={dataPreta}
        clienteInicial={clientePreta}
        onCriar={async (dados) => {
          try {
            const nova = await criarTarefa(dados);
            setDialogNova(false);
            if (dados.responsavelId) {
              // Nasceu encaminhada: não é "minha tarefa", então recarrega a lista.
              toast.success("Tarefa criada e encaminhada para o responsável.");
              await carregar(busca);
              return;
            }
            setTarefas((atual) => [...atual, nova].sort(
              (a, b) => a.dataVencimento.localeCompare(b.dataVencimento),
            ));
            toast.success("Tarefa criada");
          } catch (erro) {
            const campos = erro instanceof ErroApi && erro.campos.length > 0 ? erro.campos : null;
            toast.error(campos ? `${campos[0].nome}: ${campos[0].mensagem}` : mensagemDeErro(erro));
          }
        }}
      />
    </div>
  );
}

/* --------- lista: virou a tabela no padrão ADVBOX (ver TarefasLista.tsx) -------- */

/* ----------------------------------------------------------------- kanban */

function VisaoKanban({
  agrupadas, arrastandoId, onArrastar, onSoltar, onAbrir,
}: {
  agrupadas: Record<ColunaKanban, Tarefa[]>;
  arrastandoId: string | null;
  onArrastar: (id: string | null) => void;
  onSoltar: (coluna: ColunaKanban) => void;
  onAbrir: (tarefa: Tarefa) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Arraste um card para CONCLUIR (coluna Concluídas) ou reagendar (Ontem / Hoje / +7 dias) —
        só em tarefas abertas; concluída não se move mais. Clique para abrir.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUNAS_KANBAN.map((coluna) => {
          const tarefas = agrupadas[coluna.id];
          return (
            <div
              key={coluna.id}
              className="rounded-xl border bg-card/60 flex flex-col min-h-[180px]"
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={() => onSoltar(coluna.id)}
            >
              <div className="px-3 py-2.5 border-b flex items-center justify-between">
                <h3 className={`text-xs font-semibold uppercase tracking-wide ${coluna.tom}`}>
                  {coluna.rotulo}
                </h3>
                <span className="text-[10px] bg-secondary text-foreground px-1.5 py-0.5 rounded-full font-medium">
                  {tarefas.length}
                </span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {tarefas.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-6">
                    Vazio
                  </p>
                )}
                {tarefas.map((tarefa) => (
                    <div
                      key={tarefa.id}
                      draggable
                      onDragStart={() => onArrastar(tarefa.id)}
                      onDragEnd={() => onArrastar(null)}
                      onClick={() => onAbrir(tarefa)}
                      className={`rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing shadow-card hover:shadow-card-hover transition-all ${
                        arrastandoId === tarefa.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`text-[9px] px-1 py-0.5 rounded font-semibold uppercase ${
                                tarefa.concluida
                                  ? "bg-secondary text-muted-foreground"
                                  : "bg-accent/15 text-accent"
                              }`}
                            >
                              {tarefa.concluida ? "Concluída" : "Aberta"}
                            </span>
                          </div>
                          <p
                            className={`text-xs font-medium leading-snug ${
                              tarefa.concluida
                                ? "line-through text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {tarefa.titulo}
                          </p>
                          {/* Setor que enviou + contrato (o cliente tem card/coluna propria) */}
                          <p className="text-[10px] text-muted-foreground mt-1 truncate">
                            {tarefa.setorNome ? `Setor: ${tarefa.setorNome}` : "—"}
                            {tarefa.contratoNumero ? ` · Contrato nº ${tarefa.contratoNumero}` : ""}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {tarefa.prioridade && (
                              <span className={`text-[9px] px-1 py-0.5 rounded bg-secondary capitalize ${corDePrioridade(tarefa.prioridade)}`}>
                                {tarefa.prioridade}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {dataBr(tarefa.dataVencimento)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------- detalhe da tarefa: janela CENTRAL grande (igual a do Histórico) -------- */

function DetalheTarefa({
  tarefa, onFechar, onSalvar, nomeUsuario, onAtualizada,
}: {
  tarefa: Tarefa | null;
  onFechar: () => void;
  onSalvar: (
    tarefa: Tarefa,
    campos: { dataVencimento?: string; prioridade?: string; concluida?: boolean },
  ) => void;
  nomeUsuario: string;
  /** Chamado depois do encaminhar (a lista de fundo recarrega a linha). */
  onAtualizada?: (tarefa: Tarefa) => void;
}) {
  const [vencimento, setVencimento] = useState("");
  /** Select Normal/Alta/Urgente — texto antigo fora do catálogo cai em "normal". */
  const [prioridade, setPrioridade] = useState("normal");
  /** Status: aberta x concluída (o OK antigo da lista virou este campo). */
  const [concluida, setConcluida] = useState(false);
  /**
   * Última movimentação (19/10/2026): o recado da linha mais recente da trilha.
   * Sem trilha (ou sem recado nela) o campo mostra a descrição do CONTRATO — a
   * tarefa nasce do contrato, então o texto continua dizendo do que se trata.
   */
  const [ultimaMovimentacao, setUltimaMovimentacao] = useState<{
    texto: string;
    /** `movimentacao` = recado da trilha; `contrato` = descrição do contrato (fallback). */
    origem: "movimentacao" | "contrato";
  } | null>(null);
  const [carregandoMovimentacao, setCarregandoMovimentacao] = useState(false);

  useEffect(() => {
    if (!tarefa) {
      setUltimaMovimentacao(null);
      return;
    }
    let vivo = true;
    setUltimaMovimentacao(null);
    setCarregandoMovimentacao(true);

    /** Sem recado na trilha: cai na descrição do contrato da tarefa. */
    const daDescricaoDoContrato = async () => {
      if (!tarefa.contratoId) return null;
      try {
        const contrato = await buscarContrato(tarefa.contratoId);
        const texto = contrato.descricao?.trim();
        return texto ? { texto, origem: "contrato" as const } : null;
      } catch {
        return null;
      }
    };

    listarHistoricoTarefa(tarefa.id)
      .then(async (linhas) => {
        if (!vivo) return;
        // A trilha vem mais recente primeiro: o primeiro recado é o da última movimentação.
        const recado = linhas.find((linha) => linha.mensagem?.trim())?.mensagem?.trim();
        if (recado) {
          setUltimaMovimentacao({ texto: recado, origem: "movimentacao" });
        } else {
          setUltimaMovimentacao(await daDescricaoDoContrato());
        }
      })
      .catch(async () => {
        // Trilha restrita (403) ou erro de rede: mostra o que dá — a descrição do contrato.
        if (!vivo) return;
        setUltimaMovimentacao(await daDescricaoDoContrato());
      })
      .finally(() => {
        if (vivo) setCarregandoMovimentacao(false);
      });

    return () => {
      vivo = false;
    };
  }, [tarefa]);

  useEffect(() => {
    if (tarefa) {
      setVencimento(tarefa.dataVencimento);
      setPrioridade(prioridadeValida(tarefa.prioridade));
      setConcluida(tarefa.concluida);
    }
  }, [tarefa]);

  if (!tarefa) return null;

  const status = tarefa.concluida
    ? "Concluída"
    : tarefa.dataVencimento < HOJE
    ? "Atrasada"
    : tarefa.dataVencimento === HOJE
    ? "Vence hoje"
    : "Pendente";

  const mudou =
    vencimento !== tarefa.dataVencimento ||
    prioridade !== prioridadeValida(tarefa.prioridade) ||
    concluida !== tarefa.concluida;

  return (
    <Dialog open={!!tarefa} onOpenChange={(aberto) => !aberto && onFechar()}>
      {/* 1 coluna (16/10/2026): o Encaminhar ficou ABAIXO da descricao — janela estreita */}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle
                className={`text-base font-semibold leading-tight ${
                  tarefa.concluida ? "line-through text-muted-foreground" : "text-foreground"
                }`}
              >
                {tarefa.titulo}
              </DialogTitle>
              {tarefa.nomeCliente && (
                <p className="text-xs text-accent font-medium mt-1">
                  Cliente: {tarefa.nomeCliente}
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">Detalhes da tarefa</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge
                  variant={
                    tarefa.concluida
                      ? "outline"
                      : tarefa.dataVencimento < HOJE
                      ? "destructive"
                      : "secondary"
                  }
                  className="mt-1"
                >
                  {status}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Responsável</p>
                <p className="font-medium flex items-center gap-1 mt-1">
                  <User className="w-3 h-3" /> {nomeUsuario || "Você"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tarefa-status">Status</Label>
                <Select
                  value={concluida ? "concluida" : "aberta"}
                  onValueChange={(valor) => {
                    if (valor === "concluida") {
                      setConcluida(true);
                    } else if (tarefa.concluida) {
                      // Reabertura não existe: conclusão é definitiva (16/10/2026).
                      toast.error("Tarefa concluída não pode voltar para aberta — abra uma nova tarefa.");
                    } else {
                      setConcluida(false);
                    }
                  }}
                >
                  <SelectTrigger id="tarefa-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tarefa-vencimento">Vencimento</Label>
                {/* Somente leitura (16/10/2026): do detalhe só o Status muda; a data é
                    definida na criação/encaminhamento */}
                <Input
                  id="tarefa-vencimento"
                  type="date"
                  value={vencimento}
                  disabled
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tarefa-prioridade">Prioridade</Label>
                <Select value={prioridade} disabled>
                  <SelectTrigger id="tarefa-prioridade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((item) => (
                      <SelectItem key={item.valor} value={item.valor}>
                        {item.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mudou && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    onSalvar(tarefa, {
                      dataVencimento: vencimento,
                      prioridade,
                      concluida,
                    })
                  }
                >
                  <Save className="w-3.5 h-3.5" /> Salvar alterações
                </Button>
              )}
            </div>

            {tarefa.descricao && (
              <div className="bg-secondary/50 rounded-md p-3">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Descrição</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{tarefa.descricao}</p>
              </div>
            )}
          </div>

          {/* Última movimentação (19/10/2026): recado da linha mais recente da trilha;
              sem movimentação (ou trilha sem recado), mostra a descrição do contrato.
              Só leitura — mexer na movimentação é pelo Responder/Encaminhar embaixo. */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Última movimentação</p>
            <textarea
              readOnly
              aria-label="Última movimentação"
              rows={3}
              value={
                carregandoMovimentacao
                  ? "Carregando movimentação..."
                  : ultimaMovimentacao?.texto ?? ""
              }
              placeholder="Sem movimentações nem descrição de contrato para mostrar."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none"
            />
            {!carregandoMovimentacao && ultimaMovimentacao?.origem === "contrato" && (
              <p className="text-[11px] text-muted-foreground">
                Tarefa ainda sem movimentações — mostrando a descrição do contrato.
              </p>
            )}
          </div>

          {/* Encaminhar ABAIXO da descricao (16/10/2026) — só em tarefa ABERTA:
              concluída não se movimenta mais (abre-se outra tarefa) */}
          {tarefa.concluida ? (
            <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
              Tarefa <strong>concluída</strong> — ela não se movimenta mais. Para continuar o
              fluxo, abra uma nova tarefa.
            </div>
          ) : (
            <EncaminharTarefa tarefa={tarefa} onAtualizada={onAtualizada} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------- nova tarefa */

function DialogNovaTarefa({
  aberto, onFechar, onCriar, dataInicial, clienteInicial,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (dados: {
    titulo: string;
    descricao?: string;
    dataVencimento: string;
    prioridade?: string;
    nomeCliente?: string;
    /** Encaminhamento na criação: setor e pessoa que recebe (ausente = é minha). */
    setorId?: string | null;
    responsavelId?: string | null;
  }) => Promise<void>;
  /** Vencimento ja preenchido quando a tarefa nasce pelo calendario. */
  dataInicial?: string | null;
  /** Cliente ja escolhido quando a tarefa nasce pela lista de Clientes. */
  clienteInicial?: ClienteEscolhido | null;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [vencimento, setVencimento] = useState(HOJE);
  /** Prioridade é SELECT Normal/Alta/Urgente (pedido do titular 16/10/2026). */
  const [prioridade, setPrioridade] = useState("normal");
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null);
  const [salvando, setSalvando] = useState(false);
  /**
   * "É minha tarefa" vem MARCADO (o caso mais comum). Desmarcando, a tarefa nasce já
   * encaminhada: setor + usuário que recebe (pedido do titular em 16/10/2026).
   */
  const [ehMinha, setEhMinha] = useState(true);
  const [setorId, setSetorId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [setores, setSetores] = useState<Setor[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);

  // Listas do encaminhamento carregam uma vez (leitura aberta a qualquer autenticado).
  useEffect(() => {
    if (!aberto) return;
    if (setores.length === 0) {
      void listarSetores().then(setSetores).catch(() => setSetores([]));
    }
    if (membros.length === 0) {
      void listarMembros().then(setMembros).catch(() => setMembros([]));
    }
  }, [aberto, setores.length, membros.length]);

  /** Pessoas do setor escolhido; sem setor ainda, mostra todos. */
  const membrosDoSetor = useMemo(
    () => (setorId ? membros.filter((membro) => membro.setores?.some((setor) => setor.id === setorId)) : membros),
    [membros, setorId],
  );

  // o dialog fica montado: ao abrir, volta vencimento e cliente para o que veio do
  // calendario ou da lista de Clientes (ou limpa)
  useEffect(() => {
    if (aberto) {
      setVencimento(dataInicial ?? HOJE);
      setCliente(clienteInicial ?? null);
      setEhMinha(true);
      setSetorId("");
      setResponsavelId("");
    }
  }, [aberto, dataInicial, clienteInicial]);

  const limpar = () => {
    setTitulo("");
    setDescricao("");
    setVencimento(HOJE);
    setPrioridade("normal");
    setCliente(null);
    setEhMinha(true);
    setSetorId("");
    setResponsavelId("");
  };

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!titulo.trim()) {
      toast.error("Informe o título da tarefa");
      return;
    }
    if (!ehMinha && !setorId) {
      toast.error("Escolha o setor que vai receber a tarefa");
      return;
    }
    if (!ehMinha && !responsavelId) {
      toast.error("Escolha o usuário que vai receber a tarefa");
      return;
    }
    setSalvando(true);
    try {
      await onCriar({
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        dataVencimento: vencimento,
        prioridade,
        nomeCliente: cliente?.nome.trim() || undefined,
        setorId: ehMinha ? undefined : setorId,
        responsavelId: ehMinha ? undefined : responsavelId,
      });
      limpar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(novo) => {
        if (!novo) {
          limpar();
          onFechar();
        }
      }}
    >
      {/* Mesma medida do form de Usuários (max-w-2xl + scroll) — cabe em 1366x768 */}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>
            Por padrão a tarefa fica com você. Desmarque "É minha tarefa" para criar e já
            encaminhar para o setor e a pessoa que vão receber.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nova-titulo">Título *</Label>
            <Input
              id="nova-titulo"
              value={titulo}
              onChange={(evento) => setTitulo(evento.target.value)}
              placeholder="Ex.: ONBOARDING — João da Silva"
              maxLength={300}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nova-descricao">Descrição</Label>
            <Textarea
              id="nova-descricao"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              rows={3}
              maxLength={4000}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nova-vencimento">Vencimento *</Label>
              <Input
                id="nova-vencimento"
                type="date"
                value={vencimento}
                onChange={(evento) => setVencimento(evento.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nova-prioridade">Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger id="nova-prioridade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((item) => (
                    <SelectItem key={item.valor} value={item.valor}>
                      {item.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nova-cliente">Cliente (opcional)</Label>
            {/* key muda ao abrir: o component renasce e aplica o prefill recebido */}
            <ClienteBusca
              key={aberto ? `ab-${clienteInicial?.id ?? clienteInicial?.nome ?? "novo"}` : "fechado"}
              id="nova-cliente"
              inicial={clienteInicial}
              onChange={setCliente}
            />
          </div>

          {/* É minha (padrão) x encaminhar na criação: setor + pessoa que recebe */}
          <div className="space-y-3 rounded-xl border border-border bg-card p-3">
            <label
              htmlFor="nova-eh-minha"
              className="flex items-center gap-2 text-sm font-medium cursor-pointer"
            >
              <Checkbox
                id="nova-eh-minha"
                checked={ehMinha}
                onCheckedChange={(valor) => {
                  const minha = valor === true;
                  setEhMinha(minha);
                  if (minha) {
                    setSetorId("");
                    setResponsavelId("");
                  }
                }}
              />
              É minha tarefa (fica com você)
            </label>

            {!ehMinha && (
              <p className="text-[11px] text-muted-foreground">
                A tarefa nasce já encaminhada: escolha o setor e a pessoa que vai receber.
              </p>
            )}

            {!ehMinha && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nova-setor">Setor que recebe *</Label>
                  <Select
                    value={setorId}
                    onValueChange={(valor) => {
                      setSetorId(valor);
                      setResponsavelId("");
                    }}
                  >
                    <SelectTrigger id="nova-setor">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {setores.map((setor) => (
                        <SelectItem key={setor.id} value={setor.id}>
                          {setor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nova-destinatario">Usuário que recebe *</Label>
                  <Select
                    value={responsavelId}
                    onValueChange={setResponsavelId}
                    disabled={!setorId}
                  >
                    <SelectTrigger id="nova-destinatario">
                      <SelectValue placeholder="Selecione a pessoa" />
                    </SelectTrigger>
                    <SelectContent>
                      {membrosDoSetor.map((membro) => (
                        <SelectItem key={membro.userId} value={membro.userId}>
                          {membro.nome || membro.email || membro.userId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {setorId && membrosDoSetor.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Nenhum usuário vinculado a este setor — cadastre em Usuários.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              Criar tarefa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
