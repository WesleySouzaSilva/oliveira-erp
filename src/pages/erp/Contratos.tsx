import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileSignature,
  Filter,
  Plus,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { listarContratosGeral, type ContratoResumo, type FiltroContratos } from "@/lib/api/contratos";
import { listarTiposObjeto, type TipoObjeto } from "@/lib/api/objetos";
import { DetalheContrato } from "@/components/erp/DetalheContrato";
import { ContratosClienteDialog } from "@/components/erp/ContratosClienteDialog";
import { ClienteBusca, type ClienteEscolhido } from "@/components/erp/ClienteBusca";
import { temDetalhes } from "@/lib/contratoDetalhes";
import type { Pagina } from "@/lib/api/pagina";
import { textoParaValor } from "@/lib/moeda";

/**
 * Contratos Clientes — a lista geral de contratos do escritório (menu Clientes →
 * Contratos Clientes), decisão 1 do plano `docs/plano-contratos-e-timeline.md`.
 *
 * Lista RESUMIDA: número, cliente, objeto, valor, abertura e situação. A descrição nunca
 * aparece na tabela — cada linha tem a seta que abre o `DetalheContrato` embaixo (mesmo
 * componente do dialog de contratos do cliente). Detalhe completo (arquivos, tarefas e
 * linha do tempo) entra na próxima etapa.
 *
 * admin/ceo vê todos os contratos; o resto vê só os objetos que atende (escopo da API).
 */

interface Filtros {
  objetoId: string;
  situacao: string;
  valorMin: string;
  valorMax: string;
  aberturaDe: string;
  aberturaAte: string;
}

const FILTROS_VAZIOS: Filtros = {
  objetoId: "",
  situacao: "",
  valorMin: "",
  valorMax: "",
  aberturaDe: "",
  aberturaAte: "",
};

const dataBr = (iso: string | null | undefined): string =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR") : "—";

