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
  atualizarSubObjeto,
  criarSubObjeto,
  excluirSubObjeto,
  listarSubObjetos,
  listarTiposObjeto,
  type SubObjeto,
  type TipoObjeto,
} from "@/lib/api/objetos";

/**
 * Lista Sub-Categoria/Objeto — cadastro de sub-objeto (subcategoria) de um tipo,
 * ex.: "Arroz branco" dentro de "Arroz". Só admin/ceo escreve. O contrato usa o
 * TIPO; o sub-objeto entra no processo (futuro), filtrado pelo tipo do contrato.
 */
export default function SubObjetos() {
  const confirmar = useConfirm();
  const [subs, setSubs] = useState<SubObjeto[]>([]);
  const [tipos, setTipos] = useState<TipoObjeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>("");

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<SubObjeto | null>(null);
  const [tipoId, setTipoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarTiposObjeto()
      .then(setTipos)
      .catch((erro) => toast.error(mensagemDeErro(erro)));
  }, []);

  const carregar = async (tipoSelecionado?: string) => {
    setCarregando(true);
    try {
      setSubs(await listarSubObjetos(tipoSelecionado || undefined));
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar(filtroTipo);
  }, [filtroTipo]);

  const abrirNovo = () => {
    setEditando(null);
    setTipoId(filtroTipo || "");
    setDescricao("");
    setDialogAberto(true);
  };

  const abrirEdicao = (sub: SubObjeto) => {
    setEditando(sub);
    setTipoId(sub.tipoObjetoId);
    setDescricao(sub.descricao);
    setDialogAberto(true);
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!tipoId || !descricao.trim()) return;
    setSalvando(true);
    try {
      if (editando) {
        await atualizarSubObjeto(editando.id, { tipoObjetoId: tipoId, descricao: descricao.trim() });
        toast.success("Sub-objeto atualizado.");
      } else {
        await criarSubObjeto({ tipoObjetoId: tipoId, descricao: descricao.trim() });
        toast.success("Sub-objeto criado.");
      }
      setDialogAberto(false);
      await carregar(filtroTipo);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (sub: SubObjeto) => {
    const confirmado = await confirmar({
      title: `Excluir "${sub.descricao}"?`,
      description: `Sub-objeto do tipo ${sub.tipoObjeto ?? "—"}.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirSubObjeto(sub.id);
      toast.success("Sub-objeto excluído.");
      await carregar(filtroTipo);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        icon={Layers}
        title="Sub-Categoria / Objeto"
        subtitle={`${subs.length} sub-objeto${subs.length === 1 ? "" : "s"} cadastrado${subs.length === 1 ? "" : "s"}`}
        actions={
          <Button onClick={abrirNovo} disabled={tipos.length === 0}>
            <Plus className="w-4 h-4 mr-1" /> Novo sub-objeto
          </Button>
        }
      />

      {tipos.length === 0 && !carregando ? (
        <EmptyState
          icon={Layers}
          title="Cadastre um objeto primeiro"
          description="O sub-objeto é uma subcategoria de um tipo de objeto. Vá em Objetos e crie o tipo antes."
        />
      ) : (
        <Card>
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Label className="text-xs text-muted-foreground" htmlFor="filtro-tipo">
              Filtrar por objeto
            </Label>
            <select
              id="filtro-tipo"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={filtroTipo}
              onChange={(evento) => setFiltroTipo(evento.target.value)}
            >
              <option value="">Todos</option>
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.tipoObjeto}
                </option>
              ))}
            </select>
          </div>

          {carregando ? (
            <div className="p-4">
              <ListSkeleton />
            </div>
          ) : subs.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Layers}
                title="Nenhum sub-objeto"
                description="Cadastre as subcategorias de cada objeto (ex.: Arroz branco, Integral)."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Objeto</TableHead>
                    <TableHead>Sub-objeto</TableHead>
                    <TableHead className="w-40 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <Badge variant="secondary">{sub.tipoObjeto ?? "—"}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{sub.descricao}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => abrirEdicao(sub)}>
                          <Pencil className="w-4 h-4 mr-1" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => excluir(sub)}
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
        </Card>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar sub-objeto" : "Novo sub-objeto"}</DialogTitle>
            <DialogDescription>
              O sub-objeto é uma subcategoria do objeto (ex.: Arroz branco dentro de Arroz).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="sub-tipo">
                Objeto *
              </Label>
              <select
                id="sub-tipo"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={tipoId}
                onChange={(evento) => setTipoId(evento.target.value)}
                required
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
              <Label className="text-xs text-muted-foreground" htmlFor="sub-descricao">
                Sub-objeto *
              </Label>
              <Input
                id="sub-descricao"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder="Ex.: Arroz branco"
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando || !tipoId || !descricao.trim()}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
