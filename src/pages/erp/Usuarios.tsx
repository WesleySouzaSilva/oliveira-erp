import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Save, Search, UserPlus, Users, X, Check, ChevronsUpDown } from "lucide-react";
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
import { ErroApi, mensagemDeErro, usuarioApi } from "@/lib/api/http";
import {
  atualizarUsuario,
  criarUsuario,
  listarUsuarios,
  type UsuarioAdm,
} from "@/lib/api/usuarios";
import { listarSetores, type Setor } from "@/lib/api/setores";
import { listarFuncoes, type Funcao } from "@/lib/api/funcoes";
import { listarGruposPermissoes, type GrupoPermissao } from "@/lib/api/permissoes";
import { listarTiposObjeto, type TipoObjeto } from "@/lib/api/objetos";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * Usuários — cadastro, edição e listagem DENTRO da plataforma (menu Usuários, admin/ceo).
 * `POST/PATCH/GET /api/v1/usuarios` — decisão do titular de 15/10/2026 (antes o login novo
 * só entrava pelo script deploy/criar-usuario.sh).
 *
 * Dois blocos de vínculo no formulário, que são as duas chaves de visibilidade do sistema:
 * - **Setores** — para onde a tarefa é encaminhada (workflow);
 * - **Objetos (categorias)** — o que a pessoa atende: define o que ela enxerga de contratos,
 *   tarefas e notificações (escopo por `membro_objetos`, decisão 3 do plano).
 */

/**
 * Funções fixas de origem — espelha o antigo `Papel.java` (rótulos em português). A lista
 * oficial passou a vir da API (`/funcoes`, tela **Funções**); esta fica como fallback
 * quando o servidor ainda não tem a rota ou a chamada falha.
 */
const FUNCOES_PADRAO: { value: string; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "coordenador", label: "Coordenador" },
  { value: "gestor_pos_venda", label: "Gestor de Pós-Venda" },
  { value: "pos_venda", label: "Pós-Venda" },
  { value: "advogado_pos_venda", label: "Advogado de Pós-Venda" },
  { value: "estagiario_pos_venda", label: "Estagiário de Pós-Venda" },
  { value: "agronomo", label: "Agrônomo" },
  { value: "engenheiro_agronomo", label: "Eng. Agrônomo" },
  { value: "advogado", label: "Advogado" },
  { value: "assessor_juridico", label: "Assessor Jurídico" },
  { value: "estagiario_direito", label: "Estagiário de Direito" },
  { value: "setor_acordos", label: "Setor de Acordos" },
  { value: "comercial", label: "Comercial" },
  { value: "closer", label: "Closer" },
  { value: "sdr", label: "SDR" },
  { value: "social_seller", label: "Social Seller" },
  { value: "marketing", label: "Marketing" },
  { value: "gerente_marketing", label: "Gerente de Marketing" },
  { value: "criacao", label: "Criação" },
  { value: "copywriter", label: "Copywriter" },
  { value: "social_media", label: "Social Media" },
];

const rotuloPapel = (valor?: string | null) =>
  FUNCOES_PADRAO.find((papel) => papel.value === valor)?.label ?? valor ?? "—";

interface Formulario {
  nome: string;
  email: string;
  senha: string;
  papel: string;
  ativo: string;
}

const FORM_VAZIO: Formulario = { nome: "", email: "", senha: "", papel: "", ativo: "true" };

/** Uma linha do bloco "Setores": em qual setor a pessoa trabalha e o intervalo de valor. */
interface VinculoForm {
  setorId: string;
  valorMin: string;
  valorMax: string;
}

const dinheiroParaNumero = (texto: string): number | null => {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
};

