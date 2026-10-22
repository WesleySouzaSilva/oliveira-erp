import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronsUpDown, FileSignature, ListChecks, Pencil, Plus, Save, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { ContratosClienteDialog } from "@/components/erp/ContratosClienteDialog";
import { ContratosBancoClienteDialog } from "@/components/erp/ContratosBancoClienteDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { listarCidades, listarEstados, semAcento, type Cidade, type Estado } from "@/lib/api/localidade";
import { MaskedInput } from "@/components/ui/masked-input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientes,
  type BuscaClientes,
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

const ESTADOS_CIVIL = ["Solteiro(a)", "Casado(a)", "União Estável", "Divorciado(a)", "Viúvo(a)"];

/**
 * Formulário de cliente — OBJETIVO (pedido do titular 16/10/2026): saíram nacionalidade,
 * profissão, nome da propriedade, área, cultura principal e observações. As colunas
 * continuam no banco (nada de histórico se perde); a API aceita os campos ausentes.
 * Telefone/e-mail/endereço único saíram das seções: agora são listas dinâmicas por
 * cliente (contrato 16/10/2026) e as colunas legadas recebem a linha principal.
 */
interface Formulario {
  nome: string;
  cpfCnpj: string;
  rg: string;
  estadoCivil: string;
}

const FORM_VAZIO: Formulario = {
  nome: "",
  cpfCnpj: "",
  rg: "",
  estadoCivil: "",
};

/** Linha do bloco de telefones. */
interface LinhaTelefone {
  id?: string;
  tipo: string;
  numero: string;
  principal: boolean;
}

/** Linha do bloco de e-mails. */
interface LinhaEmail {
  id?: string;
  email: string;
  principal: boolean;
}

/** Linha do bloco de endereços — cidade/UF/códigos IBGE moram aqui (antes eram globais). */
interface LinhaEndereco {
  id?: string;
  tipo: string;
  logradouro: string;
  municipio: string;
  uf: string;
  ibgeCidade: string;
  ibgeEstado: string;
  cep: string;
  principal: boolean;
}

const TIPOS_TELEFONE = [
  { valor: "celular", rotulo: "Celular" },
  { valor: "fixo", rotulo: "Fixo" },
  { valor: "comercial", rotulo: "Comercial" },
];

const TIPOS_ENDERECO = [
  { valor: "residencial", rotulo: "Residencial" },
  { valor: "empresarial", rotulo: "Empresarial" },
  { valor: "escritorio", rotulo: "Escritório" },
];

/** A primeira linha de cada bloco já nasce preenchida e marcada como principal. */
const novaLinhaTelefone = (principal = false): LinhaTelefone => ({
  tipo: "celular",
  numero: "",
  principal,
});

const novaLinhaEmail = (principal = false): LinhaEmail => ({ email: "", principal });

const novaLinhaEndereco = (principal = false): LinhaEndereco => ({
  tipo: "residencial",
  logradouro: "",
  municipio: "",
  uf: "",
  ibgeCidade: "",
  ibgeEstado: "",
  cep: "",
  principal,
});

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SITUACOES: Record<string, { rotulo: string; classe: string }> = {
  ativo: { rotulo: "Ativo", classe: "bg-green-500/15 text-green-700" },
  encerrado: { rotulo: "Encerrado", classe: "bg-muted text-muted-foreground" },
  rescindido: { rotulo: "Rescindido", classe: "bg-destructive/15 text-destructive" },
  fora_do_escopo: { rotulo: "Fora do escopo", classe: "bg-orange-500/15 text-orange-700" },
};

/** Troca um campo de uma linha da lista dinâmica. */
function mudarLinha<T>(lista: T[], indice: number, mudanca: Partial<T>): T[] {
  return lista.map((linha, i) => (i === indice ? { ...linha, ...mudanca } : linha));
}

