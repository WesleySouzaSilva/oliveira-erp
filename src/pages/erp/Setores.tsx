import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  atualizarSetor,
  criarSetor,
  excluirSetor,
  listarSetores,
  type Setor,
} from "@/lib/api/setores";

/**
 * Setores — cadastro das áreas de trabalho do escritório (ex.: agronegócio, bancário,
 * empresarial), clone do cadastro de Objetos (pedido do titular em 15/10/2026).
 *
 * É daqui que saem as opções do bloco "Setores" do cadastro de usuário (1..N por pessoa,
 * cada vínculo com o seu intervalo de valor de contrato) e é o destino de encaminhamento
 * das tarefas. Os 5 do fluxo já nascem com a migração V6; aqui entram os novos.
 *
 * Só admin/ceo escreve (a API devolve 403 para os demais) — o menu mostra esta tela só
 * para admin/ceo.
 */
export default function Setores() {
  const confirmar = useConfirm();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Setor | null>(null);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      setSetores(await listarSetores());
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const abrirNovo = () => {
    setEditando(null);
    setNome("");
    setDialogAberto(true);
  };

  const abrirEdicao = (setor: Setor) => {
    setEditando(setor);
    setNome(setor.nome);
    setDialogAberto(true);
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      if (editando) {
        await atualizarSetor(editando.id, { nome: nome.trim() });
        toast.success("Setor atualizado.");
      } else {
        await criarSetor({ nome: nome.trim() });
        toast.success("Setor criado.");
      }
      setDialogAberto(false);
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (setor: Setor) => {
    const confirmado = await confirmar({
      title: `Excluir o setor "${setor.nome}"?`,
      description:
        "Setores com pessoas vinculadas não podem ser excluídos — primeiro desvincule no cadastro do usuário.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirSetor(setor.id);
      toast.success("Setor excluído.");
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        icon={Layers}
        title="Setores"
        subtitle={`${setores.length} setor${setores.length === 1 ? "" : "s"} cadastrado${setores.length === 1 ? "" : "s"}`}
        breadcrumb={[{ label: "Módulos na API" }, { label: "Cadastro" }, { label: "Setores" }]}
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="w-4 h-4 mr-1" /> Novo setor
          </Button>
        }
      />

      {carregando ? (
        <ListSkeleton />
      ) : setores.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhum setor"
          description='Cadastre o primeiro setor (ex.: "Agronegócio") — ele é a área em que a pessoa trabalha e o destino das tarefas.'
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setor</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-40 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {setores.map((setor) => (
                  <TableRow key={setor.id}>
                    <TableCell className="font-medium">{setor.nome}</TableCell>
                    <TableCell>{setor.ordem ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={setor.ativo === false ? "outline" : "default"}>
                        {setor.ativo === false ? "inativo" : "ativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => abrirEdicao(setor)}>
                        <Pencil className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => excluir(setor)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar setor" : "Novo setor"}</DialogTitle>
            <DialogDescription>
              O setor é a área em que a pessoa trabalha (ex.: Agronegócio, Bancário, Empresarial) e
              o destino de encaminhamento das tarefas. Nome é obrigatório.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="setor-nome">
                Nome do setor *
              </Label>
              <Input
                id="setor-nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Agronegócio"
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando || !nome.trim()}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
