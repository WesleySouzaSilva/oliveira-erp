import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Landmark,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErroApi, mensagemDeErro } from "@/lib/api/http";
import {
  excluirContratoBanco,
  listarContratosBanco,
  type ContratoBanco,
} from "@/lib/api/contratosBanco";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ClienteBusca, type ClienteEscolhido } from "@/components/erp/ClienteBusca";
import { ContratoBancoForm } from "@/components/erp/ContratoBancoForm";
import type { Pagina } from "@/lib/api/pagina";

/**
 * Contratos com o banco — lista geral (menu Comercial → Contratos Cliente), correção 4 de
 * `docs/plano-correcoes-comercial-contratos-tarefas.md` + correção do titular (26/10/2026).
 *
 * Espelho do fonte antigo: operações de crédito/financiamento dos clientes junto aos
 * bancos. Busca por NOME DO CLIENTE (`cliente`) e por BANCO (`banco`), ambos com debounce.
 *
 * Correção 26/10/2026 (titular): a lista passa a ser AGRUPADA POR CLIENTE — o nome aparece
 * UMA vez com a SOMA dos `valorTotalOperacao` dos contratos dele; a seta do nome expande e
 * mostra os contratos, cada um com suas próprias ações (Visualizar, Editar, Excluir) e com
 * a seta de observações embaixo (mesmo padrão de "olhar dentro" da tela de Contratos do
 * escritório). O form continua POR CLIENTE (`clienteId` vem da busca ou da linha).
 */

const dataBr = (iso: string | null | undefined): string =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR") : "—";

const moeda = (valor: number | null | undefined): string =>
  valor === null || valor === undefined
    ? "—"
    : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Um cliente da lista agrupada: nome único + a soma do valor total das operações dele. */
interface GrupoCliente {
  clienteId: string;
  clienteNome: string;
  contratos: ContratoBanco[];
  /** Soma do `valorTotalOperacao` dos contratos DESTA página. */
  somaValor: number;
}

/**
 * Agrupa os contratos da página por cliente (o servidor pagina por CONTRATO, então o
 * agrupamento vale para os contratos carregados). Nome vazio cai em "—" e ainda assim
 * forma grupo — nada some da tela.
 */
function agruparPorCliente(contratos: ContratoBanco[]): GrupoCliente[] {
  const mapa = new Map<string, GrupoCliente>();
  for (const contrato of contratos) {
    const chave = contrato.clienteId || contrato.clienteNome || "—";
    let grupo = mapa.get(chave);
    if (!grupo) {
      grupo = {
        clienteId: contrato.clienteId || chave,
        clienteNome: contrato.clienteNome || "—",
        contratos: [],
        somaValor: 0,
      };
      mapa.set(chave, grupo);
    }
    grupo.contratos.push(contrato);
    grupo.somaValor += contrato.valorTotalOperacao ?? 0;
  }
  return [...mapa.values()].sort((a, b) =>
    a.clienteNome.localeCompare(b.clienteNome, "pt-BR"),
  );
}

