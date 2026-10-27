import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Landmark, Pencil, Plus, Power, Trash2 } from "lucide-react";
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
  atualizarBanco,
  criarBanco,
  excluirBanco,
  listarBancos,
  type Banco,
} from "@/lib/api/bancos";

/**
 * Bancos — cadastro que alimenta o select "Banco" do formulário de contrato do Comercial
 * (correção 5): substitui a lista FIXA de 18 nomes que vivia no `ContratoBancoForm`.
 * Clone do cadastro de Tipos de tarefa (padrão CRUD das telas admin).
 *
 * Leitura aberta a qualquer autenticado (o form de contrato busca a lista a cada
 * abertura); escrita só admin/ceo — o menu mostra esta tela no grupo Cadastro só para
 * admin/ceo e a API responde 403 para os demais.
 *
 * Ao excluir, a API não mexe nos contratos já gravados: cada contrato existente MANTÉM o
 * nome do banco no seu registro — o banco some só do seletor de novos contratos. O
 * confirma avisa exatamente isso.
 */
export default function Bancos() {
  const confirmar = useConfirm();
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Banco | null>(null);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  /** Id do banco cujo ativo está sendo trocado (deixa o botão da linha ocupado). */
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      // A API devolve os dois lados (ativos e desligados) — filtrar é daqui.
      setBancos(await listarBancos());
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

  const abrirEdicao = (banco: Banco) => {
    setEditando(banco);
    setNome(banco.nome);
    setDialogAberto(true);
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      if (editando) {
        // PUT /bancos/{id} espera o estado completo: nome novo + ativo atual.
        await atualizarBanco(editando.id, { nome: nome.trim(), ativo: editando.ativo });
        toast.success("Banco atualizado.");
      } else {
        await criarBanco({ nome: nome.trim() });
        toast.success("Banco criado.");
      }
      setDialogAberto(false);
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  /** Ativar/desativar: o banco desligado sai do seletor do form, mas fica na lista. */
  const alternarAtivo = async (banco: Banco) => {
    const ativo = !banco.ativo;
    setAlternandoId(banco.id);
    try {
      await atualizarBanco(banco.id, { nome: banco.nome, ativo });
      toast.success(ativo ? `Banco "${banco.nome}" ativado.` : `Banco "${banco.nome}" desativado.`);
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setAlternandoId(null);
    }
  };

  const excluir = async (banco: Banco) => {
    const confirmado = await confirmar({
      title: `Excluir o banco "${banco.nome}"?`,
      description:
        "Os contratos existentes MANTÊM o nome deste banco já gravado neles — a exclusão só tira o banco do seletor de novos contratos (os inativos fazem o mesmo sem apagar nada). Excluir mesmo assim?",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirBanco(banco.id);
      toast.success("Banco excluído.");
      await carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        icon={Landmark}
        title="Bancos"
        subtitle={`${bancos.length} banco${bancos.length === 1 ? "" : "s"} cadastrado${bancos.length === 1 ? "" : "s"}`}
        breadcrumb={[{ label: "Módulos na API" }, { label: "Cadastro" }, { label: "Bancos" }]}
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="w-4 h-4 mr-1" /> Novo banco
          </Button>
        }
      />

      {carregando ? (
        <ListSkeleton />
      ) : bancos.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Nenhum banco cadastrado"
          description='Cadastre o primeiro banco (ex.: "Sicoob") — ele aparece no seletor "Banco" do formulário de contrato do Comercial; o "Outro" do form continua valendo para nome livre.'
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
                {bancos.map((banco) => (
                  <TableRow key={banco.id}>
                    <TableCell className="font-medium">{banco.nome}</TableCell>
                    <TableCell>
                      <Badge variant={banco.ativo ? "default" : "outline"}>
                        {banco.ativo ? "ativo" : "inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Renomear ${banco.nome}`}
                        onClick={() => abrirEdicao(banco)}
                      >
                        <Pencil className="w-4 h-4 mr-1" /> Renomear
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={banco.ativo ? `Desativar ${banco.nome}` : `Ativar ${banco.nome}`}
                        disabled={alternandoId === banco.id}
                        onClick={() => void alternarAtivo(banco)}
                      >
                        <Power className="w-4 h-4 mr-1" />
                        {banco.ativo ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Excluir ${banco.nome}`}
                        onClick={() => void excluir(banco)}
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
            <DialogTitle>{editando ? "Renomear banco" : "Novo banco"}</DialogTitle>
            <DialogDescription>
              O nome é o que aparece no seletor "Banco" do formulário de contrato do
              Comercial. Nome repetido na organização a API recusa (409); nome é
              obrigatório.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="banco-nome">
                Nome do banco *
              </Label>
              <Input
                id="banco-nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Sicoob"
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
