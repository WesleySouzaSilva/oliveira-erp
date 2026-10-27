import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  atualizarTipoObjeto,
  criarTipoObjeto,
  excluirTipoObjeto,
  listarTiposObjeto,
  type TipoObjeto,
} from "@/lib/api/objetos";

/**
 * Lista Objetos — cadastro de tipo de objeto (a categoria do contrato, ex.: "Arroz").
 * Só admin/ceo escreve (a API devolve 403 para os demais); o menu mostra esta tela
 * apenas para admin/ceo. O sub-objeto (subcategoria) mora na tela irmã SubObjetos.
 */
export default function Objetos() {
  const confirmar = useConfirm();
  const [tipos, setTipos] = useState<TipoObjeto[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<TipoObjeto | null>(null);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      setTipos(await listarTiposObjeto());
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

  const abrirEdicao = (tipo: TipoObjeto) => {
    setEditando(tipo);
    setNome(tipo.tipoObjeto);
    setDialogAberto(true);
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      if (editando) {
        await atualizarTipoObjeto(editando.id, { tipoObjeto: nome.trim() });
        toast.success("Tipo de objeto atualizado.");
      } else {
        await criarTipoObjeto({ tipoObjeto: nome.trim() });
        toast.success("Tipo de objeto criado.");
      }
      setDialogAberto(false);
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (tipo: TipoObjeto) => {
    const confirmado = await confirmar({
      title: `Excluir "${tipo.tipoObjeto}"?`,
      description: "Os sub-objetos deste tipo também serão excluídos.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirTipoObjeto(tipo.id);
      toast.success("Tipo de objeto excluído.");
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        icon={FolderTree}
        title="Objetos"
        subtitle={`${tipos.length} tipo${tipos.length === 1 ? "" : "s"} de objeto cadastrado${tipos.length === 1 ? "" : "s"}`}
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="w-4 h-4 mr-1" /> Novo objeto
          </Button>
        }
      />

      {carregando ? (
        <ListSkeleton />
      ) : tipos.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="Nenhum tipo de objeto"
          description='Cadastre o primeiro tipo (ex.: "Arroz") — ele é o objeto selecionado no contrato.'
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de objeto</TableHead>
                  <TableHead className="w-40 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipos.map((tipo) => (
                  <TableRow key={tipo.id}>
                    <TableCell className="font-medium">{tipo.tipoObjeto}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => abrirEdicao(tipo)}>
                        <Pencil className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => excluir(tipo)}
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
            <DialogTitle>{editando ? "Editar objeto" : "Novo objeto"}</DialogTitle>
            <DialogDescription>
              O tipo de objeto é a categoria do contrato (ex.: Arroz). Nome é obrigatório.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="objeto-nome">
                Tipo de objeto *
              </Label>
              <Input
                id="objeto-nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Arroz"
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