const moeda = (valor: number | null | undefined): string =>
  valor === null || valor === undefined
    ? "—"
    : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Usuarios() {
  // Só o ADMINISTRADOR gerencia pessoas (decisão do titular 16/10/2026): o menu nem
  // aparece para os demais, e a página responde o aviso de acesso restrito.
  const administrador = Boolean(usuarioApi()?.admin);

  const [usuarios, setUsuarios] = useState<UsuarioAdm[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [objetos, setObjetos] = useState<TipoObjeto[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  const [dialogAberto, setDialogAberto] = useState(false);
  /** API do servidor ainda sem a rota /usuarios (500/404) — avisa em vez de fingir lista vazia. */
  const [apiSemRota, setApiSemRota] = useState(false);
  const [editando, setEditando] = useState<UsuarioAdm | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  /** Setores em que a pessoa trabalha + intervalo de valor de cada um (1..N). */
  const [vinculos, setVinculos] = useState<VinculoForm[]>([]);
  const [objetosEscolhidos, setObjetosEscolhidos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  /** Catálogo de funções da API (tela Funções); vazio = servidor sem a rota. */
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  /** Permissões (grupos) cadastradas — o admin escolhe qual a pessoa recebe. */
  const [grupos, setGrupos] = useState<GrupoPermissao[]>([]);
  const [permissaoId, setPermissaoId] = useState("");

  useEffect(() => {
    listarFuncoes()
      .then(setFuncoes)
      .catch(() => setFuncoes([]));
    listarGruposPermissoes()
      .then((pagina) => setGrupos(pagina.content))
      .catch(() => setGrupos([]));
  }, []);

  /** Select da Função: catálogo da API (inativas saem, exceto a que a pessoa já tem). */
  const opcoesFuncao = funcoes.length
    ? funcoes
        .filter((funcao) => funcao.ativo !== false || funcao.chave === form.papel)
        .map((funcao) => ({ value: funcao.chave, label: funcao.nome }))
    : FUNCOES_PADRAO;

  /** Rótulo da função na listagem: catálogo da API, depois o fallback fixo. */
  const rotulo = (valor?: string | null) =>
    funcoes.find((funcao) => funcao.chave === valor)?.nome ?? rotuloPapel(valor);

  const carregar = useCallback(async () => {
    if (!administrador) return;
    setCarregando(true);
    // Carregamentos independentes: setores e objetos vêm do `/setores` + `/tipo-objeto`, a
    // lista de usuários do `/usuarios`. Um endpoint faltando (ex.: API do servidor ainda sem
    // a rota nova) não pode derrubar a página inteira — só o aviso daquele.
    const [usuariosResultado, vinculosResultado] = await Promise.allSettled([
      listarUsuarios(),
      Promise.all([listarSetores(), listarTiposObjeto()]),
    ]);

    if (vinculosResultado.status === "fulfilled") {
      const [listaSetores, listaObjetos] = vinculosResultado.value;
      setSetores(listaSetores);
      setObjetos(listaObjetos);
    } else {
      toast.error(`Não carreguei setores/objetos: ${mensagemDeErro(vinculosResultado.reason)}`);
    }

    if (usuariosResultado.status === "fulfilled") {
      setUsuarios(usuariosResultado.value);
      setApiSemRota(false);
    } else {
      const erro = usuariosResultado.reason;
      if (erro instanceof ErroApi && (erro.status === 404 || erro.status === 500)) {
        setApiSemRota(true);
      } else if (!(erro instanceof ErroApi && erro.status === 403)) {
        toast.error(mensagemDeErro(erro));
      }
      setUsuarios([]);
    }
    setCarregando(false);
  }, [administrador]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const campo = (nome: keyof Formulario) => ({
    id: `usuario-${nome}`,
    value: form[nome],
    onChange: (evento: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
  });

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
    setVinculos([]);
    setObjetosEscolhidos([]);
    setPermissaoId("");
    setDialogAberto(true);
  };

  const abrirEdicao = (usuario: UsuarioAdm) => {
    setEditando(usuario);
    setForm({
      nome: usuario.nome ?? "",
      email: usuario.email,
      senha: "",
      papel: usuario.papel ?? "",
      ativo: usuario.ativo ? "true" : "false",
    });
    setVinculos(
      (usuario.setores ?? []).map((setor) => ({
        setorId: setor.id,
        valorMin: setor.valorMin === null || setor.valorMin === undefined ? "" : String(setor.valorMin),
        valorMax: setor.valorMax === null || setor.valorMax === undefined ? "" : String(setor.valorMax),
      })),
    );
    setObjetosEscolhidos((usuario.objetos ?? []).map((objeto) => objeto.id));
    setPermissaoId(usuario.permissionGroupId ?? "");
    setDialogAberto(true);
  };

  const alternar = (lista: string[], id: string, set: (valor: string[]) => void) =>
    set(lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id]);

  // ---- Setores do formulário: linhas "setor + intervalo de valor" (1..N) ----
  const setoresUsados = new Set(vinculos.map((vinculo) => vinculo.setorId).filter(Boolean));
  const podeAdicionarSetor = setores.some((setor) => !setoresUsados.has(setor.id));

  const adicionarVinculo = () =>
    setVinculos((atual) => [...atual, { setorId: "", valorMin: "", valorMax: "" }]);

  const mudarVinculo = (indice: number, mudanca: Partial<VinculoForm>) =>
    setVinculos((atual) =>
      atual.map((linha, posicao) => (posicao === indice ? { ...linha, ...mudanca } : linha)),
    );

  const removerVinculo = (indice: number) =>
    setVinculos((atual) => atual.filter((_linha, posicao) => posicao !== indice));

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome");
    if (!editando && !form.email.trim()) return toast.error("Informe o e-mail");
    if (!editando && form.senha.length < 8)
      return toast.error("A senha precisa de pelo menos 8 caracteres");
    if (editando && form.senha && form.senha.length < 8)
      return toast.error("A senha precisa de pelo menos 8 caracteres");

    // Setores: 1..N, cada um com o seu intervalo de valor (decisão §8 do plano).
    const linhas = vinculos.filter((vinculo) => vinculo.setorId);
    const ids = linhas.map((vinculo) => vinculo.setorId);
    if (new Set(ids).size !== ids.length) return toast.error("Cada setor pode aparecer uma vez só.");
    if (vinculos.some((vinculo) => !vinculo.setorId))
      return toast.error("Escolha o setor nas linhas de intervalo (ou remova a linha).");
    for (const vinculo of linhas) {
      const minimo = dinheiroParaNumero(vinculo.valorMin);
      const maximo = dinheiroParaNumero(vinculo.valorMax);
      if (minimo !== null && maximo !== null && minimo > maximo)
        return toast.error("Intervalo de valor inválido: o mínimo não pode ser maior que o máximo.");
    }
    const setoresPayload = linhas.map((vinculo) => ({
      setorId: vinculo.setorId,
      valorMin: dinheiroParaNumero(vinculo.valorMin),
      valorMax: dinheiroParaNumero(vinculo.valorMax),
    }));

    setSalvando(true);
    try {
      if (editando) {
        await atualizarUsuario(editando.id, {
          nome: form.nome.trim(),
          papel: form.papel || null,
          senha: form.senha || undefined,
          ativo: form.ativo === "true",
          setores: setoresPayload,
          objetos: objetosEscolhidos,
          // vazio = mantém a permissão atual (a API não limpa com nulo)
          permissionGroupId: permissaoId || undefined,
        });
        toast.success("Usuário atualizado");
      } else {
        await criarUsuario({
          email: form.email.trim(),
          senha: form.senha,
          nome: form.nome.trim(),
          papel: form.papel || null,
          setores: setoresPayload,
          objetos: objetosEscolhidos,
          permissionGroupId: permissaoId || null,
        });
        toast.success("Usuário cadastrado");
      }
      setDialogAberto(false);
      await carregar();
    } catch (erro) {
      const campos = erro instanceof ErroApi && erro.campos.length > 0 ? erro.campos : null;
      toast.error(campos ? `${campos[0].nome}: ${campos[0].mensagem}` : mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  if (!administrador) {
    return (
      <div className="p-4 sm:p-6 lg:p-10">
        <EmptyState
          icon={Users}
          title="Acesso restrito"
          description="A gestão de usuários é feita pelos administradores da organização."
        />
      </div>
    );
  }

  const filtrados = usuarios.filter((usuario) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return (
      (usuario.nome ?? "").toLowerCase().includes(termo) || usuario.email.toLowerCase().includes(termo)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6">
      <PageHeader
        icon={Users}
        title="Usuários"
        subtitle={`${usuarios.length} usuário${usuarios.length === 1 ? "" : "s"} na organização`}
        breadcrumb={[{ label: "Módulos na API" }, { label: "Usuários" }]}
        actions={
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all"
          >
            <UserPlus className="w-4 h-4" /> Novo usuário
          </button>
        }
      />

      <form
        onSubmit={(evento) => evento.preventDefault()}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          aria-label="Buscar usuário por nome ou e-mail"
          className="pl-9"
        />
      </form>

      {carregando ? (
        <ListSkeleton rows={5} />
      ) : apiSemRota ? (
        <EmptyState
          icon={Users}
          title="Cadastro de usuários ainda não publicado"
          description="Esta API não expõe a rota /usuarios (versão nova). Publique a API pelo deploy/publicar-correcoes.sh e abra a tela de novo — setores e objetos já vêm normalmente."
        />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Users}
          title={busca ? "Nenhum usuário encontrado" : "Nenhum usuário"}
          description={
            busca ? "Tente outro nome ou e-mail." : "Cadastre o primeiro usuário da organização."
          }
          action={busca ? undefined : { label: "Novo usuário", onClick: abrirNovo }}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Setores</TableHead>
                  <TableHead>Objetos atendidos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell className="font-medium">
                      {usuario.nome || "—"}
                      {usuario.ceo && (
                        <Badge variant="default" className="ml-2">
                          CEO
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{usuario.email}</TableCell>
                    <TableCell>{rotulo(usuario.papel)}</TableCell>
                    <TableCell>
                      <Badge variant={usuario.ativo ? "default" : "outline"}>
                        {usuario.ativo ? "ativo" : "inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {(usuario.setores ?? []).length === 0 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {(usuario.setores ?? []).map((setor) => (
                          <Badge key={setor.id} variant="secondary">
                            {setor.nome}
                            {setor.valorMin !== null && setor.valorMin !== undefined && (
                              <>
                                {" · "}
                                {moeda(setor.valorMin)}
                                {" – "}
                                {moeda(setor.valorMax)}
                              </>
                            )}
                          </Badge>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {(usuario.objetos ?? []).length === 0 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {(usuario.objetos ?? []).map((objeto) => (
                          <Badge key={objeto.id} variant="outline">
                            {objeto.tipoObjeto}
                          </Badge>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => abrirEdicao(usuario)}>
                        <Pencil className="w-4 h-4 mr-1" /> Editar
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${editando.email}` : "Novo usuário"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Altere os dados, os setores (encaminhamento) e os objetos que a pessoa atende."
                : "Cria o login e o vínculo com a organização. E-mail é obrigatório e precisa ser único por organização."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={salvar} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="usuario-nome">
                  Nome *
                </Label>
                <Input {...campo("nome")} placeholder="Nome completo" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="usuario-email">
                  E-mail *
                </Label>
                <Input
                  {...campo("email")}
                  type="email"
                  placeholder="nome@oliveira.com.br"
                  required
                  readOnly={Boolean(editando)}
                  disabled={Boolean(editando)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="usuario-senha">
                  {editando ? "Nova senha (em branco mantém a atual)" : "Senha * (mínimo 8)"}
                </Label>
                <Input
                  {...campo("senha")}
                  type="password"
                  autoComplete="new-password"
                  placeholder={editando ? "••••••••" : "Mínimo de 8 caracteres"}
                  required={!editando}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="usuario-funcao">
                  Função *
                </Label>
                <select
                  {...campo("papel")}
                  id="usuario-funcao"
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione a função</option>
                  {opcoesFuncao.map((papel) => (
                    <option key={papel.value} value={papel.value}>
                      {papel.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  A função define a atuação da pessoa na plataforma. Cadastre novas funções no
                  menu Cadastro &gt; Funções.
                </p>
              </div>

              {/* Permissão (grupo): o que a pessoa PODE fazer — ver tela Permissões */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="usuario-permissao">
                  Permissão
                </Label>
                <select
                  id="usuario-permissao"
                  value={permissaoId}
                  onChange={(evento) => setPermissaoId(evento.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Sem permissão (acesso básico)</option>
                  {grupos.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>
                      {grupo.nome}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  A permissão abre os módulos do grupo (ler, cadastrar, editar e excluir na área).
                  Cadastre em <strong>Permissões</strong>.
                </p>
              </div>
              {editando && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="usuario-ativo">
                    Situação
                  </Label>
                  <select
                    {...campo("ativo")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo (sem acesso)</option>
                  </select>
                </div>
              )}
            </div>

            <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
              <legend className="text-xs font-semibold text-foreground px-1">
                Setores em que a pessoa trabalha + intervalo de valor
              </legend>

              <p className="text-[11px] text-muted-foreground">
                Cada linha é um setor (ex.: agronegócio, bancário, empresarial) com o intervalo de
                valor de contrato que a pessoa atende nele — a plataforma entrega a tarefa para
                quem cobre o montante do contrato.
              </p>

              <div className="space-y-2">
                {vinculos.map((vinculo, indice) => (
                  <div
                    key={indice}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_2.25rem] items-end"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground" htmlFor={`usuario-setor-${indice}`}>
                        Setor
                      </Label>
                      <select
                        id={`usuario-setor-${indice}`}
                        value={vinculo.setorId}
                        onChange={(evento) => mudarVinculo(indice, { setorId: evento.target.value })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Selecione o setor</option>
                        {setores
                          .filter((setor) => setor.id === vinculo.setorId || !setoresUsados.has(setor.id))
                          .map((setor) => (
                            <option key={setor.id} value={setor.id}>
                              {setor.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground" htmlFor={`usuario-valor-min-${indice}`}>
                        De R$
                      </Label>
                      <Input
                        id={`usuario-valor-min-${indice}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={vinculo.valorMin}
                        onChange={(evento) => mudarVinculo(indice, { valorMin: evento.target.value })}
                        placeholder="10000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground" htmlFor={`usuario-valor-max-${indice}`}>
                        Até R$
                      </Label>
                      <Input
                        id={`usuario-valor-max-${indice}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={vinculo.valorMax}
                        onChange={(evento) => mudarVinculo(indice, { valorMax: evento.target.value })}
                        placeholder="50000"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover setor da linha ${indice + 1}`}
                      onClick={() => removerVinculo(indice)}
                      className="justify-self-end"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {vinculos.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum setor vinculado ainda.</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={adicionarVinculo}
                  disabled={!podeAdicionarSetor}
                  aria-label="Adicionar setor"
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar setor
                </Button>
                {setores.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    Nenhum setor cadastrado — cadastre em Cadastro &gt; Setores.
                  </span>
                )}
              </div>
            </fieldset>

            <fieldset className="space-y-2 rounded-xl border border-border bg-card p-4">
              <legend className="text-xs font-semibold text-foreground px-1">
                Objetos/categorias atendidos (o que a pessoa enxerga)
              </legend>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-label="Objetos atendidos"
                    className="w-full justify-between font-normal"
                  >
                    {objetosEscolhidos.length === 0
                      ? "Selecione os objetos..."
                      : `${objetosEscolhidos.length} objeto${objetosEscolhidos.length === 1 ? "" : "s"} selecionado${objetosEscolhidos.length === 1 ? "" : "s"}`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar objeto..." />
                    <CommandList>
                      <CommandEmpty>
                        Nenhum objeto — cadastre em Cadastro &gt; Objetos.
                      </CommandEmpty>
                      <CommandGroup>
                        {objetos.map((objeto) => {
                          const marcado = objetosEscolhidos.includes(objeto.id);
                          return (
                            <CommandItem
                              key={objeto.id}
                              value={objeto.tipoObjeto}
                              onSelect={() => alternar(objetosEscolhidos, objeto.id, setObjetosEscolhidos)}
                            >
                              <Check
                                className={marcado ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"}
                              />
                              {objeto.tipoObjeto}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {objetosEscolhidos.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {objetosEscolhidos.map((id) => {
                    const objeto = objetos.find((item) => item.id === id);
                    return objeto ? (
                      <Badge key={id} variant="secondary">
                        {objeto.tipoObjeto}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                <Save className="w-4 h-4 mr-1" />
                {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