/** Marca a linha como principal e desmarca as demais (um principal por bloco). */
function definirPrincipal<T extends { principal: boolean }>(
  lista: T[],
  indice: number,
  marcado: boolean,
): T[] {
  return lista.map((linha, i) => {
    if (i === indice) return { ...linha, principal: marcado };
    return marcado ? { ...linha, principal: false } : linha;
  });
}

/** A linha principal (ou a primeira, quando nenhuma está marcada) vira a coluna legada. */
function linhaPrincipal<T extends { principal: boolean }>(lista: T[]): T | undefined {
  return lista.find((linha) => linha.principal) ?? lista[0];
}

/** Listas do cliente no form: listas vazias/ausentes nascem só com a primeira linha. */
function paraTelefones(cliente: ClienteNovo): LinhaTelefone[] {
  const linhas = (cliente.telefones ?? []).map((telefone) => ({
    id: telefone.id,
    tipo: telefone.tipo || "celular",
    numero: telefone.numero ?? "",
    principal: !!telefone.principal,
  }));
  return linhas.length > 0 ? linhas : [novaLinhaTelefone(true)];
}

function paraEmails(cliente: ClienteNovo): LinhaEmail[] {
  const linhas = (cliente.emails ?? []).map((email) => ({
    id: email.id,
    email: email.email ?? "",
    principal: !!email.principal,
  }));
  return linhas.length > 0 ? linhas : [novaLinhaEmail(true)];
}

function paraEnderecos(cliente: ClienteNovo): LinhaEndereco[] {
  const linhas = (cliente.enderecos ?? []).map((endereco) => ({
    id: endereco.id,
    tipo: endereco.tipo || "residencial",
    logradouro: endereco.logradouro ?? "",
    municipio: endereco.municipio ?? "",
    uf: endereco.uf ?? "",
    ibgeCidade: endereco.ibgeCidade ?? "",
    ibgeEstado: endereco.ibgeEstado ?? "",
    cep: endereco.cep ?? "",
    principal: !!endereco.principal,
  }));
  return linhas.length > 0 ? linhas : [novaLinhaEndereco(true)];
}

function paraFormulario(cliente: ClienteNovo): Formulario {
  return {
    nome: cliente.nome ?? "",
    cpfCnpj: cliente.cpfCnpj ?? "",
    rg: cliente.rg ?? "",
    estadoCivil: cliente.estadoCivil ?? "",
  };
}

function paraDto(
  form: Formulario,
  telefones: LinhaTelefone[],
  emails: LinhaEmail[],
  enderecos: LinhaEndereco[],
): ClienteNovo {
  const vazio = (valor: string) => (valor.trim() ? valor.trim() : null);
  // Compatibilidade: as colunas legadas (1 telefone/e-mail/endereço por cliente) continuam
  // recebendo a linha principal (ou a primeira da lista) junto das 3 listas embutidas.
  const telefonePrincipal = linhaPrincipal(telefones);
  const emailPrincipal = linhaPrincipal(emails);
  const enderecoPrincipal = linhaPrincipal(enderecos);
  return {
    nome: form.nome.trim(),
    cpfCnpj: vazio(form.cpfCnpj),
    rg: vazio(form.rg),
    estadoCivil: vazio(form.estadoCivil),
    endereco: vazio(enderecoPrincipal?.logradouro ?? ""),
    municipio: vazio(enderecoPrincipal?.municipio ?? ""),
    uf: vazio((enderecoPrincipal?.uf ?? "").toUpperCase()),
    cep: vazio(enderecoPrincipal?.cep ?? ""),
    telefone: vazio(telefonePrincipal?.numero ?? ""),
    email: vazio(emailPrincipal?.email ?? ""),
    ibgeCidade: vazio(enderecoPrincipal?.ibgeCidade ?? ""),
    ibgeEstado: vazio(enderecoPrincipal?.ibgeEstado ?? ""),
    telefones: telefones.map((linha) => ({
      id: linha.id,
      tipo: linha.tipo,
      numero: linha.numero.trim(),
      principal: linha.principal,
    })),
    emails: emails.map((linha) => ({
      id: linha.id,
      email: linha.email.trim(),
      principal: linha.principal,
    })),
    enderecos: enderecos.map((linha) => ({
      id: linha.id,
      tipo: linha.tipo,
      logradouro: linha.logradouro.trim(),
      municipio: linha.municipio.trim(),
      uf: linha.uf.trim().toUpperCase(),
      ibgeCidade: linha.ibgeCidade.trim(),
      ibgeEstado: linha.ibgeEstado.trim(),
      cep: linha.cep.trim(),
      principal: linha.principal,
    })),
  };
}