const moeda = (valor: number | null | undefined): string =>
  valor === null || valor === undefined
    ? "—"
    : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Contratos() {
  const [pagina, setPagina] = useState<Pagina<ContratoResumo> | null>(null);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [tipos, setTipos] = useState<TipoObjeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [numeroPagina, setNumeroPagina] = useState(0);
  /** Linhas com a descrição aberta (a descrição só existe depois da seta). */
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  /**
   * Novo contrato a partir da lista (19/10/2026): o form de contrato é POR CLIENTE,
   * então o atalho pede o cliente numa janelinha e em seguida abre o mesmo
   * `ContratosClienteDialog` já no formulário — o mesmo caminho do cadastro de cliente.
   */
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteNovo, setClienteNovo] = useState<ClienteEscolhido | null>(null);
  /** Janela do formulário de contrato (abre depois que o cliente é escolhido). */
  const [buscandoClienteNovo, setBuscandoClienteNovo] = useState(false);
  /** Cliente escolhido na busca do atalho — guarda só quando veio da base (com id). */
  const setClienteEscolhidoNovo = (cliente: ClienteEscolhido | null) =>
    setClienteNovo(cliente?.id ? cliente : null);

  const primeiraBusca = useRef(true);
  const timerBusca = useRef<number | null>(null);

  const carregar = useCallback(async (termo: string, paginaAtual: number, f: Filtros) => {
    setCarregando(true);
    try {
      const resultado = await listarContratosGeral({
        busca: termo.trim() || undefined,
        objetoId: f.objetoId || undefined,
        situacao: f.situacao || undefined,
        // Mesmo parse em centavos do form de contrato (src/lib/moeda.ts) — dinheiro
        // não passa por float quebrado. Inválido (NaN) fica de fora do filtro.
        valorMin: Number.isFinite(textoParaValor(f.valorMin)) ? textoParaValor(f.valorMin) : undefined,
        valorMax: Number.isFinite(textoParaValor(f.valorMax)) ? textoParaValor(f.valorMax) : undefined,
        aberturaDe: f.aberturaDe || undefined,
        aberturaAte: f.aberturaAte || undefined,
        page: paginaAtual,
        size: 50,
      });
      setPagina(resultado);
      setNumeroPagina(resultado.page.number);
      setExpandidos(new Set());
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) return; // o guard do layout cuida
      if (erro instanceof ErroApi && erro.status === 403) {
        toast.error("Você não tem acesso à lista de contratos.");
        setPagina(null);
        return;
      }
      toast.error(mensagemDeErro(erro));
      setPagina({ content: [], page: { size: 50, number: 0, totalElements: 0, totalPages: 0, first: true, last: true } });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar("", 0, FILTROS_VAZIOS);
    listarTiposObjeto()
      .then(setTipos)
      .catch(() => setTipos([])); // select sem tipos ainda não quebra a tela
  }, [carregar]);

  // Busca com debounce (mesmo padrão da tela de Clientes).
  useEffect(() => {
    if (primeiraBusca.current) {
      primeiraBusca.current = false;
      return;
    }
    if (timerBusca.current) window.clearTimeout(timerBusca.current);
    timerBusca.current = window.setTimeout(() => carregar(busca, 0, filtros), 300);
    return () => {
      if (timerBusca.current) window.clearTimeout(timerBusca.current);
    };
  }, [busca, filtros, carregar]);

  const mudarFiltro = (campo: keyof Filtros, valor: string) =>
    setFiltros((atual) => ({ ...atual, [campo]: valor }));

  const limparFiltros = () => {
    setFiltros(FILTROS_VAZIOS);
    carregar(busca, 0, FILTROS_VAZIOS);
  };

  const alternarLinha = (id: string) =>
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const expandirTodas = () =>
    setExpandidos(new Set((pagina?.content ?? []).map((contrato) => contrato.id)));
  const recolherTodas = () => setExpandidos(new Set());

  const contratos = pagina?.content ?? [];
  const total = pagina?.page.totalElements ?? 0;
  const primeiro = pagina?.page.first ?? true;
  const ultimo = pagina?.page.last ?? true;
  const temFiltroAtivo = Object.values(filtros).some((valor) => valor !== "");

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6">
      <PageHeader
        icon={FileSignature}
        title="Contratos Clientes"
        subtitle={`${total} contrato${total === 1 ? "" : "s"}${temFiltroAtivo ? " (com filtro)" : ""}`}
        breadcrumb={[{ label: "Módulos na API" }, { label: "Clientes" }, { label: "Contratos Clientes" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFiltrosAbertos((aberto) => !aberto)}>
              <Filter className="w-4 h-4 mr-1" /> Filtrar
              {temFiltroAtivo && <span className="ml-1 w-2 h-2 rounded-full bg-accent" />}
            </Button>
            {/* Atalho (19/10/2026): o form de contrato é por cliente — primeiro a
                busca de cliente, depois o mesmo form do cadastro. */}
            <Button size="sm" onClick={() => setBuscandoCliente(true)}>
              <Plus className="w-4 h-4 mr-1" /> Novo contrato
            </Button>
          </div>
        }
      />

      {/* Busca: número, cliente ou descrição (o servidor faz o LIKE) */}
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          if (timerBusca.current) window.clearTimeout(timerBusca.current);
          carregar(busca, 0, filtros);
        }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar por número, cliente ou descrição..."
          aria-label="Buscar contrato por número, cliente ou descrição"
          className="pl-9"
        />
      </form>

      {filtrosAbertos && (
        <Card className="p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="contratos-filtro-objeto">
                Objeto (categoria)
              </Label>
              <select
                id="contratos-filtro-objeto"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={filtros.objetoId}
                onChange={(evento) => mudarFiltro("objetoId", evento.target.value)}
              >
                <option value="">Todos</option>
                {tipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.tipoObjeto}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="contratos-filtro-situacao">
                Situação
              </Label>
              <select
                id="contratos-filtro-situacao"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={filtros.situacao}
                onChange={(evento) => mudarFiltro("situacao", evento.target.value)}
              >
                <option value="">Todas</option>
                <option value="ativo">Ativo</option>
                <option value="concluido">Concluído</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="contratos-filtro-valorMin">
                Valor mínimo (R$)
              </Label>
              <Input
                id="contratos-filtro-valorMin"
                type="number"
                step="0.01"
                min="0"
                value={filtros.valorMin}
                onChange={(evento) => mudarFiltro("valorMin", evento.target.value)}
                placeholder="Ex.: 1000,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="contratos-filtro-valorMax">
                Valor máximo (R$)
              </Label>
              <Input
                id="contratos-filtro-valorMax"
                type="number"
                step="0.01"
                min="0"
                value={filtros.valorMax}
                onChange={(evento) => mudarFiltro("valorMax", evento.target.value)}
                placeholder="Ex.: 50000,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="contratos-filtro-aberturaDe">
                Abertura de
              </Label>
              <Input
                id="contratos-filtro-aberturaDe"
                type="date"
                value={filtros.aberturaDe}
                onChange={(evento) => mudarFiltro("aberturaDe", evento.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="contratos-filtro-aberturaAte">
                Abertura até
              </Label>
              <Input
                id="contratos-filtro-aberturaAte"
                type="date"
                value={filtros.aberturaAte}
                onChange={(evento) => mudarFiltro("aberturaAte", evento.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={limparFiltros}>
              <X className="w-4 h-4 mr-1" /> Limpar filtros
            </Button>
          </div>
        </Card>
      )}

      {!carregando && contratos.length > 1 && (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={expandirTodas} aria-label="Expandir todas as descrições">
            <ChevronsDownUp className="w-4 h-4 mr-1" /> Expandir tudo
          </Button>
          <Button size="sm" variant="ghost" onClick={recolherTodas} aria-label="Recolher todas as descrições">
            <ChevronsUpDown className="w-4 h-4 mr-1" /> Recolher tudo
          </Button>
        </div>
      )}

      {carregando && !pagina ? (
        <ListSkeleton rows={8} />
      ) : contratos.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title={busca || temFiltroAtivo ? "Nenhum contrato encontrado" : "Nenhum contrato"}
          description={
            busca || temFiltroAtivo
              ? "Tente outro termo ou limpe os filtros."
              : "Os contratos dos clientes aparecem aqui assim que forem criados."
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <span className="sr-only">Descrição</span>
                  </TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((contrato) => {
                  const detalheAberto = expandidos.has(contrato.id);
                  return (
                    <Fragment key={contrato.id}>
                      <TableRow>
                        <TableCell className="px-2">
                          <button
                            type="button"
                            onClick={() => alternarLinha(contrato.id)}
                            aria-expanded={detalheAberto}
                            aria-controls={`contrato-lista-${contrato.id}`}
                            aria-label={
                              detalheAberto
                                ? `Recolher contrato ${contrato.numero}`
                                : `Ver descrição do contrato ${contrato.numero}`
                            }
                            title={detalheAberto ? "Recolher detalhe" : temDetalhes(contrato) ? "Ver descrição" : "Ver detalhes"}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
                          >
                            {detalheAberto ? (
                              <ChevronDown className="w-4 h-4 text-accent" />
                            ) : (
                              <ChevronRight
                                className={`w-4 h-4 ${temDetalhes(contrato) ? "text-accent" : "text-muted-foreground"}`}
                              />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{contrato.numero}</TableCell>
                        <TableCell className="max-w-[18rem]" >
                          <span className="block truncate" title={contrato.clienteNome ?? ""}>
                            {contrato.clienteNome || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{contrato.objetoNome || "—"}</Badge>
                        </TableCell>
                        <TableCell>{moeda(contrato.valor)}</TableCell>
                        <TableCell className="whitespace-nowrap">{dataBr(contrato.dataAbertura)}</TableCell>
                        <TableCell>
                          <Badge variant={contrato.situacao === "ativo" ? "default" : "outline"}>
                            {contrato.situacao}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {detalheAberto && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="bg-muted/30 px-4 py-3">
                            <DetalheContrato contrato={contrato} id={`contrato-lista-${contrato.id}`} />
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
              {total} contrato{total === 1 ? "" : "s"} · página {numeroPagina + 1} de{" "}
              {pagina?.page.totalPages || 1}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={primeiro || carregando}
                onClick={() => carregar(busca, Math.max(numeroPagina - 1, 0), filtros)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={ultimo || carregando}
                onClick={() => carregar(busca, numeroPagina + 1, filtros)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Atalho "Novo contrato": 1) escolher o cliente; 2) abrir o form (mesmo dialog
          do cadastro de cliente, já no formulário). */}
      <Dialog open={buscandoCliente} onOpenChange={setBuscandoCliente}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo contrato — qual cliente?</DialogTitle>
            <DialogDescription>
              O contrato pertence a um cliente. Busque e escolha na lista para abrir o
              formulário já vinculado a ele.
            </DialogDescription>
          </DialogHeader>
          <ClienteBusca
            key={buscandoCliente ? "novo-contrato-cliente" : "fechado"}
            id="novo-contrato-cliente"
            onChange={setClienteEscolhidoNovo}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuscandoCliente(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!clienteNovo?.id}
              onClick={() => {
                setBuscandoCliente(false);
                setBuscandoClienteNovo(true);
              }}
            >
              Abrir formulário
            </Button>
          </DialogFooter>
          {!clienteNovo?.id && clienteNovo && (
            <p className="text-[11px] text-muted-foreground -mt-1">
              Escolha um cliente da lista (o nome digitado sem escolher não abre o
              formulário).
            </p>
          )}
        </DialogContent>
      </Dialog>

      {clienteNovo?.id && (
        <ContratosClienteDialog
          aberto={buscandoClienteNovo}
          onAbertoChange={(aberto) => {
            setBuscandoClienteNovo(aberto);
            if (!aberto) setClienteNovo(null);
          }}
          clienteId={clienteNovo.id}
          clienteNome={clienteNovo.nome}
          iniciandoComFormulario
          onContratoCriado={() => carregar(busca, 0, filtros)}
        />
      )}
    </div>
  );
}
