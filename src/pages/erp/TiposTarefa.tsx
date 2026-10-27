import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Power, Tags, Trash2 } from "lucide-react";
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
  atualizarTipoTarefa,
  criarTipoTarefa,
  excluirTipoTarefa,
  listarTiposTarefa,
  type TarefaTipo,
} from "@/lib/api/tarefas";

/**
 * Tipos de tarefa — cadastro dos rótulos do seletor "Tipo de tarefa" do form (Correção 5b):
 * o NOME do tipo é o que a API grava como título da tarefa. Clone do cadastro de Setores
 * (padrão CRUD das telas admin).
 *
 * Leitura aberta a qualquer autenticado (o form de nova tarefa busca a lista a cada
 * abertura); escrita só admin/ceo — o menu mostra esta tela no grupo Cadastro só para
 * admin/ceo e a API responde 403 para os demais.
 *
 * Ao excluir, a API zera o vínculo das tarefas existentes (SET NULL) e mantém o título
 * já gravado em cada uma — o confirma avisa exatamente isso.
 */
export default function TiposTarefa() {
  const confirmar = useConfirm();
  const [tipos, setTipos] = useState<TarefaTipo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<TarefaTipo | null>(null);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  /** Id do tipo cujo ativo está sendo trocado (deixa o botão da linha ocupado). */
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      // A API devolve os dois lados (ativos e desligados) — filtrar é daqui.
      setTipos(await listarTiposTarefa());
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

  const abrirEdicao = (tipo: TarefaTipo) => {
    setEditando(tipo);
    setNome(tipo.nome);
    setDialogAberto(true);
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      if (editando) {
        await atualizarTipoTarefa(editando.id, { nome: nome.trim() });
        toast.success("Tipo de tarefa atualizado.");
      } else {
        await criarTipoTarefa({ nome: nome.trim() });
        toast.success("Tipo de tarefa criado.");
      }
      setDialogAberto(false);
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  /** Ativar/desativar: o tipo desligado sai do seletor do form, mas fica na lista. */
  const alternarAtivo = async (tipo: TarefaTipo) => {
    const ativo = !tipo.ativo;
    setAlternandoId(tipo.id);
    try {
      await atualizarTipoTarefa(tipo.id, { ativo });
      toast.success(ativo ? `Tipo "${tipo.nome}" ativado.` : `Tipo "${tipo.nome}" desativado.`);
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setAlternandoId(null);
    }
  };

  const excluir = async (tipo: TarefaTipo) => {
    const confirmado = await confirmar({
      title: `Excluir o tipo "${tipo.nome}"?`,
      description:
        "As tarefas existentes deste tipo ficam SEM TIPO (a API apaga o vínculo, SET NULL) — o título já gravado nelas permanece. Novas tarefas deixam de oferecer este tipo.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirTipoTarefa(tipo.id);
      toast.success("Tipo de tarefa excluído.");
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        icon={Tags}
        title="Tipos de tarefa"
        subtitle={`${tipos.length} tipo${tipos.length === 1 ? "" : "s"} cadastrado${tipos.length === 1 ? "" : "s"}`}
        breadcrumb={[{ label: "Módulos na API" }, { label: "Cadastro" }, { label: "Tipos de tarefa" }]}
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="w-4 h-4 mr-1" /> Novo tipo
          </Button>
        }
      />

      {carregando ? (
        <ListSkeleton />
      ) : tipos.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhum tipo de tarefa"
          description='Cadastre o primeiro tipo (ex.: "Auditoria mensal") — o nome dele vira o título gravado em toda tarefa criada com esse tipo.'
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-72 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipos.map((tipo) => (
                  <TableRow key={tipo.id}>
                    <TableCell className="font-medium">{tipo.nome}</TableCell>
                    <TableCell>
                      <Badge variant={tipo.ativo ? "default" : "outline"}>
                        {tipo.ativo ? "ativo" : "inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Renomear ${tipo.nome}`}
                        onClick={() => abrirEdicao(tipo)}
                      >
                        <Pencil className="w-4 h-4 mr-1" /> Renomear
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={tipo.ativo ? `Desativar ${tipo.nome}` : `Ativar ${tipo.nome}`}
                        disabled={alternandoId === tipo.id}
                        onClick={() => void alternarAtivo(tipo)}
                      >
                        <Power className="w-4 h-4 mr-1" />
                        {tipo.ativo ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Excluir ${tipo.nome}`}
                        onClick={() => void excluir(tipo)}
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
            <DialogTitle>{editando ? "Renomear tipo" : "Novo tipo de tarefa"}</DialogTitle>
            <DialogDescription>
              O nome do tipo é o TÍTULO gravado em toda tarefa criada com ele (ex.:
              "Auditoria mensal"). Nome repetido na organização a API recusa; nome é
              obrigatório.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="tipo-nome">
                Nome do tipo *
              </Label>
              <Input
                id="tipo-nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Auditoria mensal"
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
