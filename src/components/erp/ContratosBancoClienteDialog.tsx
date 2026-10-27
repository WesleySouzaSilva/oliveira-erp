import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  excluirContratoBanco,
  listarContratosBanco,
  type ContratoBanco,
} from "@/lib/api/contratosBanco";
import { ContratoBancoForm } from "@/components/erp/ContratoBancoForm";

/**
 * Contratos do cliente com o BANCO — visão por cliente (ação "Contratos → Com o banco"
 * da lista de clientes, correção 4). Lista os contratos DAQUELE cliente
 * (`GET /contratos-banco?clienteId=`) e cadastro/edita/exclui reusando o MESMO
 * `ContratoBancoForm` da tela geral — o `clienteId` vem do contexto do dialog.
 *
 * Não confundir com `ContratosClienteDialog` (contratos com o ESCRITÓRIO).
 */

const dataBr = (iso: string | null | undefined): string =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR") : "—";

const moeda = (valor: number | null | undefined): string =>
  valor === null || valor === undefined
    ? "—"
    : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  clienteId: string;
  clienteNome: string;
  /** Depois de criar/editar/excluir — o pai (tela de clientes) recarrega se quiser. */
  onContratoSalvo?: () => void;
}

export function ContratosBancoClienteDialog({
  aberto,
  onAbertoChange,
  clienteId,
  clienteNome,
  onContratoSalvo,
}: Props) {
  const confirmar = useConfirm();
  const [contratos, setContratos] = useState<ContratoBanco[]>([]);
  const [carregando, setCarregando] = useState(true);
  /** Formulário aberto (novo ou edição) no lugar da lista — mesmo jeito do dialog do escritório. */
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<ContratoBanco | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resultado = await listarContratosBanco({ clienteId, size: 50 });
      setContratos(resultado.content);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) return; // o guard do layout cuida
      toast.error(mensagemDeErro(erro));
      setContratos([]);
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    if (!aberto) return;
    setFormAberto(false);
    setEditando(null);
    void carregar();
  }, [aberto, carregar]);

  const abrirNovo = () => {
    setEditando(null);
    setFormAberto(true);
  };

  const abrirEdicao = (contrato: ContratoBanco) => {
    setEditando(contrato);
    setFormAberto(true);
  };

  const excluir = async (contrato: ContratoBanco) => {
    const confirmado = await confirmar({
      title: `Excluir o contrato ${contrato.numeroContrato || contrato.banco}?`,
      description: "O registro deste contrato com o banco será removido.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirContratoBanco(contrato.id);
      toast.success("Contrato com o banco excluído.");
      await carregar();
      onContratoSalvo?.();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contratos com o banco — {clienteNome}</DialogTitle>
          <DialogDescription>
            Operações de crédito/financiamento do cliente junto ao banco (o contrato com o
            escritório fica em "Com o escritório").
          </DialogDescription>
        </DialogHeader>

        {formAberto ? (
          <ContratoBancoForm
            key={editando?.id ?? "novo"}
            clienteId={clienteId}
            contrato={editando}
            onSalvo={() => {
              setFormAberto(false);
              setEditando(null);
              void carregar();
              onContratoSalvo?.();
            }}
            onCancelar={() => {
              setFormAberto(false);
              setEditando(null);
            }}
          />
        ) : (
          <>
            <div className="flex items-center justify-end">
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="w-4 h-4 mr-1" /> Novo contrato
              </Button>
            </div>

            {carregando ? (
              <ListSkeleton />
            ) : contratos.length === 0 ? (
              <EmptyState
                icon={Landmark}
                title="Nenhum contrato com o banco"
                description="Cadastre a primeira operação de crédito/financiamento deste cliente."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Banco</TableHead>
                      <TableHead>Nº do contrato</TableHead>
                      <TableHead>Valor total</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Próx. venc.</TableHead>
                      <TableHead className="w-40 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contratos.map((contrato) => (
                      <TableRow key={contrato.id}>
                        <TableCell className="font-medium">{contrato.banco}</TableCell>
                        <TableCell>{contrato.numeroContrato || "—"}</TableCell>
                        <TableCell>{moeda(contrato.valorTotalOperacao)}</TableCell>
                        <TableCell>{moeda(contrato.valorParcela)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {dataBr(contrato.vencimentoProximaParcela)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => abrirEdicao(contrato)}>
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
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