export default function ContratosBanco() {
  const confirmar = useConfirm();
  const [pagina, setPagina] = useState<Pagina<ContratoBanco> | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaBanco, setBuscaBanco] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [numeroPagina, setNumeroPagina] = useState(0);
  /** Clientes com os contratos expandidos (a seta do NOME do cliente). */
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  /** Contratos com as observações abertas (a seta embaixo, por contrato). */
  const [observacoesAbertas, setObservacoesAbertas] = useState<Set<string>>(new Set());
  /** Janela de visualização (somente leitura) de um contrato. */
  const [visualizando, setVisualizando] = useState<ContratoBanco | null>(null);
  /** Atalho "Novo contrato": 1) escolher o cliente; 2) abrir o form já vinculado. */
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteNovo, setClienteNovo] = useState<ClienteEscolhido | null>(null);
  /** Janela do formulário de novo contrato (abre depois que o cliente é escolhido). */
  const [formNovoAberto, setFormNovoAberto] = useState(false);
  /** Contrato em edição (form no lugar da lista, mesmo padrão do dialog do cliente). */
  const [editando, setEditando] = useState<ContratoBanco | null>(null);

  const primeiraBusca = useRef(true);
  const timerBusca = useRef<number | null>(null);

  const carregar = useCallback(
    async (cliente: string, banco: string, paginaAtual: number) => {
      setCarregando(true);
      try {
        const resultado = await listarContratosBanco({
          cliente: cliente.trim() || undefined,
          banco: banco.trim() || undefined,
          page: paginaAtual,
          size: 50,
        });
        setPagina(resultado);
        setNumeroPagina(resultado.page.number);
        // Lista nova → recolhe tudo (os grupos são outros).
        setExpandidos(new Set());
        setObservacoesAbertas(new Set());
      } catch (erro) {
        if (erro instanceof ErroApi && erro.status === 401) return; // o guard do layout cuida
        if (erro instanceof ErroApi && erro.status === 403) {
          toast.error("Você não tem acesso à lista de contratos com o banco.");
          setPagina(null);
          return;
        }
        toast.error(mensagemDeErro(erro));
        setPagina({
          content: [],
          page: { size: 50, number: 0, totalElements: 0, totalPages: 0, first: true, last: true },
        });
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  useEffect(() => {
    carregar("", "", 0);
  }, [carregar]);

  // Busca com debounce nas DUAS caixas (mesmo padrão da tela de Clientes).
  useEffect(() => {
    if (primeiraBusca.current) {
      primeiraBusca.current = false;
      return;
    }
    if (timerBusca.current) window.clearTimeout(timerBusca.current);
    timerBusca.current = window.setTimeout(
      () => carregar(buscaCliente, buscaBanco, 0),
      300,
    );
    return () => {
      if (timerBusca.current) window.clearTimeout(timerBusca.current);
    };
  }, [buscaCliente, buscaBanco, carregar]);

  const contratos = pagina?.content ?? [];
  const total = pagina?.page.totalElements ?? 0;
  const primeiro = pagina?.page.first ?? true;
  const ultimo = pagina?.page.last ?? true;
  const filtrando = Boolean(buscaCliente.trim() || buscaBanco.trim());

  const grupos = useMemo(() => agruparPorCliente(contratos), [contratos]);

  const alternarCliente = (clienteId: string) =>
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(clienteId)) novo.delete(clienteId);
      else novo.add(clienteId);
      return novo;
    });

  const alternarObservacoes = (contratoId: string) =>
    setObservacoesAbertas((atual) => {
      const novo = new Set(atual);
      if (novo.has(contratoId)) novo.delete(contratoId);
      else novo.add(contratoId);
      return novo;
    });

  const excluir = async (contrato: ContratoBanco) => {
    const confirmado = await confirmar({
      title: `Excluir o contrato ${contrato.numeroContrato || contrato.banco}?`,
      description: `Cliente: ${contrato.clienteNome} — o registro com o banco será removido.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirContratoBanco(contrato.id);
      toast.success("Contrato com o banco excluído.");
      // última linha da página? volta uma para não cair numa página vazia
      const ultimaDaPagina = (pagina?.content.length ?? 0) === 1 && numeroPagina > 0;
      await carregar(buscaCliente, buscaBanco, ultimaDaPagina ? numeroPagina - 1 : numeroPagina);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  const recarregar = () => carregar(buscaCliente, buscaBanco, numeroPagina);

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6">
      <PageHeader
        icon={Landmark}
        title="Contratos Cliente"
        subtitle={`${total} contrato${total === 1 ? "" : "s"}${
          filtrando ? " (com filtro)" : ""
        } em ${grupos.length} cliente${grupos.length === 1 ? "" : "s"} — contratos dos clientes COM OS BANCOS`}
        breadcrumb={[{ label: "Comercial" }, { label: "Contratos Cliente" }]}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setClienteNovo(null);
              setBuscandoCliente(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Novo contrato
          </Button>
        }
      />

      {/* Busca: trecho do NOME do cliente e trecho do BANCO (o servidor faz o LIKE) */}
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          if (timerBusca.current) window.clearTimeout(timerBusca.current);
          carregar(buscaCliente, buscaBanco, 0);
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={buscaCliente}
            onChange={(evento) => setBuscaCliente(evento.target.value)}
            placeholder="Buscar por nome do cliente..."
            aria-label="Buscar por nome do cliente"
            className="pl-9"
          />
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={buscaBanco}
            onChange={(evento) => setBuscaBanco(evento.target.value)}
            placeholder="Buscar por banco..."
            aria-label="Buscar por banco"
            className="pl-9"
          />
        </div>
      </form>

      {formNovoAberto && clienteNovo?.id ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Novo contrato com o banco — {clienteNovo.nome}
          </h2>
          <ContratoBancoForm
            clienteId={clienteNovo.id}
            onSalvo={() => {
              setFormNovoAberto(false);
              setClienteNovo(null);
              void carregar(buscaCliente, buscaBanco, 0);
            }}
            onCancelar={() => {
              setFormNovoAberto(false);
              setClienteNovo(null);
            }}
          />
        </div>
      ) : editando ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Editar contrato {editando.numeroContrato || ""} — {editando.clienteNome}
          </h2>
          <ContratoBancoForm
            clienteId={editando.clienteId}
            contrato={editando}
            onSalvo={() => {
              setEditando(null);
              void recarregar();
            }}
            onCancelar={() => setEditando(null)}
          />
        </div>
      ) : null}

      {!formNovoAberto && !editando &&
        (carregando && !pagina ? (
          <ListSkeleton rows={8} />
        ) : contratos.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title={filtrando ? "Nenhum contrato encontrado" : "Nenhum contrato com o banco"}
            description={
              filtrando
                ? "Tente outro termo nas buscas de cliente ou banco."
                : "Cadastre a primeira operação de crédito/financiamento de um cliente."
            }
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <span className="sr-only">Contratos do cliente</span>
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Contratos</TableHead>
                    <TableHead className="text-right">Valor total (soma)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupos.map((grupo) => {
                    const aberto = expandidos.has(grupo.clienteId);
                    return (
                      <Fragment key={grupo.clienteId}>
                        <TableRow>
                          <TableCell className="px-2">
                            <button
                              type="button"
                              onClick={() => alternarCliente(grupo.clienteId)}
                              aria-expanded={aberto}
                              aria-controls={`contratos-banco-cliente-${grupo.clienteId}`}
                              aria-label={
                                aberto
                                  ? `Recolher contratos de ${grupo.clienteNome}`
                                  : `Ver contratos de ${grupo.clienteNome}`
                              }
                              title={aberto ? "Recolher contratos" : "Ver contratos"}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
                            >
                              {aberto ? (
                                <ChevronDown className="w-4 h-4 text-accent" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-accent" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="max-w-[18rem] font-medium">
                            <span className="block truncate" title={grupo.clienteNome}>
                              {grupo.clienteNome}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {grupo.contratos.length}
                          </TableCell>
                          <TableCell className="text-right">
                            {moeda(grupo.somaValor)}
                          </TableCell>
                        </TableRow>

                        {aberto && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={4} className="bg-muted/30 px-4 py-3">
                              <div
                                id={`contratos-banco-cliente-${grupo.clienteId}`}
                                className="overflow-x-auto rounded-lg border border-border"
                              >
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-8">
                                        <span className="sr-only">Observações</span>
                                      </TableHead>
                                      <TableHead>Banco</TableHead>
                                      <TableHead>Nº do contrato</TableHead>
                                      <TableHead>Valor total</TableHead>
                                      <TableHead>Parcela</TableHead>
                                      <TableHead>1º venc.</TableHead>
                                      <TableHead>Próx. venc.</TableHead>
                                      <TableHead>Últ. venc.</TableHead>
                                      <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {grupo.contratos.map((contrato) => {
                                      const obsAberta = observacoesAbertas.has(contrato.id);
                                      return (
                                        <Fragment key={contrato.id}>
                                          <TableRow>
                                            <TableCell className="px-2">
                                              <button
                                                type="button"
                                                onClick={() => alternarObservacoes(contrato.id)}
                                                aria-expanded={obsAberta}
                                                aria-controls={`contratos-banco-obs-${contrato.id}`}
                                                aria-label={
                                                  obsAberta
                                                    ? `Recolher observações do contrato ${contrato.numeroContrato || contrato.banco}`
                                                    : `Ver observações do contrato ${contrato.numeroContrato || contrato.banco}`
                                                }
                                                title={obsAberta ? "Recolher observações" : "Ver observações"}
                                                className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
                                              >
                                                {obsAberta ? (
                                                  <ChevronDown className="w-4 h-4 text-accent" />
                                                ) : (
                                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                )}
                                              </button>
                                            </TableCell>
                                            <TableCell>{contrato.banco}</TableCell>
                                            <TableCell>{contrato.numeroContrato || "—"}</TableCell>
                                            <TableCell>{moeda(contrato.valorTotalOperacao)}</TableCell>
                                            <TableCell>{moeda(contrato.valorParcela)}</TableCell>
                                            <TableCell className="whitespace-nowrap">
                                              {dataBr(contrato.primeiroVencimento)}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                              {dataBr(contrato.vencimentoProximaParcela)}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                              {dataBr(contrato.vencimentoUltimaParcela)}
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setVisualizando(contrato)}
                                              >
                                                <Eye className="w-4 h-4 mr-1" /> Visualizar
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setEditando(contrato)}
                                              >
                                                <Pencil className="w-4 h-4 mr-1" /> Editar
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => excluir(contrato)}
                                              >
                                                <Trash2 className="w-4 h-4 mr-1" /> Excluir
                                              </Button>
                                            </TableCell>
                                          </TableRow>

                                          {obsAberta && (
                                            <TableRow className="hover:bg-transparent">
                                              <TableCell
                                                colSpan={9}
                                                className="bg-background/50 px-4 py-3"
                                              >
                                                <p
                                                  id={`contratos-banco-obs-${contrato.id}`}
                                                  className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"
                                                >
                                                  <StickyNote className="w-3.5 h-3.5" /> Observações
                                                </p>
                                                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                                                  {contrato.observacoes?.trim() || (
                                                    <span className="text-muted-foreground">
                                                      Sem observações.
                                                    </span>
                                                  )}
                                                </p>
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </Fragment>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>
                {total} contrato{total === 1 ? "" : "s"} · {grupos.length} cliente
                {grupos.length === 1 ? "" : "s"} · página {numeroPagina + 1} de{" "}
                {pagina?.page.totalPages || 1}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={primeiro || carregando}
                  onClick={() => carregar(buscaCliente, buscaBanco, Math.max(numeroPagina - 1, 0))}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ultimo || carregando}
                  onClick={() => carregar(buscaCliente, buscaBanco, numeroPagina + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </Card>
        ))}

      {/* Visualizar (somente leitura): todos os campos do contrato com o banco. */}
      <Dialog open={!!visualizando} onOpenChange={(aberto) => !aberto && setVisualizando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contrato com o banco</DialogTitle>
            <DialogDescription>
              {visualizando?.clienteNome} — {visualizando?.banco}
            </DialogDescription>
          </DialogHeader>
          {visualizando && (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Banco</dt>
                  <dd>{visualizando.banco}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Nº do contrato</dt>
                  <dd>{visualizando.numeroContrato || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Valor total da operação</dt>
                  <dd>{moeda(visualizando.valorTotalOperacao)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Valor da parcela</dt>
                  <dd>{moeda(visualizando.valorParcela)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">1º vencimento</dt>
                  <dd>{dataBr(visualizando.primeiroVencimento)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Próximo vencimento</dt>
                  <dd>{dataBr(visualizando.vencimentoProximaParcela)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Último vencimento</dt>
                  <dd>{dataBr(visualizando.vencimentoUltimaParcela)}</dd>
                </div>
              </dl>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <StickyNote className="w-3.5 h-3.5" /> Observações
                </p>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                  {visualizando.observacoes?.trim() || (
                    <span className="text-muted-foreground">Sem observações.</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Atalho "Novo contrato": 1) escolher o cliente; 2) abrir o form já vinculado. */}
      <Dialog open={buscandoCliente} onOpenChange={setBuscandoCliente}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo contrato com o banco — qual cliente?</DialogTitle>
            <DialogDescription>
              O contrato pertence a um cliente. Busque e escolha na lista para abrir o
              formulário já vinculado a ele.
            </DialogDescription>
          </DialogHeader>
          <ClienteBusca
            key={buscandoCliente ? "novo-contrato-banco-cliente" : "fechado"}
            id="novo-contrato-banco-cliente"
            onChange={setClienteNovo}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBuscandoCliente(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!clienteNovo?.id}
              onClick={() => {
                setBuscandoCliente(false);
                setFormNovoAberto(true);
              }}
            >
              Abrir formulário
            </Button>
          </div>
          {!clienteNovo?.id && clienteNovo && (
            <p className="text-[11px] text-muted-foreground -mt-1">
              Escolha um cliente da lista (o nome digitado sem escolher não abre o formulário).
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
