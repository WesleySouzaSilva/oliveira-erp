import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle, BarChart3, CheckCircle2, Circle, Clock, Kanban, LayoutList,
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
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ErroApi, mensagemDeErro, usuarioApi } from "@/lib/api/http";
import {
  atualizarTarefa, criarTarefa, listarTarefas, prazoDaTarefa, type Tarefa,
} from "@/lib/api/tarefas";
import { TabelaTarefas } from "@/pages/erp/TarefasLista";
import { CalendarioTarefas } from "@/pages/erp/TarefasCalendario";
import { mapaDeNomes } from "@/lib/api/membros";
import { ClienteBusca, type ClienteEscolhido } from "@/components/erp/ClienteBusca";

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

export default function TarefasApi() {
  const usuario = usuarioApi();
  const location = useLocation();
  const navigate = useNavigate();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [vista, setVista] = useState<Vista>("lista");
  const [semMaisPaginas, setSemMaisPaginas] = useState(true);
  /** Dia clicado no calendario: filtra a tabela da aba Lista (null = todas). */
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const [dialogNova, setDialogNova] = useState(false);
  const [tarefaAberta, setTarefaAberta] = useState<Tarefa | null>(null);
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

  useEffect(() => {
    let vivo = true;
    mapaDeNomes().then((mapa) => {
      if (vivo) setNomes(mapa);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const carregar = useCallback(async (texto: string) => {
    setCarregando(true);
    try {
      const resultado = await listarTarefas({
        minhas: true,
        busca: texto.trim() || undefined,
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

  const alternarConcluida = useCallback(async (tarefa: Tarefa, concluida: boolean) => {
    // Otimista: a tela responde na hora; se a API negar, volta ao estado anterior.
    setTarefas((atual) =>
      atual.map((t) => (t.id === tarefa.id ? { ...t, concluida } : t)),
    );
    setTarefaAberta((atual) =>
      atual?.id === tarefa.id ? { ...atual, concluida } : atual,
    );
    try {
      await atualizarTarefa(tarefa.id, { concluida });
      toast.success(concluida ? "Tarefa concluída" : "Tarefa reaberta");
    } catch (erro) {
      setTarefas((atual) =>
        atual.map((t) => (t.id === tarefa.id ? { ...t, concluida: tarefa.concluida } : t)),
      );
      toast.error(mensagemDeErro(erro));
    }
  }, []);

  /**
   * Marcadores clicaveis da lista (Advbox): importante, urgente e lido — cada um e um
   * PATCH proprio, otimista (a tela troca na hora e volta se a API negar).
   */
  const marcar = useCallback(async (tarefa: Tarefa, campo: "importante" | "urgente" | "lido", valor: boolean) => {
    setTarefas((atual) =>
      atual.map((t) => {
        if (t.id !== tarefa.id) return t;
        if (campo === "urgente") return { ...t, prioridade: valor ? "urgente" : "normal" };
        if (campo === "importante") return { ...t, importante: valor };
        return { ...t, lido: valor };
      }),
    );
    try {
      if (campo === "urgente") {
        await atualizarTarefa(tarefa.id, { prioridade: valor ? "urgente" : "normal" });
      } else if (campo === "importante") {
        await atualizarTarefa(tarefa.id, { importante: valor });
      } else {
        await atualizarTarefa(tarefa.id, { lido: valor });
      }
    } catch (erro) {
      setTarefas((atual) => atual.map((t) => (t.id === tarefa.id ? tarefa : t)));
      toast.error(mensagemDeErro(erro));
    }
  }, []);

  const reagendar = useCallback(async (tarefa: Tarefa, coluna: ColunaKanban) => {
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
      if (coluna === "concluidas") {
        alternarConcluida(tarefa, true);
      } else {
        if (tarefa.concluida) alternarConcluida(tarefa, false);
        reagendar(tarefa, coluna);
      }
    },
    [alternarConcluida, arrastandoId, reagendar, tarefas],
  );

  const hoje0 = HOJE;
  const agrupadas = useMemo(() => {
    const pendentes = tarefas.filter((t) => !t.concluida);
    return {
      atrasadas: pendentes.filter((t) => t.dataVencimento < hoje0),
      hoje: pendentes.filter((t) => t.dataVencimento === hoje0),
      proximas: pendentes.filter((t) => t.dataVencimento > hoje0),
      concluidas: tarefas.filter((t) => t.concluida),
    };
  }, [tarefas, hoje0]);

  /**
   * Recorte da tabela pelo dia escolhido no calendario — mesma regra de data do badge
   * (prazo fatal, ou vencimento quando nao ha prazo), para o numero do dia e as linhas
   * de baixo sempre baterem.
   */
  const tarefasDaLista = useMemo(
    () =>
      diaSelecionado
        ? tarefas.filter((tarefa) => prazoDaTarefa(tarefa) === diaSelecionado)
        : tarefas,
    [tarefas, diaSelecionado],
  );

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

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar por título ou cliente..."
          className="pl-9"
          aria-label="Buscar tarefas"
        />
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

        {vista === "lista" && (
          <CalendarioTarefas
            tarefas={tarefas}
            diaSelecionado={diaSelecionado}
            onSelecionar={setDiaSelecionado}
            className="w-full max-w-[380px] mx-auto lg:mx-0"
          />
        )}
      </div>

      {/* Filtro do dia escolhido no calendario */}
      {vista === "lista" && diaSelecionado && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary font-medium text-foreground">
            <CalendarDays className="w-3.5 h-3.5" />
            Tarefas de {dataBr(diaSelecionado)}
            <span className="text-muted-foreground">({tarefasDaLista.length})</span>
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
        tarefasDaLista.length > 0 ? (
          <TabelaTarefas
            tarefas={tarefasDaLista}
            pagina={pagina}
            porPagina={porPagina}
            onPagina={setPagina}
            onPorPagina={(quantidade) => {
              setPorPagina(quantidade);
              setPagina(0);
            }}
            onAbrir={setTarefaAberta}
            onAlternar={alternarConcluida}
            onMarcar={marcar}
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
          onAbrir={setTarefaAberta}
          onAlternar={alternarConcluida}
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

      <DrawerTarefa
        tarefa={tarefaAberta}
        onFechar={() => setTarefaAberta(null)}
        onAlternar={alternarConcluida}
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
            setTarefas((atual) => [...atual, nova].sort(
              (a, b) => a.dataVencimento.localeCompare(b.dataVencimento),
            ));
            setDialogNova(false);
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
  agrupadas, arrastandoId, onArrastar, onSoltar, onAbrir, onAlternar,
}: {
  agrupadas: Record<ColunaKanban, Tarefa[]>;
  arrastandoId: string | null;
  onArrastar: (id: string | null) => void;
  onSoltar: (coluna: ColunaKanban) => void;
  onAbrir: (tarefa: Tarefa) => void;
  onAlternar: (tarefa: Tarefa, concluida: boolean) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Arraste um card para concluir ou reagendar (Ontem / Hoje / +7 dias). Clique para abrir.
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
                {tarefas.map((tarefa) => {
                  const urgente = tarefa.prioridade === "urgente" && !tarefa.concluida;
                  return (
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
                        <button
                          onClick={(evento) => {
                            evento.stopPropagation();
                            onAlternar(tarefa, !tarefa.concluida);
                          }}
                          className="mt-0.5 shrink-0"
                          aria-label={tarefa.concluida ? "Reabrir tarefa" : "Concluir tarefa"}
                        >
                          {tarefa.concluida ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-muted-foreground hover:text-accent" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-medium leading-snug ${
                              tarefa.concluida
                                ? "line-through text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {tarefa.titulo}
                          </p>
                          {tarefa.nomeCliente && (
                            <p className="text-[10px] text-accent font-medium mt-1 truncate">
                              {tarefa.nomeCliente}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {urgente && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-destructive/15 text-destructive font-bold uppercase">
                                Urgente
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {dataBr(tarefa.dataVencimento)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- drawer */

function DrawerTarefa({
  tarefa, onFechar, onAlternar, onSalvar, nomeUsuario,
}: {
  tarefa: Tarefa | null;
  onFechar: () => void;
  onAlternar: (tarefa: Tarefa, concluida: boolean) => void;
  onSalvar: (tarefa: Tarefa, campos: { dataVencimento?: string; prioridade?: string }) => void;
  nomeUsuario: string;
}) {
  const [vencimento, setVencimento] = useState("");
  const [prioridade, setPrioridade] = useState("normal");

  useEffect(() => {
    if (tarefa) {
      setVencimento(tarefa.dataVencimento);
      setPrioridade(tarefa.prioridade);
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
    vencimento !== tarefa.dataVencimento || prioridade !== tarefa.prioridade;

  return (
    <Sheet open={!!tarefa} onOpenChange={(aberto) => !aberto && onFechar()}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <button
              onClick={() => onAlternar(tarefa, !tarefa.concluida)}
              className="mt-0.5 shrink-0"
              aria-label={tarefa.concluida ? "Reabrir tarefa" : "Concluir tarefa"}
            >
              {tarefa.concluida ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground hover:text-accent transition-colors" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <SheetTitle
                className={`text-base font-semibold leading-tight ${
                  tarefa.concluida ? "line-through text-muted-foreground" : "text-foreground"
                }`}
              >
                {tarefa.titulo}
              </SheetTitle>
              {tarefa.nomeCliente && (
                <p className="text-xs text-accent font-medium mt-1">
                  Cliente: {tarefa.nomeCliente}
                </p>
              )}
            </div>
          </div>
          <SheetDescription className="sr-only">Detalhes da tarefa</SheetDescription>
        </SheetHeader>

        <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
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
              <Label htmlFor="tarefa-vencimento">Vencimento</Label>
              <Input
                id="tarefa-vencimento"
                type="date"
                value={vencimento}
                onChange={(evento) => setVencimento(evento.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tarefa-prioridade">Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger id="tarefa-prioridade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mudou && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  onSalvar(tarefa, { dataVencimento: vencimento, prioridade })
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
      </SheetContent>
    </Sheet>
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
  }) => Promise<void>;
  /** Vencimento ja preenchido quando a tarefa nasce pelo calendario. */
  dataInicial?: string | null;
  /** Cliente ja escolhido quando a tarefa nasce pela lista de Clientes. */
  clienteInicial?: ClienteEscolhido | null;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [vencimento, setVencimento] = useState(HOJE);
  const [prioridade, setPrioridade] = useState("normal");
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null);
  const [salvando, setSalvando] = useState(false);

  // o dialog fica montado: ao abrir, volta vencimento e cliente para o que veio do
  // calendario ou da lista de Clientes (ou limpa)
  useEffect(() => {
    if (aberto) {
      setVencimento(dataInicial ?? HOJE);
      setCliente(clienteInicial ?? null);
    }
  }, [aberto, dataInicial, clienteInicial]);

  const limpar = () => {
    setTitulo("");
    setDescricao("");
    setVencimento(HOJE);
    setPrioridade("normal");
    setCliente(null);
  };

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!titulo.trim()) {
      toast.error("Informe o título da tarefa");
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>
            A tarefa fica para você. O roteamento automático por papel entra com o módulo de membros.
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
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
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
