import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Landmark, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
 * Contratos com o banco — lista geral (menu Clientes → Contratos), correção 4 de
 * `docs/plano-correcoes-comercial-contratos-tarefas.md`.
 *
 * Espelho do fonte antigo: operações de crédito/financiamento dos clientes junto aos
 * bancos. Busca por NOME DO CLIENTE (`cliente`) e por BANCO (`banco`), ambos com
 * debounce; o form é POR CLIENTE (o `clienteId` vem da busca ou da linha), por isso o
 * atalho "Novo contrato" primeiro pergunta qual é o cliente — mesmo caminho da tela
 * de contratos do escritório.
 */

const dataBr = (iso: string | null | undefined): string =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR") : "—";

const moeda = (valor: number | null | undefined): string =>
  valor === null || valor === undefined
    ? "—"
    : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ContratosBanco() {
  const confirmar = useConfirm();
  const [pagina, setPagina] = useState<Pagina<ContratoBanco> | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaBanco, setBuscaBanco] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [numeroPagina, setNumeroPagina] = useState(0);
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
        } — contratos dos clientes COM OS BANCOS`}
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
                    <TableHead>Cliente</TableHead>
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
                  {contratos.map((contrato) => (
                    <TableRow key={contrato.id}>
                      <TableCell className="max-w-[16rem]">
                        <span className="block truncate font-medium" title={contrato.clienteNome ?? ""}>
                          {contrato.clienteNome || "—"}
                        </span>
                      </TableCell>
                      <TableCell>{contrato.banco}</TableCell>
                      <TableCell>{contrato.numeroContrato || "—"}</TableCell>
                      <TableCell>{moeda(contrato.valorTotalOperacao)}</TableCell>
                      <TableCell>{moeda(contrato.valorParcela)}</TableCell>
                      <TableCell className="whitespace-nowrap">{dataBr(contrato.primeiroVencimento)}</TableCell>
                      <TableCell className="whitespace-nowrap">{dataBr(contrato.vencimentoProximaParcela)}</TableCell>
                      <TableCell className="whitespace-nowrap">{dataBr(contrato.vencimentoUltimaParcela)}</TableCell>
                      <TableCell className="text-right">
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
                  ))}
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
          <DialogFooter>
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
          </DialogFooter>
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
