import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileSignature, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mensagemDeErro } from "@/lib/api/http";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { listarTiposObjeto, type TipoObjeto } from "@/lib/api/objetos";
import {
  atualizarContrato,
  criarContrato,
  excluirContrato,
  listarContratos,
  type Contrato,
} from "@/lib/api/contratos";

/**
 * Contratos do cliente — a 1a etapa do cliente (1..N por cliente). Dialog com a
 * lista + formulário: numero, objeto (select do tipo de objeto/categoria), valor,
 * data de abertura (AUTOMÁTICA — só o servidor grava, o form só mostra) e descricao.
 *
 * Abre em dois modos: lista (padrão) ou com o formulário de novo contrato já aberto
 * (`iniciandoComFormulario`) — é o que o botão "Salvar e gerar contrato" do cadastro
 * de cliente usa.
 */
interface Props {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  clienteId: string;
  clienteNome: string;
  /** Abre já no formulário de novo contrato (depois de salvar o cliente). */
  iniciandoComFormulario?: boolean;
  /** Chamado depois de criar o primeiro contrato (para a tela pai recarregar). */
  onContratoCriado?: () => void;
}

interface Formulario {
  numero: string;
  objetoId: string;
  valor: string;
  descricao: string;
}

const FORM_VAZIO: Formulario = { numero: "", objetoId: "", valor: "", descricao: "" };

export function ContratosClienteDialog({
  aberto,
  onAbertoChange,
  clienteId,
  clienteNome,
  iniciandoComFormulario = false,
  onContratoCriado,
}: Props) {
  const confirmar = useConfirm();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [tipos, setTipos] = useState<TipoObjeto[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Contrato | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  // A data de abertura é automática: o form não tem o campo, só informa ao usuário.
  const hoje = new Date().toLocaleDateString("pt-BR");

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    Promise.all([listarContratos(clienteId), listarTiposObjeto()])
      .then(([lista, listaTipos]) => {
        setContratos(lista);
        setTipos(listaTipos);
      })
      .catch((erro) => toast.error(mensagemDeErro(erro)))
      .finally(() => setCarregando(false));
    if (iniciandoComFormulario) {
      setEditando(null);
      setForm(FORM_VAZIO);
      setFormAberto(true);
    }
  }, [aberto, clienteId, iniciandoComFormulario]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ...FORM_VAZIO, objetoId: tipos.length === 1 ? tipos[0].id : "" });
    setFormAberto(true);
  };

  const abrirEdicao = (contrato: Contrato) => {
    setEditando(contrato);
    setForm({
      numero: contrato.numero,
      objetoId: contrato.objetoId ?? "",
      valor: contrato.valor === null || contrato.valor === undefined ? "" : String(contrato.valor),
      descricao: contrato.descricao ?? "",
    });
    setFormAberto(true);
  };

  const campo = (nome: keyof Formulario) => ({
    id: `contrato-${nome}`,
    value: form[nome],
    onChange: (evento: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
  });

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!form.numero.trim()) return;
    setSalvando(true);
    try {
      const valor = form.valor.trim() ? Number(form.valor.trim().replace(",", ".")) : null;
      const dados = {
        numero: form.numero.trim(),
        objetoId: form.objetoId || null,
        valor,
        descricao: form.descricao.trim() || null,
      };
      if (editando) {
        await atualizarContrato(editando.id, dados);
        toast.success("Contrato atualizado.");
      } else {
        await criarContrato(clienteId, dados);
        toast.success("Contrato criado.");
        onContratoCriado?.();
      }
      setFormAberto(false);
      setContratos(await listarContratos(clienteId));
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (contrato: Contrato) => {
    const confirmado = await confirmar({
      title: `Excluir o contrato ${contrato.numero}?`,
      description: "Os arquivos anexados ao contrato também serão excluídos.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirContrato(contrato.id);
      toast.success("Contrato excluído.");
      setContratos(await listarContratos(clienteId));
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  const nomeDoTipo = (id: string | null | undefined) =>
    tipos.find((tipo) => tipo.id === id)?.tipoObjeto ?? "—";

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contratos — {clienteNome}</DialogTitle>
          <DialogDescription>
            O contrato é a 1ª etapa do cliente: reúne os dados do que será feito antes de
            abrir o processo.
          </DialogDescription>
        </DialogHeader>

        {!formAberto && (
          <div className="flex justify-end">
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="w-4 h-4 mr-1" /> Novo contrato
            </Button>
          </div>
        )}

        {formAberto ? (
          <form onSubmit={salvar} className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {editando ? `Editar contrato ${editando.numero}` : "Novo contrato"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="contrato-numero">
                  Número do contrato *
                </Label>
                <Input {...campo("numero")} placeholder="Ex.: CT-001" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="contrato-objetoId">
                  Objeto (categoria)
                </Label>
                <select
                  id="contrato-objetoId"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...campo("objetoId")}
                >
                  <option value="">Selecione o objeto</option>
                  {tipos.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.tipoObjeto}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="contrato-valor">
                  Valor (R$)
                </Label>
                <Input
                  {...campo("valor")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex.: 15000,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data de abertura</Label>
                <Input value={hoje} readOnly disabled aria-label="Data de abertura (automática)" />
                <p className="text-[11px] text-muted-foreground">Preenchida automaticamente.</p>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="contrato-descricao">
                  Descrição (resumo do que seria do cliente)
                </Label>
                <textarea
                  id="contrato-descricao"
                  {...campo("descricao")}
                  rows={3}
                  placeholder="Resumo do que será feito para o cliente"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormAberto(false);
                  setForm(FORM_VAZIO);
                  setEditando(null);
                }}
              >
                Voltar
              </Button>
              <Button type="submit" disabled={salvando || !form.numero.trim()}>
                {salvando ? "Salvando..." : "Salvar contrato"}
              </Button>
            </DialogFooter>
          </form>
        ) : carregando ? (
          <ListSkeleton />
        ) : contratos.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title="Nenhum contrato"
            description="Crie o primeiro contrato do cliente — número e objeto são o bastante para começar."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-40 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((contrato) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">{contrato.numero}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{nomeDoTipo(contrato.objetoId)}</Badge>
                    </TableCell>
                    <TableCell>
                      {contrato.valor === null || contrato.valor === undefined
                        ? "—"
                        : contrato.valor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                    </TableCell>
                    <TableCell>
                      {contrato.dataAbertura
                        ? new Date(`${contrato.dataAbertura}T00:00:00`).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={contrato.situacao === "ativo" ? "default" : "outline"}>
                        {contrato.situacao}
                      </Badge>
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
      </DialogContent>
    </Dialog>
  );
}
