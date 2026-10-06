import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
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
import { ErroApi, mensagemDeErro } from "@/lib/api/http";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientes,
  type Cliente,
  type ClienteNovo,
  type Pagina,
} from "@/lib/api/clientes";

/**
 * Clientes — primeiro módulo migrado do Supabase para a API própria.
 * Lista paginada com busca + cadastro completo (padrão ADVBOX) via `POST/PUT /api/v1/clientes`.
 */

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI",
  "RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const ESTADOS_CIVIL = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável"];

interface Formulario {
  nome: string;
  cpfCnpj: string;
  rg: string;
  orgaoEmissor: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
  endereco: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  nomePropriedade: string;
  culturaPrincipal: string;
  observacoes: string;
  areaHectares: string;
}

const FORM_VAZIO: Formulario = {
  nome: "",
  cpfCnpj: "",
  rg: "",
  orgaoEmissor: "",
  nacionalidade: "",
  estadoCivil: "",
  profissao: "",
  endereco: "",
  municipio: "",
  uf: "",
  cep: "",
  telefone: "",
  email: "",
  nomePropriedade: "",
  culturaPrincipal: "",
  observacoes: "",
  areaHectares: "",
};

const SITUACOES: Record<string, { rotulo: string; classe: string }> = {
  ativo: { rotulo: "Ativo", classe: "bg-green-500/15 text-green-700" },
  encerrado: { rotulo: "Encerrado", classe: "bg-muted text-muted-foreground" },
  rescindido: { rotulo: "Rescindido", classe: "bg-destructive/15 text-destructive" },
  fora_do_escopo: { rotulo: "Fora do escopo", classe: "bg-orange-500/15 text-orange-700" },
};

function paraFormulario(cliente: ClienteNovo): Formulario {
  return {
    nome: cliente.nome ?? "",
    cpfCnpj: cliente.cpfCnpj ?? "",
    rg: cliente.rg ?? "",
    orgaoEmissor: cliente.orgaoEmissor ?? "",
    nacionalidade: cliente.nacionalidade ?? "",
    estadoCivil: cliente.estadoCivil ?? "",
    profissao: cliente.profissao ?? "",
    endereco: cliente.endereco ?? "",
    municipio: cliente.municipio ?? "",
    uf: cliente.uf ?? "",
    cep: cliente.cep ?? "",
    telefone: cliente.telefone ?? "",
    email: cliente.email ?? "",
    nomePropriedade: cliente.nomePropriedade ?? "",
    culturaPrincipal: cliente.culturaPrincipal ?? "",
    observacoes: cliente.observacoes ?? "",
    areaHectares: cliente.areaHectares === null || cliente.areaHectares === undefined ? "" : String(cliente.areaHectares),
  };
}

function paraDto(form: Formulario): ClienteNovo {
  const vazio = (valor: string) => (valor.trim() ? valor.trim() : null);
  const area = form.areaHectares.trim().replace(",", ".");
  return {
    nome: form.nome.trim(),
    cpfCnpj: vazio(form.cpfCnpj),
    rg: vazio(form.rg),
    orgaoEmissor: vazio(form.orgaoEmissor),
    nacionalidade: vazio(form.nacionalidade),
    estadoCivil: vazio(form.estadoCivil),
    profissao: vazio(form.profissao),
    endereco: vazio(form.endereco),
    municipio: vazio(form.municipio),
    uf: vazio(form.uf)?.toUpperCase() ?? null,
    cep: vazio(form.cep),
    telefone: vazio(form.telefone),
    email: vazio(form.email),
    nomePropriedade: vazio(form.nomePropriedade),
    culturaPrincipal: vazio(form.culturaPrincipal),
    observacoes: vazio(form.observacoes),
    areaHectares: area ? Number(area) : null,
  };
}