/**
 * Campos em que a busca de texto procura — o select ao lado do campo (decisão do titular,
 * 20/10/2026, mesmo estilo da lista de contratos): nome, CPF/CNPJ ou e-mail.
 */
const CAMPOS_BUSCA: { valor: BuscaClientes; rotulo: string; placeholder: string }[] = [
  { valor: "nome", rotulo: "Nome", placeholder: "Buscar por nome do cliente..." },
  { valor: "cpf_cnpj", rotulo: "CPF/CNPJ", placeholder: "Buscar por CPF ou CNPJ..." },
  { valor: "email", rotulo: "E-mail", placeholder: "Buscar por e-mail..." },
];

export default function Clientes() {
  const navigate = useNavigate();
  const confirmar = useConfirm();
  const [pagina, setPagina] = useState<Pagina<Cliente> | null>(null);
  const [busca, setBusca] = useState("");
  /** Campo em que a busca de texto procura (select ao lado do campo). */
  const [buscaEm, setBuscaEm] = useState<BuscaClientes>("nome");
  const [carregando, setCarregando] = useState(true);
  const [numeroPagina, setNumeroPagina] = useState(0);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  /** Cliente cujos contratos estão abertos no dialog (e se o form de novo já abre). */
  const [contratosDe, setContratosDe] = useState<Cliente | null>(null);
  const [formContratoAberto, setFormContratoAberto] = useState(false);
  /** Cliente cujos contratos COM O BANCO estão abertos no dialog (correção 4). */
  const [contratosBancoDe, setContratosBancoDe] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  /** Múltiplos telefones/e-mails/endereços por cliente (contrato 16/10/2026) — 1ª linha
   * de cada bloco já nasce presente e marcada como principal. */
  const [telefones, setTelefones] = useState<LinhaTelefone[]>([novaLinhaTelefone(true)]);
  const [emails, setEmails] = useState<LinhaEmail[]>([novaLinhaEmail(true)]);
  const [enderecos, setEnderecos] = useState<LinhaEndereco[]>([novaLinhaEndereco(true)]);
  /** Nome de quem já está cadastrado com este mesmo nome+CPF/CNPJ (aviso, 16/10/2026). */
  const [jaCadastrado, setJaCadastrado] = useState<string | null>(null);
  /** Localidade (V16): estados para o código IBGE + cache de cidades por UF (1 carga por UF). */
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidadesPorUf, setCidadesPorUf] = useState<Record<string, Cidade[]>>({});
  const [salvando, setSalvando] = useState(false);

  // Busca ao digitar (mesmo comportamento da tela legada), com debounce para não
  // disparar um pedido por tecla — a primeira carga já sai no efeito de montagem.
  const primeiraBusca = useRef(true);
  const timerBusca = useRef<number | null>(null);

  const campo = (nome: keyof Formulario) => ({
    id: `cliente-${nome}`,
    value: form[nome],
    onChange: (evento: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
  });

  // `campo` usa o padrão da própria chamada: muda o select e chamar `carregar(busca, 0)`
  // já busca no campo novo, sem depender do estado dentro do useCallback.
  const carregar = useCallback(
    async (nome: string, paginaAtual: number, campo: BuscaClientes = buscaEm) => {
      setCarregando(true);
      try {
        const termo = nome.trim();
        const resultado = await listarClientes({
          busca: termo || undefined,
          buscaEm: termo ? campo : undefined,
          page: paginaAtual,
          size: 20,
        });
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
	// eslint-disable-next-line react-hooks/exhaustive-deps -- campo = buscaEm le o estado na hora da chamada
    [navigate],
  );

  useEffect(() => {
    carregar("", 0);
    // Estados (UF + código IBGE) — leitura aberta, carrega uma vez.
    void listarEstados().then(setEstados).catch(() => setEstados([]));
  }, [carregar]);

  // Cidades por UF em cache: as linhas de endereço podem usar UFs diferentes e a mesma
  // UF não precisa ser baixada duas vezes (o datalist das 5.5k cidades é pesado).
  const ufsCarregando = useRef<Set<string>>(new Set());
  const carregarCidades = useCallback(
    (uf: string) => {
      const chave = uf.trim().toUpperCase();
      if (!chave || cidadesPorUf[chave] || ufsCarregando.current.has(chave)) return;
      ufsCarregando.current.add(chave);
      listarCidades(chave)
        .then((lista) => setCidadesPorUf((atual) => ({ ...atual, [chave]: lista })))
        .catch(() => setCidadesPorUf((atual) => ({ ...atual, [chave]: [] })))
        .finally(() => ufsCarregando.current.delete(chave));
    },
    [cidadesPorUf],
  );

  // Edição: as cidades das UFs já escolhidas nas linhas entram no cache no primeiro render.
  const ufsDasLinhas = enderecos
    .map((linha) => linha.uf.trim().toUpperCase())
    .filter(Boolean)
    .join(",");
  useEffect(() => {
    ufsDasLinhas.split(",").filter(Boolean).forEach((uf) => carregarCidades(uf));
  }, [ufsDasLinhas, carregarCidades]);

  /** Trocou a UF da linha: carrega as cidades dela e limpa a cidade (e os códigos) da anterior. */
  const trocarUfEndereco = (indice: number, uf: string) => {
    setEnderecos((atual) => mudarLinha(atual, indice, { uf, municipio: "", ibgeCidade: "", ibgeEstado: "" }));
    carregarCidades(uf);
  };

  /** Digitou/escolheu a cidade da linha: casa com o catálogo da UF e preenche UF + códigos IBGE. */
  const digitarCidadeEndereco = (indice: number, valor: string) => {
    const linha = enderecos[indice];
    const cidades = cidadesPorUf[(linha?.uf ?? "").trim().toUpperCase()] ?? [];
    const cidade = cidades.find((item) => semAcento(item.nome) === semAcento(valor));
    const codigoEstado = estados.find((estado) => estado.uf === cidade?.uf)?.codigoIbge ?? "";
    setEnderecos((atual) =>
      mudarLinha(atual, indice, {
        municipio: valor,
        uf: cidade ? cidade.uf : (linha?.uf ?? ""),
        ibgeCidade: cidade ? cidade.codigoIbge : "",
        ibgeEstado: cidade ? codigoEstado : "",
      }),
    );
  };

  useEffect(() => {
    if (primeiraBusca.current) {
      primeiraBusca.current = false;
      return;
    }
    if (timerBusca.current) window.clearTimeout(timerBusca.current);
    timerBusca.current = window.setTimeout(() => carregar(busca, 0), 300);
    return () => {
      if (timerBusca.current) window.clearTimeout(timerBusca.current);
    };
  }, [busca, carregar]);

  /**
   * Duplicidade em tempo real (pedido do titular 16/10/2026): enquanto o admin preenche
   * NOME + CPF/CNPJ no cadastro novo, checa se já existe a combinação e avisa na hora.
   * Só avisa — salvar continua sendo decisão de quem cadastra.
   */
  const timerDuplicado = useRef<number | null>(null);
  useEffect(() => {
    if (timerDuplicado.current) window.clearTimeout(timerDuplicado.current);
    const digitos = form.cpfCnpj.replace(/\D/g, "");
    if (editando || !form.nome.trim() || digitos.length < 11) {
      setJaCadastrado(null);
      return;
    }
    timerDuplicado.current = window.setTimeout(() => {
      listarClientes({ nome: form.nome.trim(), cpfCnpj: digitos, size: 5 })
        .then((resultado) => {
          const achado = resultado.content.find(
            (cliente) => (cliente.cpfCnpj ?? "").replace(/\D/g, "") === digitos,
          );
          setJaCadastrado(achado ? achado.nome : null);
        })
        .catch(() => setJaCadastrado(null));
    }, 400);
    return () => {
      if (timerDuplicado.current) window.clearTimeout(timerDuplicado.current);
    };
  }, [form.nome, form.cpfCnpj, editando]);

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
    if (timerBusca.current) window.clearTimeout(timerBusca.current);
    carregar(busca, 0);
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
    // Cada bloco abre com a primeira linha (principal) pronta para digitar
    setTelefones([novaLinhaTelefone(true)]);
    setEmails([novaLinhaEmail(true)]);
    setEnderecos([novaLinhaEndereco(true)]);
    setDialogAberto(true);
  };

  const abrirEdicao = (cliente: Cliente) => {
    setEditando(cliente);
    setForm(paraFormulario(cliente));
    // As listas vêm no GET do cliente; vazias/ausentes nascem só a primeira linha
    setTelefones(paraTelefones(cliente));
    setEmails(paraEmails(cliente));
    setEnderecos(paraEnderecos(cliente));
    setDialogAberto(true);
  };

  /** Pelo menos 1 telefone, 1 e-mail e 1 endereço — e as linhas com os campos obrigatórios. */
  const validarListas = (): string | null => {
    if (telefones.length === 0) return "Informe pelo menos um telefone";
    if (emails.length === 0) return "Informe pelo menos um e-mail";
    if (enderecos.length === 0) return "Informe pelo menos um endereço";
    if (telefones.some((linha) => !linha.numero.trim())) {
      return "Preencha o número de todos os telefones";
    }
    if (emails.some((linha) => !linha.email.trim() || !EMAIL_VALIDO.test(linha.email.trim()))) {
      return "Preencha um e-mail válido em todas as linhas";
    }
    if (enderecos.some((linha) => !linha.logradouro.trim() || !linha.municipio.trim() || !linha.uf.trim())) {
      return "Preencha logradouro, cidade e UF de todos os endereços";
    }
    return null;
  };

  /**
   * Salva o cliente. Com `gerarContrato` (botão "Salvar e gerar contrato"), fecha o
   * cadastro e abre o formulário de contrato do cliente recém-salvo.
   */
  const salvar = async (evento: React.FormEvent | React.MouseEvent, gerarContrato = false) => {
    evento.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    const problemaNasListas = validarListas();
    if (problemaNasListas) {
      toast.error(problemaNasListas);
      return;
    }

    setSalvando(true);
    try {
      const dados = paraDto(form, telefones, emails, enderecos);
      let clienteSalvo: Cliente | null = null;
      if (editando) {
        clienteSalvo = await atualizarCliente(editando.id, dados);
        toast.success("Cliente atualizado");
      } else {
        clienteSalvo = await criarCliente(dados);
        toast.success("Cliente cadastrado");
      }
      setDialogAberto(false);
      await carregar(busca, numeroPagina);
      if (gerarContrato && clienteSalvo) {
        setContratosDe(clienteSalvo);
        setFormContratoAberto(true);
      }
    } catch (erro) {
      const campos = erro instanceof ErroApi && erro.campos.length > 0 ? erro.campos : null;
      toast.error(campos ? `${campos[0].nome}: ${campos[0].mensagem}` : mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const campoBuscaPlaceholder =
    CAMPOS_BUSCA.find((opcao) => opcao.valor === buscaEm)?.placeholder ?? CAMPOS_BUSCA[0].placeholder;

  const clientes = pagina?.content ?? [];
  const total = pagina?.page.totalElements ?? 0;
  const primeiro = pagina?.page.first ?? true;
  const ultimo = pagina?.page.last ?? true;

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6">
      <PageHeader
        icon={Users}
        title="Clientes"
        subtitle={`${total} cliente${total === 1 ? "" : "s"} cadastrado${total === 1 ? "" : "s"}`}
        breadcrumb={[{ label: "Módulos na API" }, { label: "Clientes" }]}
        actions={
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all"
          >
            <UserPlus className="w-4 h-4" /> Novo Cliente
          </button>
        }
      />

      {/* Busca com TIPO (mesmo estilo da lista de contratos): escolhe onde procurar —
          nome, CPF/CNPJ ou e-mail — e digita o texto. */}
      <form onSubmit={buscar} className="flex items-center gap-2 mb-2">
        <select
          aria-label="Tipo de busca"
          value={buscaEm}
          onChange={(evento) => {
            const novoCampo = evento.target.value as BuscaClientes;
            setBuscaEm(novoCampo);
            if (timerBusca.current) window.clearTimeout(timerBusca.current);
            carregar(busca, 0, novoCampo);
          }}
          className="h-10 w-40 shrink-0 rounded-md border border-input bg-background px-3 text-sm"
        >
          {CAMPOS_BUSCA.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={campoBuscaPlaceholder}
            aria-label={campoBuscaPlaceholder}
            className="pl-9"
          />
        </div>
      </form>

      {carregando && !pagina ? (
        <ListSkeleton rows={6} />
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={
            busca
              ? "Tente outro termo ou troque o tipo de busca."
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
                        <Button
                          size="sm"
                          variant="ghost"
                          title={`Nova tarefa para ${cliente.nome}`}
                          onClick={() =>
                            navigate("/erp/tarefas", {
                              state: { cliente: { id: cliente.id, nome: cliente.nome } },
                            })
                          }
                        >
                          <ListChecks className="w-4 h-4 mr-1" /> Nova tarefa
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              title={`Contratos de ${cliente.nome}`}
                            >
                              <FileSignature className="w-4 h-4 mr-1" /> Contratos
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Duas visões (correção 4): com o ESCRITÓRIO (dialog antigo,
                                inalterado) e com o BANCO (dialog novo, client-scoped) */}
                            <DropdownMenuItem
                              onSelect={() => {
                                setContratosDe(cliente);
                                setFormContratoAberto(false);
                              }}
                            >
                              Com o escritório
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setContratosBancoDe(cliente)}>
                              Com o banco
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Identificação</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="cliente-nome">Nome do Cliente / Produtor *</Label>
                  <Input {...campo("nome")} placeholder="Nome completo" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="cliente-cpfCnpj">CPF/CNPJ *</Label>
                  <MaskedInput
                    id="cliente-cpfCnpj"
                    mask="cpfCnpj"
                    value={form.cpfCnpj}
                    onChange={(v) => setForm((atual) => ({ ...atual, cpfCnpj: v }))}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="cliente-rg">RG (opcional)</Label>
                  <Input {...campo("rg")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="cliente-estadoCivil">Estado civil *</Label>
                  <select
                    id="cliente-estadoCivil"
                    required
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.estadoCivil}
                    onChange={(e) => setForm((atual) => ({ ...atual, estadoCivil: e.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {ESTADOS_CIVIL.map((estado) => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Múltiplos telefones (contrato 16/10/2026): uma linha por número, um principal */}
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Telefones</h3>
              {telefones.map((linha, indice) => (
                <div
                  key={linha.id ?? `telefone-${indice}`}
                  className="grid gap-3 sm:grid-cols-[150px_1fr_auto] sm:items-end"
                >
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground" htmlFor={`cliente-telefone-tipo-${indice}`}>
                      Tipo
                    </Label>
                    <select
                      id={`cliente-telefone-tipo-${indice}`}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={linha.tipo}
                      onChange={(e) => setTelefones((atual) => mudarLinha(atual, indice, { tipo: e.target.value }))}
                    >
                      {TIPOS_TELEFONE.map((tipo) => (
                        <option key={tipo.valor} value={tipo.valor}>{tipo.rotulo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground" htmlFor={`cliente-telefone-numero-${indice}`}>
                      Número *
                    </Label>
                    <MaskedInput
                      id={`cliente-telefone-numero-${indice}`}
                      mask="telefone"
                      value={linha.numero}
                      onChange={(valor) => setTelefones((atual) => mudarLinha(atual, indice, { numero: valor }))}
                      placeholder="(00) 00000-0000"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3 pb-2.5">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={linha.principal}
                        onChange={(e) => setTelefones((atual) => definirPrincipal(atual, indice, e.target.checked))}
                      />
                      Principal
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      title="Remover telefone"
                      className="text-destructive hover:text-destructive"
                      disabled={telefones.length === 1}
                      onClick={() => setTelefones((atual) => atual.filter((_, i) => i !== indice))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTelefones((atual) => [...atual, novaLinhaTelefone()])}
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar telefone
              </Button>
            </section>

            {/* Múltiplos e-mails: uma linha por endereço eletrônico, um principal */}
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">E-mails</h3>
              {emails.map((linha, indice) => (
                <div key={linha.id ?? `email-${indice}`} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground" htmlFor={`cliente-email-${indice}`}>
                      E-mail *
                    </Label>
                    <Input
                      id={`cliente-email-${indice}`}
                      type="email"
                      placeholder="email@exemplo.com"
                      autoComplete="off"
                      required
                      value={linha.email}
                      onChange={(e) => setEmails((atual) => mudarLinha(atual, indice, { email: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-3 pb-2.5">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={linha.principal}
                        onChange={(e) => setEmails((atual) => definirPrincipal(atual, indice, e.target.checked))}
                      />
                      Principal
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      title="Remover e-mail"
                      className="text-destructive hover:text-destructive"
                      disabled={emails.length === 1}
                      onClick={() => setEmails((atual) => atual.filter((_, i) => i !== indice))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEmails((atual) => [...atual, novaLinhaEmail()])}
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar e-mail
              </Button>
            </section>

            {/* Múltiplos endereços: cidade/UF da linha alimentam o datalist (V16) e os códigos IBGE */}
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Endereços</h3>
              {enderecos.map((linha, indice) => (
                <div key={linha.id ?? `endereco-${indice}`} className="rounded-lg border border-border/70 p-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground" htmlFor={`cliente-endereco-tipo-${indice}`}>
                        Tipo
                      </Label>
                      <select
                        id={`cliente-endereco-tipo-${indice}`}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={linha.tipo}
                        onChange={(e) => setEnderecos((atual) => mudarLinha(atual, indice, { tipo: e.target.value }))}
                      >
                        {TIPOS_ENDERECO.map((tipo) => (
                          <option key={tipo.valor} value={tipo.valor}>{tipo.rotulo}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground" htmlFor={`cliente-endereco-cep-${indice}`}>
                        CEP
                      </Label>
                      <MaskedInput
                        id={`cliente-endereco-cep-${indice}`}
                        mask="cep"
                        value={linha.cep}
                        onChange={(valor) => setEnderecos((atual) => mudarLinha(atual, indice, { cep: valor }))}
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="flex items-center gap-3 pb-2.5 sm:justify-end">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={linha.principal}
                          onChange={(e) => setEnderecos((atual) => definirPrincipal(atual, indice, e.target.checked))}
                        />
                        Principal
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        title="Remover endereço"
                        className="text-destructive hover:text-destructive"
                        disabled={enderecos.length === 1}
                        onClick={() => setEnderecos((atual) => atual.filter((_, i) => i !== indice))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground" htmlFor={`cliente-endereco-logradouro-${indice}`}>
                        Logradouro *
                      </Label>
                      <Input
                        id={`cliente-endereco-logradouro-${indice}`}
                        placeholder="Rua, número, bairro"
                        autoComplete="off"
                        required
                        value={linha.logradouro}
                        onChange={(e) =>
                          setEnderecos((atual) => mudarLinha(atual, indice, { logradouro: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground" htmlFor={`cliente-endereco-uf-${indice}`}>
                        UF *
                      </Label>
                      <select
                        id={`cliente-endereco-uf-${indice}`}
                        required
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={linha.uf}
                        onChange={(e) => trocarUfEndereco(indice, e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {UFS.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {/* Só o nome da cidade na tela; o código IBGE entra sozinho no banco */}
                    <Label className="text-xs text-muted-foreground" htmlFor={`cliente-endereco-cidade-${indice}`}>
                      Cidade *
                    </Label>
                    {/* Combobox de cidades da UF da linha (19/10/2026): virou Popover+Command
                        (igual os objetos de Usuários) porque o datalist do navegador abria
                        o menu colado na lateral do campo. Escolher preenche UF + códigos IBGE. */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          id={`cliente-endereco-cidade-${indice}`}
                          variant="outline"
                          role="combobox"
                          aria-label={linha.uf ? `Cidade (${linha.uf})` : "Cidade"}
                          className="w-full justify-between font-normal h-10"
                          disabled={!linha.uf}
                        >
                          <span className={linha.municipio ? "" : "text-muted-foreground"}>
                            {linha.municipio ||
                              (linha.uf ? "Selecione a cidade..." : "Escolha a UF primeiro")}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0"
                        align="start"
                      >
                        <Command>
                          <CommandInput placeholder={`Buscar cidade em ${linha.uf}...`} />
                          <CommandList>
                            <CommandEmpty>
                              Nenhuma cidade nesta UF — verifique a sigla escolhida.
                            </CommandEmpty>
                            <CommandGroup>
                              {(cidadesPorUf[linha.uf.trim().toUpperCase()] ?? []).map((cidade) => {
                                const marcado = linha.municipio === cidade.nome;
                                return (
                                  <CommandItem
                                    key={cidade.codigoIbge}
                                    value={semAcento(cidade.nome)}
                                    onSelect={() => digitarCidadeEndereco(indice, cidade.nome)}
                                  >
                                    <Check
                                      className={marcado ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"}
                                    />
                                    {cidade.nome}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEnderecos((atual) => [...atual, novaLinhaEndereco()])}
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar endereço
              </Button>
            </section>

            {jaCadastrado && (
              <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-xs">
                Já existe um cliente com este <strong>nome e CPF/CNPJ</strong>:
                {" "}<strong>{jaCadastrado}</strong>. Confira antes de salvar — pode ser o mesmo
                cadastro.
              </div>
            )}

            <DialogFooter className="flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              {!editando && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={salvando}
                  onClick={(evento) => salvar(evento, true)}
                >
                  <FileSignature className="w-4 h-4 mr-1" />
                  Salvar e gerar contrato
                </Button>
              )}
              <button
                type="submit"
                disabled={salvando}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar Cliente"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {contratosDe && (
        <ContratosClienteDialog
          aberto={true}
          onAbertoChange={(aberto) => {
            if (!aberto) setContratosDe(null);
          }}
          clienteId={contratosDe.id}
          clienteNome={contratosDe.nome}
          iniciandoComFormulario={formContratoAberto}
          onContratoCriado={() => void carregar(busca, numeroPagina)}
        />
      )}

      {/* Contratos COM O BANCO do cliente (correção 4) — dialog novo, client-scoped */}
      {contratosBancoDe && (
        <ContratosBancoClienteDialog
          aberto={true}
          onAbertoChange={(aberto) => {
            if (!aberto) setContratosBancoDe(null);
          }}
          clienteId={contratosBancoDe.id}
          clienteNome={contratosBancoDe.nome}
        />
      )}
    </div>
  );
}
