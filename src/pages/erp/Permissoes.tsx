import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
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
  atualizarGrupoPermissao,
  criarGrupoPermissao,
  excluirGrupoPermissao,
  listarGruposPermissoes,
  type GrupoPermissao,
} from "@/lib/api/permissoes";
import { MODULE_CATALOG } from "@/lib/permissionModules";

/**
 * Permissões — cadastro dos GRUPOS de permissão (pedido do titular em 16/10/2026).
 *
 * Um grupo = uma permissão nomeada ("Comercial", "Jurídico") que libera os MÓDULOS
 * marcados. A regra é GROSSA de propósito: quem tem o módulo, tem ler, cadastrar,
 * editar e excluir naquele módulo — nada de permissão por ação, para não multiplicar
 * regras (decisão do titular). O admin atribui o grupo à pessoa na tela Usuários.
 *
 * Só admin/ceo escreve (a API devolve 403 para os demais).
 */
export default function Permissoes() {
  const confirmar = useConfirm();
  const [grupos, setGrupos] = useState<GrupoPermissao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<GrupoPermissao | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modulos, setModulos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      setGrupos((await listarGruposPermissoes()).content);
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
    setDescricao("");
    setModulos([]);
    setDialogAberto(true);
  };

  const abrirEdicao = (grupo: GrupoPermissao) => {
    setEditando(grupo);
    setNome(grupo.nome);
    setDescricao(grupo.descricao ?? "");
    setModulos(grupo.modulos ?? []);
    setDialogAberto(true);
  };

  const alternarModulo = (chave: string) =>
    setModulos((atual) =>
      atual.includes(chave) ? atual.filter((item) => item !== chave) : [...atual, chave],
    );

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!nome.trim()) return;
    if (modulos.length === 0) {
      toast.error("Marque ao menos um módulo — sem módulos a permissão não libera nada");
      return;
    }
    setSalvando(true);
    try {
      const dados = { nome: nome.trim(), descricao: descricao.trim() || null, modulos };
      if (editando) {
        await atualizarGrupoPermissao(editando.id, dados);
        toast.success("Permissão atualizada.");
      } else {
        await criarGrupoPermissao(dados);
        toast.success("Permissão criada.");
      }
      setDialogAberto(false);
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (grupo: GrupoPermissao) => {
    const confirmado = await confirmar({
      title: `Excluir a permissão "${grupo.nome}"?`,
      description:
        "As pessoas que usavam este grupo ficam sem permissão atribuída (voltam ao padrão do papel). Nada é apagado delas.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirGrupoPermissao(grupo.id);
      toast.success("Permissão excluída.");
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  const rotuloModulo = (chave: string) =>
    MODULE_CATALOG.find((modulo) => modulo.key === chave)?.label ?? chave;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        icon={ShieldCheck}
        title="Permissões"
        subtitle={`${grupos.length} permissão${grupos.length === 1 ? "" : "s"} cadastrada${grupos.length === 1 ? "" : "s"}`}
        breadcrumb={[{ label: "Módulos na API" }, { label: "Permissões" }]}
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="w-4 h-4 mr-1" /> Nova permissão
          </Button>
        }
      />

      <p className="text-xs text-muted-foreground bg-secondary/50 rounded-md p-3">
        Regra simples (decisão de 16/10/2026): cada permissão é um conjunto de <strong>módulos</strong>;
        quem tem o módulo marcado pode <strong>ler, cadastrar, editar e excluir</strong> naquela área —
        sem permissões separadas por ação, para não complicar. Atribua a permissão à pessoa na tela
        <strong> Usuários</strong>.
      </p>

      {carregando ? (
        <ListSkeleton />
      ) : grupos.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhuma permissão"
          description='Cadastre a primeira (ex.: "Comercial" com os módulos Comercial e Clientes) e atribua nas pessoas.'
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permissão</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Módulos (libera ler/cadastrar/editar/excluir)</TableHead>
                  <TableHead className="w-40 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((grupo) => (
                  <TableRow key={grupo.id}>
                    <TableCell className="font-medium">{grupo.nome}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[16rem] truncate">
                      {grupo.descricao ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(grupo.modulos ?? []).map((chave) => (
                          <Badge key={chave} variant="secondary">
                            {rotuloModulo(chave)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => abrirEdicao(grupo)}>
                        <Pencil className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => excluir(grupo)}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar permissão" : "Nova permissão"}</DialogTitle>
            <DialogDescription>
              Dê um nome à permissão (ex.: "Comercial") e marque os módulos que ela libera. Quem
              tem o módulo pode ler, cadastrar, editar e excluir nele.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="permissao-nome">
                Nome da permissão *
              </Label>
              <Input
                id="permissao-nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Comercial"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="permissao-descricao">
                Descrição
              </Label>
              <Input
                id="permissao-descricao"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder="Ex.: equipe de vendas — clientes, contratos e métricas"
                maxLength={240}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Módulos liberados *</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODULE_CATALOG.map((modulo) => (
                  <label
                    key={modulo.key}
                    className="flex items-start gap-2 rounded-md border border-border p-2.5 cursor-pointer hover:bg-secondary/40"
                  >
                    <Checkbox
                      checked={modulos.includes(modulo.key)}
                      onCheckedChange={() => alternarModulo(modulo.key)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        {modulo.label}
                        {modulo.sensivel && (
                          <Badge variant="outline" className="text-[10px]">sensível</Badge>
                        )}
                      </span>
                      {modulo.description && (
                        <span className="text-[11px] text-muted-foreground block leading-snug">
                          {modulo.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando || !nome.trim() || modulos.length === 0}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
