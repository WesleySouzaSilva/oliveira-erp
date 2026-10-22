import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle, BarChart3, Bell, CheckCircle2, Clock, Kanban, LayoutList,
  ListChecks, Paperclip, Plus, Save, Search, User, X,
} from "lucide-react";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CaixaAnexo } from "@/components/ui/CaixaAnexo";
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
  anexarArquivosTarefa, atualizarTarefa, baixarAnexoTarefa, criarTarefa,
  listarArquivosTarefa, listarHistoricoTarefa, listarTarefas, listarTiposTarefa,
  prazoDaTarefa, RECORRENCIAS_TAREFA as RECORRENCIAS,
  type BuscaTarefas, type Tarefa, type TarefaAnexo, type TarefaNova, type TarefaTipo,
} from "@/lib/api/tarefas";
import { buscarContrato } from "@/lib/api/contratos";
import { TabelaTarefas } from "@/pages/erp/TarefasLista";
import { corDePrioridade } from "@/lib/prioridade";
import { formatarTamanho } from "@/lib/formatarTamanho";
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

/**
 * Rótulo da recorrência no detalhe — sem valor gravado a API vale `unica`
 * (o catálogo `RECORRENCIAS_TAREFA` vem da lib, junto do contrato da API).
 */
const recorrenciaRotulo = (valor?: string | null) =>
  RECORRENCIAS.find((item) => item.valor === valor)?.rotulo ?? "Única";

/**
 * Id do processo no form: a API aceita só UUID (a tabela `processos` entra com o módulo
 * processo — número CNJ fica para lá, `V5__tarefa.sql`).
 */
const EH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cards de resumo do topo: cada um vira filtro da lista (1 por vez) — clicar no card
 * selecionado limpa e volta ao total, como o chip do calendário.
 */
type CardFiltro = "total" | "pendentes" | "atrasadas" | "concluidas";