export default function Clientes() {
  const navigate = useNavigate();
  const confirmar = useConfirm();
  const [pagina, setPagina] = useState<Pagina<Cliente> | null>(null);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [numeroPagina, setNumeroPagina] = useState(0);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const campo = (nome: keyof Formulario) => ({
    id: `cliente-${nome}`,
    value: form[nome],
    onChange: (evento: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
  });

  const carregar = useCallback(
    async (nome: string, paginaAtual: number) => {
      setCarregando(true);
      try {
        const resultado = await listarClientes({ nome: nome.trim() || undefined, page: paginaAtual, size: 20 });
        setPagina(resultado);
        setNumeroPagina(resultado.page.number);
      } catch (erro) {
        if (erro instanceof ErroApi && erro.status === 401) {
          navigate("/erp/entrar", { replace: true });
          return;
        }
        toast.error(mensagemDeErro(erro));
        setPagina({ content: [], page: { size: 20, number: 0, totalElements: 0, totalPages: 0, first: true, last: true } });
      } finally {
        setCarregando(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    carregar("", 0);
  }, [carregar]);

  const excluir = async (cliente: Cliente) => {
    const confirmado = await confirmar({
      title: `Excluir "${cliente.nome}"?`,
      description:
        "A exclusão é lógica: o cliente sai das listagens e o nome fica livre para um novo cadastro. A trilha permanece para auditoria.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;

    try {
      await excluirCliente(cliente.id);
      toast.success("Cliente excluído");
      // última linha da página? volta uma para não cair numa página vazia
      const ultimaDaPagina = (pagina?.content.length ?? 0) === 1 && numeroPagina > 0;
      await carregar(busca, ultimaDaPagina ? numeroPagina - 1 : numeroPagina);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) {
        navigate("/erp/entrar", { replace: true });
        return;
      }
      toast.error(mensagemDeErro(erro));
    }
  };

  const buscar = (evento: React.FormEvent) => {
    evento.preventDefault();
    carregar(busca, 0);
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
    setDialogAberto(true);
  };

  const abrirEdicao = (cliente: Cliente) => {
    setEditando(cliente);
    setForm(paraFormulario(cliente));
    setDialogAberto(true);
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("E-mail inválido");
      return;
    }

    setSalvando(true);
    try {
      const dados = paraDto(form);
      if (editando) {
        await atualizarCliente(editando.id, dados);
        toast.success("Cliente atualizado");
      } else {
        await criarCliente(dados);
        toast.success("Cliente cadastrado");
      }
      setDialogAberto(false);
      await carregar(busca, numeroPagina);
    } catch (erro) {
      const campos = erro instanceof ErroApi && erro.campos.length > 0 ? erro.campos : null;
      toast.error(campos ? `${campos[0].nome}: ${campos[0].mensagem}` : mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const clientes = pagina?.content ?? [];
  const total = pagina?.page.totalElements ?? 0;
  const primeiro = pagina?.page.first ?? true;
  const ultimo = pagina?.page.last ?? true;

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6">
      <PageHeader
        icon={Users}
        title="Clientes"
        subtitle="Cadastro de clientes da organização — direto na API própria"
        breadcrumb={[{ label: "Módulos na API" }, { label: "Clientes" }]}
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="w-4 h-4 mr-2" /> Novo cliente
          </Button>
        }
      />

      <Card className="p-4">
        <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <Label htmlFor="cliente-busca">Buscar por nome</Label>
            <Input
              id="cliente-busca"
              value={busca}
              placeholder="Ex.: Fazenda Santa Clara"
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={carregando}>
            <Search className="w-4 h-4 mr-2" /> Buscar
          </Button>
        </form>
      </Card>

      {carregando && !pagina ? (
        <ListSkeleton rows={6} />
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={
            busca
              ? "Tente outro nome ou limpe a busca."
              : "Cadastre o primeiro cliente para começar a usar o módulo."
          }
          action={{ label: "Novo cliente", onClick: abrirNovo }}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Município</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => {
                  const situacao = SITUACOES[cliente.situacao] ?? {
                    rotulo: cliente.situacao,
                    classe: "bg-muted text-muted-foreground",
                  };
                  return (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">
                        {cliente.nome}
                        {cliente.nomePropriedade && (
                          <span className="block text-xs text-muted-foreground">
                            {cliente.nomePropriedade}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{cliente.cpfCnpj || "—"}</TableCell>
                      <TableCell>
                        {cliente.municipio ? `${cliente.municipio}${cliente.uf ? `/${cliente.uf}` : ""}` : "—"}
                      </TableCell>
                      <TableCell>{cliente.telefone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={situacao.classe}>
                          {situacao.rotulo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => abrirEdicao(cliente)}>
                          <Pencil className="w-4 h-4 mr-1" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => excluir(cliente)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
            <span>
              {total} cliente{total === 1 ? "" : "s"} · página {numeroPagina + 1} de{" "}
              {pagina?.page.totalPages || 1}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={primeiro || carregando}
                onClick={() => carregar(busca, Math.max(numeroPagina - 1, 0))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={ultimo || carregando}
                onClick={() => carregar(busca, numeroPagina + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Altere os dados do cadastro. Escopo, dono do cadastro e situação não mudam."
                : "Cadastro completo do cliente (padrão ADVBOX). Nome é obrigatório."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={salvar} className="space-y-5">
            <section className="space-y-3">
              <h3 className="font-serif font-bold text-sm">Identificação</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="cliente-nome">Nome *</Label>
                  <Input {...campo("nome")} placeholder="Nome ou razão social do cliente" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-cpfCnpj">CPF/CNPJ</Label>
                  <Input {...campo("cpfCnpj")} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-rg">RG</Label>
                  <Input {...campo("rg")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-orgaoEmissor">Órgão emissor</Label>
                  <Input {...campo("orgaoEmissor")} placeholder="Ex.: DETRAN/GO" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-nacionalidade">Nacionalidade</Label>
                  <Input {...campo("nacionalidade")} placeholder="Brasileira" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-estadoCivil">Estado civil</Label>
                  <select
                    id="cliente-estadoCivil"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.estadoCivil}
                    onChange={(e) => setForm((atual) => ({ ...atual, estadoCivil: e.target.value }))}
                  >
                    <option value="">—</option>
                    {ESTADOS_CIVIL.map((estado) => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-profissao">Profissão</Label>
                  <Input {...campo("profissao")} placeholder="Produtor Rural" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-email">E-mail</Label>
                  <Input {...campo("email")} type="email" placeholder="cliente@exemplo.com" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-bold text-sm">Contato e endereço</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-telefone">Telefone</Label>
                  <Input {...campo("telefone")} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-cep">CEP</Label>
                  <Input {...campo("cep")} placeholder="00000-000" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="cliente-endereco">Endereço</Label>
                  <Input {...campo("endereco")} placeholder="Rua, número, bairro" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-municipio">Município</Label>
                  <Input {...campo("municipio")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-uf">UF</Label>
                  <select
                    id="cliente-uf"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.uf}
                    onChange={(e) => setForm((atual) => ({ ...atual, uf: e.target.value }))}
                  >
                    <option value="">—</option>
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-bold text-sm">Propriedade</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-nomePropriedade">Nome da propriedade</Label>
                  <Input {...campo("nomePropriedade")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-areaHectares">Área (hectares)</Label>
                  <Input {...campo("areaHectares")} inputMode="decimal" placeholder="320,5" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-culturaPrincipal">Cultura principal</Label>
                  <Input {...campo("culturaPrincipal")} placeholder="Soja" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="cliente-observacoes">Observações</Label>
                  <textarea
                    id="cliente-observacoes"
                    className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.observacoes}
                    onChange={(e) => setForm((atual) => ({ ...atual, observacoes: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
