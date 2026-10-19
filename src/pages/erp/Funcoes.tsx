import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  atualizarFuncao,
  criarFuncao,
  excluirFuncao,
  listarFuncoes,
  type Funcao,
} from "@/lib/api/funcoes";

/**
 * Funções — cadastro dos cargos/funções da empresa (pedido do titular em 16/10/2026).
 *
 * Era uma lista fixa de 21 valores (enum `Papel.java`); agora o admin cria, edita,
 * desativa e apaga as funções daqui, e o select **Função** do cadastro de usuário
 * passa a vir deste catálogo. A `chave` (slug) sai do nome na API e é o valor
 * gravado em `membros.papel` — renomear não quebra quem já está com a função.
 *
 * Proteções da API: `admin` não pode ser apagada (é perfil de acesso, não cargo)
 * e função usada por alguém responde 409 — primeiro troque as pessoas de função.
 *
 * Só admin/ceo escreve (a API devolve 403 para os demais) — o menu mostra esta
 * tela só para admin/ceo.
 */
export default function Funcoes() {
  const confirmar = useConfirm();
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Funcao | null>(null);
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      setFuncoes(await listarFuncoes());
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
    setAtivo(true);
    setDialogAberto(true);
  };

  const abrirEdicao = (funcao: Funcao) => {
    setEditando(funcao);
    setNome(funcao.nome);
    setAtivo(funcao.ativo !== false);
    setDialogAberto(true);
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      if (editando) {
        await atualizarFuncao(editando.id, { nome: nome.trim(), ativo });
        toast.success("Função atualizada.");
      } else {
        await criarFuncao({ nome: nome.trim() });
        toast.success("Função criada.");
      }
      setDialogAberto(false);
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (funcao: Funcao) => {
    const confirmado = await confirmar({
      title: `Excluir a função "${funcao.nome}"?`,
      description:
        "Funções usadas por alguém não podem ser excluídas — primeiro troque a função dessas pessoas. A função admin é protegida (é perfil de acesso).",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirFuncao(funcao.id);
      toast.success("Função excluída.");
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        icon={Briefcase}
        title="Funções"
        subtitle={`${funcoes.length} função${funcoes.length === 1 ? "" : "s"} cadastrada${funcoes.length === 1 ? "" : "s"}`}
        breadcrumb={[{ label: "Módulos na API" }, { label: "Cadastro" }, { label: "Funções" }]}
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="w-4 h-4 mr-1" /> Nova função
          </Button>
        }
      />

      {carregando ? (
        <ListSkeleton />
      ) : funcoes.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhuma função"
          description='Cadastre as funções da empresa (ex.: "Advogado", "Pós-Venda") — é o que a pessoa escolhe no campo Função do cadastro de usuário.'
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-40 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funcoes.map((funcao) => (
                  <TableRow key={funcao.id}>
                    <TableCell className="font-medium">{funcao.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{funcao.chave}</TableCell>
                    <TableCell>{funcao.ordem ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={funcao.ativo === false ? "outline" : "default"}>
                        {funcao.ativo === false ? "inativa" : "ativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => abrirEdicao(funcao)}>
                        <Pencil className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => excluir(funcao)}
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
            <DialogTitle>{editando ? "Editar função" : "Nova função"}</DialogTitle>
            <DialogDescription>
              A função é o cargo da pessoa na empresa (ex.: Advogado, Pós-Venda). Renomear não
              quebra nada: quem já está com a função continua com ela. Nome é obrigatório.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="funcao-nome">
                Nome da função *
              </Label>
              <Input
                id="funcao-nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Advogado de Pós-Venda"
                required
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="funcao-ativo"
                checked={ativo}
                onCheckedChange={(valor) => setAtivo(valor === true)}
              />
              <Label htmlFor="funcao-ativo" className="text-sm cursor-pointer">
                Ativa (aparece no cadastro de usuário)
              </Label>
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