const ROTULOS_CARD: Record<CardFiltro, string> = {
  total: "Total",
  pendentes: "Pendentes",
  atrasadas: "Atrasadas",
  concluidas: "Concluídas",
};

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
  // Regra única de atraso (D6): prazo fatal, ou vencimento quando não há — mesma medida
  // da tabela e do calendário, para o kanban não divergir do resto da tela.
  const prazo = prazoDaTarefa(t);
  if (prazo < HOJE) return "atrasadas";
  if (prazo === HOJE) return "hoje";
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
  /** Card de resumo clicado (topo): filtra a lista — 1 por vez; null = total. */
  const [cardFiltro, setCardFiltro] = useState<CardFiltro | null>(null);

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
    if (prazoDaTarefa(tarefa) === novaData && !tarefa.concluida) return;
    // Regra única de atraso (D6): o kanban agrupa por prazoDaTarefa — junto o prazo fatal
    // ao reagendar, senão o card não sai da coluna de quem já tem prazo marcado.
    setTarefas((atual) =>
      atual.map((t) =>
        t.id === tarefa.id
          ? {
              ...t,
              dataVencimento: novaData,
              ...(t.prazoFatal ? { prazoFatal: novaData } : {}),
            }
          : t,
      ),
    );
    try {
      await atualizarTarefa(tarefa.id, {
        dataVencimento: novaData,
        ...(tarefa.prazoFatal ? { prazoFatal: novaData } : {}),
      });
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
  const tarefasDoDia = useMemo(
    () =>
      diaSelecionado
        ? tarefas.filter((tarefa) => prazoDaTarefa(tarefa) === diaSelecionado)
        : tarefas,
    [tarefas, diaSelecionado],
  );

  /**
   * Card clicado por cima do dia (filtros compostos — card E dia valem juntos; 1 card
   * por vez): `total` (ou card nenhum) deixa a lista do dia passar inteira.
   */
  const tarefasFiltradas = useMemo(() => {
    if (!cardFiltro || cardFiltro === "total") return tarefasDoDia;
    if (cardFiltro === "pendentes") return tarefasDoDia.filter((t) => !t.concluida);
    if (cardFiltro === "atrasadas") {
      return tarefasDoDia.filter((t) => !t.concluida && prazoDaTarefa(t) < hoje0);
    }
    return tarefasDoDia.filter((t) => t.concluida);
  }, [tarefasDoDia, cardFiltro, hoje0]);

  /**
   * Contagens dos quatro cards SEM o recorte do card (só o dia): os numeros ficam
   * estáveis com o filtro ativo — clicar mostra o resultado, não some com o card.
   */
  const contagens = useMemo(
    () => ({
      total: tarefasDoDia.length,
      pendentes: tarefasDoDia.filter((t) => !t.concluida).length,
      atrasadas: tarefasDoDia.filter((t) => !t.concluida && prazoDaTarefa(t) < hoje0).length,
      concluidas: tarefasDoDia.filter((t) => t.concluida).length,
    }),
    [tarefasDoDia, hoje0],
  );

  /** Card vira filtro: clicar no que já está selecionado limpa e volta ao total. */
  const alternarCardFiltro = useCallback((valor: CardFiltro) => {
    setCardFiltro((atual) => (atual === valor ? null : valor));
  }, []);

  const campoBuscaPlaceholder =
    CAMPOS_BUSCA.find((opcao) => opcao.valor === buscaEm)?.placeholder ?? CAMPOS_BUSCA[0].placeholder;

  const agrupadas = useMemo(() => {
    const pendentes = tarefasFiltradas.filter((t) => !t.concluida);
    return {
      atrasadas: pendentes.filter((t) => prazoDaTarefa(t) < hoje0),
      hoje: pendentes.filter((t) => prazoDaTarefa(t) === hoje0),
      proximas: pendentes.filter((t) => prazoDaTarefa(t) > hoje0),
      concluidas: tarefasFiltradas.filter((t) => t.concluida),
    };
  }, [tarefasFiltradas, hoje0]);

  // Trocar o dia ou o card zera a pagina da tabela.
  useEffect(() => setPagina(0), [diaSelecionado, cardFiltro]);

  /** Filtro que encurta a lista de verdade — o card `total` conta como nada filtrado. */
  const temFiltroAtivo = Boolean(diaSelecionado) || (cardFiltro !== null && cardFiltro !== "total");

  /**
   * Props dos cards-filtro: o selecionado ganha borda accent + `aria-pressed` (1 por
   * vez); o KpiCard repassa o resto para a `div` dele (kpi-card.tsx).
   */
  const cardFiltroProps = (valor: CardFiltro) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": cardFiltro === valor,
    onClick: () => alternarCardFiltro(valor),
    onKeyDown: (evento: React.KeyboardEvent<HTMLDivElement>) => {
      if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        alternarCardFiltro(valor);
      }
    },
    className: `p-4 cursor-pointer ${
      cardFiltro === valor ? "border-accent ring-1 ring-accent/40 shadow-card-hover" : ""
    }`,
  });

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

      {/* Cards de resumo VIRAM FILTRO (22/10/2026): 1 por vez, clicar de novo limpa —
          os quatro contam o dia do calendario, e o card clicado recorta a lista embaixo */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Total" value={contagens.total} icon={BarChart3} {...cardFiltroProps("total")} />
          <KpiCard
            label="Pendentes"
            value={contagens.pendentes}
            icon={Clock}
            tone="info"
            {...cardFiltroProps("pendentes")}
          />
          <KpiCard
            label="Atrasadas"
            value={contagens.atrasadas}
            icon={AlertTriangle}
            tone="danger"
            {...cardFiltroProps("atrasadas")}
          />
          <KpiCard
            label="Concluídas"
            value={contagens.concluidas}
            icon={CheckCircle2}
            tone="success"
            {...cardFiltroProps("concluidas")}
          />
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

      {/* Filtros ativos (vale para as duas abas): card do topo e/ou dia do calendario */}
      {(diaSelecionado || cardFiltro) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {cardFiltro && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary font-medium text-foreground">
              <BarChart3 className="w-3.5 h-3.5" />
              {ROTULOS_CARD[cardFiltro]}
              <span className="text-muted-foreground">({contagens[cardFiltro]})</span>
              <button
                type="button"
                aria-label={`Limpar filtro ${ROTULOS_CARD[cardFiltro]}`}
                onClick={() => setCardFiltro(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          {diaSelecionado && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary font-medium text-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              Tarefas de {dataBr(diaSelecionado)}
              <span className="text-muted-foreground">({tarefasDoDia.length})</span>
            </span>
          )}
          {diaSelecionado && (
            <button
              type="button"
              onClick={() => setDiaSelecionado(null)}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Limpar (ver todas)
            </button>
          )}
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
        ) : temFiltroAtivo ? (
          <EmptyState
            icon={ListChecks}
            title="Nenhum resultado no filtro atual"
            description="Nenhuma tarefa bate com os filtros escolhidos — clique de novo no card ou limpe o dia do calendário."
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
          {tarefaHistorico && (
            <TarefaTimeline
              tarefaId={tarefaHistorico.id}
              // A tarefa completa já vem da lista: o contratoId liga a linha "criada" aos
              // anexos do contrato (correção 2) — sem ele o primeiro item fica sem arquivo.
              contratoId={tarefaHistorico.contratoId}
            />
          )}
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
          // A fila de anexos não vai no JSON da criação: sobe depois, no endpoint
          // multipart de tarefa já existente (correção 5, Fase 4 do plano).
          const { anexos, ...tarefa } = dados;
          try {
            const nova = await criarTarefa(tarefa);
            setDialogNova(false);
            if (dados.responsavelId) {
              // Nasceu encaminhada: não é "minha tarefa", então recarrega a lista.
              toast.success("Tarefa criada e encaminhada para o responsável.");
              await carregar(busca);
            } else {
              setTarefas((atual) => [...atual, nova].sort(
                (a, b) => a.dataVencimento.localeCompare(b.dataVencimento),
              ));
              toast.success("Tarefa criada");
            }
            if (anexos?.length) {
              try {
                await anexarArquivosTarefa(nova.id, anexos);
              } catch (erroAnexo) {
                // A tarefa JÁ existe: não desfaz — só explica (dá pra anexar no detalhe).
                toast.error(
                  `Tarefa criada, mas os anexos não puderam ser anexados: ${mensagemDeErro(erroAnexo)}`,
                );
              }
            }
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
                            <span
                              className="text-[10px] text-muted-foreground"
                              title={
                                tarefa.prazoFatal
                                  ? `Vencimento em ${dataBr(tarefa.dataVencimento)}`
                                  : undefined
                              }
                            >
                              {/* Mesma medida das colunas (regra única de atraso, D6) */}
                              {dataBr(prazoDaTarefa(tarefa))}
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
    campos: {
      dataVencimento?: string;
      prazoFatal?: string;
      prioridade?: string;
      concluida?: boolean;
    },
  ) => void;
  nomeUsuario: string;
  /** Chamado depois do encaminhar (a lista de fundo recarrega a linha). */
  onAtualizada?: (tarefa: Tarefa) => void;
}) {
  const [vencimento, setVencimento] = useState("");
  /**
   * Prazo fatal editável (V21, pedido 22/10/2026): o PATCH já grava — o vencimento
   * continua somente leitura (decisão 16/10). Campo em branco é OMITIDO do PATCH,
   * porque a API trata nulo como "não muda" (remoção entra numa próxima etapa).
   */
  const [prazoFatal, setPrazoFatal] = useState("");
  /** Select Normal/Alta/Urgente — texto antigo fora do catálogo cai em "normal". */
  const [prioridade, setPrioridade] = useState("normal");
  /** Status: aberta x concluída (o OK antigo da lista virou este campo). */
  const [concluida, setConcluida] = useState(false);
  /** Anexos da tarefa (V21): lista ao abrir o detalhe e após cada envio. */
  const [anexos, setAnexos] = useState<TarefaAnexo[]>([]);
  const [carregandoAnexos, setCarregandoAnexos] = useState(false);
  /** Sem permissão (gate da API) ou rede: aviso local em vez de toast no detalhe. */
  const [erroAnexos, setErroAnexos] = useState(false);
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
      setPrazoFatal(tarefa.prazoFatal ?? "");
      setPrioridade(prioridadeValida(tarefa.prioridade));
      setConcluida(tarefa.concluida);
    }
  }, [tarefa]);

  // Anexos da tarefa (V21): 1 busca por abertura do detalhe; falha (gate da API ou
  // rede) vira aviso local — o resto do detalhe continua útil.
  useEffect(() => {
    if (!tarefa) {
      setAnexos([]);
      setErroAnexos(false);
      return;
    }
    let vivo = true;
    setCarregandoAnexos(true);
    setErroAnexos(false);
    listarArquivosTarefa(tarefa.id)
      .then((lista) => {
        if (vivo) setAnexos(lista);
      })
      .catch(() => {
        if (vivo) {
          setAnexos([]);
          setErroAnexos(true);
        }
      })
      .finally(() => {
        if (vivo) setCarregandoAnexos(false);
      });
    return () => {
      vivo = false;
    };
  }, [tarefa]);

  /** Enviar anexos novos: a API devolve a lista atualizada (pendurada na linha `criada`). */
  const anexar = async (lista: File[]) => {
    if (!tarefa || lista.length === 0) return;
    try {
      setAnexos(await anexarArquivosTarefa(tarefa.id, lista));
      toast.success(lista.length === 1 ? "Anexo enviado." : `${lista.length} anexos enviados.`);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  if (!tarefa) return null;

  // Regra única de atraso (D6): prazo fatal ?? vencimento — igual à tabela e ao kanban.
  const prazo = prazoDaTarefa(tarefa);
  const status = tarefa.concluida
    ? "Concluída"
    : prazo < HOJE
    ? "Atrasada"
    : prazo === HOJE
    ? "Vence hoje"
    : "Pendente";

  const mudou =
    vencimento !== tarefa.dataVencimento ||
    prazoFatal !== (tarefa.prazoFatal ?? "") ||
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
                      : prazo < HOJE
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

            {/* V21 (22/10/2026): tipo e recorrência são novos na tarefa — o cliente já
                aparece no cabeçalho, ao lado do nome. Só leitura por ora: mexer nesses
                campos é etapa seguinte (o prazo fatal logo abaixo já tem PATCH). */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-medium mt-1">{tarefa.tipoNome ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Recorrência</p>
                <p className="font-medium mt-1">{recorrenciaRotulo(tarefa.recorrencia)}</p>
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
                <Label htmlFor="tarefa-prazo-fatal">Prazo fatal</Label>
                {/* Editável (V21): o PATCH grava a troca; vazio é omitido (a API trata
                    nulo como "não muda") — ver o aviso embaixo quando já existe prazo. */}
                <Input
                  id="tarefa-prazo-fatal"
                  type="date"
                  value={prazoFatal}
                  onChange={(evento) => setPrazoFatal(evento.target.value)}
                />
                {tarefa.prazoFatal && (
                  <p className="text-[11px] text-muted-foreground">
                    Deixar em branco mantém o prazo atual — removê-lo ainda não é aceito pela API.
                  </p>
                )}
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
                      // Vazio = omitido no PATCH (a API trata nulo como "não muda").
                      prazoFatal: prazoFatal || undefined,
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

          {/* Anexos da tarefa (V21, 22/10/2026): a lista vem de GET /tarefas/{id}/arquivos
              ao abrir o detalhe; subir arquivo novo usa o multipart do mesmo caminho —
              pendurado na linha `criada`, com o gate (responsável/admin/ceo) na API. */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Anexos</p>
            {carregandoAnexos ? (
              <p className="text-xs text-muted-foreground">Carregando anexos...</p>
            ) : erroAnexos ? (
              <p className="text-xs text-muted-foreground">
                Não foi possível carregar os anexos (sem permissão ou sem conexão).
              </p>
            ) : anexos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem anexos.</p>
            ) : (
              <ul className="space-y-1">
                {anexos.map((anexo) => (
                  <li key={anexo.id}>
                    <button
                      type="button"
                      onClick={() =>
                        baixarAnexoTarefa(anexo.id, anexo.nomeOriginal).catch((erro) =>
                          toast.error(mensagemDeErro(erro)),
                        )
                      }
                      className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
                    >
                      <Paperclip className="w-3 h-3" />
                      {anexo.nomeOriginal}
                      {anexo.tamanhoBytes ? ` (${formatarTamanho(anexo.tamanhoBytes)})` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {tarefa.concluida ? (
              <p className="text-[11px] text-muted-foreground">
                Tarefa concluída não aceita novos anexos — a API responde 400.
              </p>
            ) : (
              <>
                {/* Anexar por clique OU arrastar (OE-13); o envio continua no anexar(). */}
                <CaixaAnexo
                  arquivos={[]}
                  onAdicionar={(novos) => void anexar(novos)}
                  rotulo={
                    <p className="text-xs font-medium text-foreground">
                      Arraste os arquivos aqui ou clique para anexar
                    </p>
                  }
                />
              </>
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
  /** O form monta a tarefa; a fila de anexos sobe no pai, depois da criação. */
  onCriar: (dados: TarefaNova & { anexos?: File[] }) => Promise<void>;
  /** Vencimento ja preenchido quando a tarefa nasce pelo calendario. */
  dataInicial?: string | null;
  /** Cliente ja escolhido quando a tarefa nasce pela lista de Clientes. */
  clienteInicial?: ClienteEscolhido | null;
}) {
  /**
   * Tipo escolhido (obrigatório, pedido do titular 22/10): o NOME do tipo vira o
   * TÍTULO gravado da tarefa — por isso o campo de título digitável saiu do form.
   */
  const [tipoId, setTipoId] = useState("");
  const [tipos, setTipos] = useState<TarefaTipo[]>([]);
  const [carregandoTipos, setCarregandoTipos] = useState(true);
  /** Processo (opcional): por ora um UUID digitado — a lista vem do cliente no futuro. */
  const [processo, setProcesso] = useState("");
  const [descricao, setDescricao] = useState("");
  const [vencimento, setVencimento] = useState(HOJE);
  /** Data fatal (opcional, V21): o último prazo do designado. */
  const [prazoFatal, setPrazoFatal] = useState("");
  /** Recorrência (V21): Única (padrão), Diária, Semanal ou Mensal. */
  const [recorrencia, setRecorrencia] = useState("unica");
  /** Fila de anexos: escolhidos aqui, subam depois que a tarefa existir (multipart). */
  const [arquivos, setArquivos] = useState<File[]>([]);
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

  // Tipos do seletor: buscados A CADA abertura (cadastro feito em outra aba aparece na
  // hora); leitura aberta a qualquer autenticado, igual às listas de baixo.
  useEffect(() => {
    if (!aberto) return;
    setCarregandoTipos(true);
    listarTiposTarefa()
      .then((lista) => setTipos(lista.filter((tipo) => tipo.ativo)))
      .catch(() => setTipos([]))
      .finally(() => setCarregandoTipos(false));
  }, [aberto]);

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
      // Campos novos do pedido 22/10: renascem limpos a cada abertura — o Cancelar
      // fecha sem passar pelo limpar do onOpenChange.
      setTipoId("");
      setProcesso("");
      setPrazoFatal("");
      setRecorrencia("unica");
      setArquivos([]);
    }
  }, [aberto, dataInicial, clienteInicial]);

  const limpar = () => {
    setTipoId("");
    setProcesso("");
    setDescricao("");
    setVencimento(HOJE);
    setPrazoFatal("");
    setRecorrencia("unica");
    setArquivos([]);
    setPrioridade("normal");
    setCliente(null);
    setEhMinha(true);
    setSetorId("");
    setResponsavelId("");
  };

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const tipoEscolhido = tipos.find((tipo) => tipo.id === tipoId);
    if (!tipoEscolhido) {
      toast.error(
        tipos.length === 0
          ? "Nenhum tipo cadastrado — cadastre em Cadastro > Tipos de tarefa."
          : "Escolha o tipo da tarefa",
      );
      return;
    }
    if (!vencimento) {
      toast.error("Informe a data de vencimento");
      return;
    }
    const processoLimpo = processo.trim();
    if (processoLimpo && !EH_UUID.test(processoLimpo)) {
      toast.error(
        "Processo: informe o identificador (UUID) — em breve os processos vêm do cliente.",
      );
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
        // O título do DTO continua obrigatório na API: mando o nome do tipo, que é o
        // que a API grava de verdade quando `tipoId` vem preenchido.
        titulo: tipoEscolhido.nome,
        tipoId: tipoEscolhido.id,
        descricao: descricao.trim() || undefined,
        dataVencimento: vencimento,
        prazoFatal: prazoFatal || undefined,
        recorrencia,
        processoId: processoLimpo || undefined,
        clienteId: cliente?.id || undefined,
        nomeCliente: cliente?.nome.trim() || undefined,
        prioridade,
        setorId: ehMinha ? undefined : setorId,
        responsavelId: ehMinha ? undefined : responsavelId,
        anexos: arquivos.length > 0 ? arquivos : undefined,
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
            O título da tarefa é o nome do TIPO escolhido. Por padrão ela fica com você —
            desmarque "É minha tarefa" para criar e já encaminhar para o setor e a pessoa
            que vão receber.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4">
          {/* 1º CLIENTE (pedido do titular 22/10): o id vai para a API — sem ele não há
              como buscar os processos do cliente no futuro (D1 do plano). */}
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

          {/* 2º PROCESSO (opcional): hoje é um UUID digitado; a lista filtrada pelo
              cliente escolhido entra com o módulo de processos (V5/V7 adiaram a tabela). */}
          <div className="space-y-1.5">
            <Label htmlFor="nova-processo">Processo (opcional)</Label>
            <Input
              id="nova-processo"
              value={processo}
              onChange={(evento) => setProcesso(evento.target.value)}
              placeholder="Identificador (UUID) do processo — em breve vem do cliente"
              maxLength={64}
            />
          </div>

          {/* 3º TIPO (obrigatório): o nome do tipo vira o TÍTULO gravado da API —
              por isso o campo de título digitável saiu do form (pedido do titular). */}
          <div className="space-y-1.5">
            <Label htmlFor="nova-tipo">Tipo de tarefa *</Label>
            <Select value={tipoId} onValueChange={setTipoId}>
              <SelectTrigger id="nova-tipo">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((tipo) => (
                  <SelectItem key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!carregandoTipos && tipos.length === 0 && (
              <p className="text-[11px] text-warning">
                Nenhum tipo cadastrado — cadastre em Cadastro &gt; Tipos de tarefa.
              </p>
            )}
          </div>

          {/* 4º DATAS: vencimento obrigatório (como sempre) + data fatal (V21, novo) */}
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
              <Label htmlFor="nova-prazo-fatal">Data fatal (opcional)</Label>
              <Input
                id="nova-prazo-fatal"
                type="date"
                value={prazoFatal}
                onChange={(evento) => setPrazoFatal(evento.target.value)}
              />
            </div>
          </div>

          {/* 5º RECORRÊNCIA (V21): gravar agora; gerar as instâncias futuras é etapa
              posterior (D3 do plano). */}
          <div className="space-y-1.5">
            <Label htmlFor="nova-recorrencia">Recorrência</Label>
            <Select value={recorrencia} onValueChange={setRecorrencia}>
              <SelectTrigger id="nova-recorrencia">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORRENCIAS.map((item) => (
                  <SelectItem key={item.valor} value={item.valor}>
                    {item.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 6º ANEXOS: fila escolhida aqui, sobe DEPOIS da criação (a criação é JSON
              puro; o multipart é o /tarefas/{id}/arquivos) — ver o onCriar do pai. */}
          <div className="space-y-1.5">
            <Label htmlFor="nova-anexos">Anexos (opcional)</Label>
            <CaixaAnexo
              id="nova-anexos"
              arquivos={arquivos}
              onAdicionar={(novos) => setArquivos((atual) => [...atual, ...novos])}
              onRemover={(indice) =>
                setArquivos((atual) => atual.filter((_, posicao) => posicao !== indice))
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Os arquivos sobem depois que a tarefa for criada — se falhar, o aviso explica
              (a tarefa já estará gravada).
            </p>
          </div>

          {/* 7º DESCRIÇÃO */}
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

          {/* 8º PRIORIDADE */}
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
