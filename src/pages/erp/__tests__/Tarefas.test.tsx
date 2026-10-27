import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import Tarefas from "@/pages/erp/Tarefas";
import {
  anexarArquivosTarefa, baixarAnexoTarefa, criarTarefa, listarArquivosTarefa,
  listarTarefas, listarTiposTarefa,
} from "@/lib/api/tarefas";

/**
 * Tarefas — Fase 4 da correção 5 (`docs/plano-correcoes-comercial-contratos-tarefas.md`):
 *
 * - form reordenado (cliente → processo → TIPO obrigatório → datas → recorrência →
 *   anexos): cria com `tipoId`/`clienteId`/`recorrencia` e o título digitável saiu;
 * - cards de resumo viram filtro (1 por vez, clicar de novo limpa);
 * - anexos escolhidos no form sobem DEPOIS da criação (multipart em tarefa existente);
 * - detalhe exibe tipo/recorrência/prazo fatal e lista os anexos da própria tarefa.
 *
 * As datas do massa vêm de `vi.hoisted` (mesmo cálculo `toISOString` do HOJE da tela);
 * o mock de `@/lib/api/tarefas` repassa o módulo original para `prazoDaTarefa` e o
 * catálogo `RECORRENCIAS_TAREFA` continuarem sendo o código de produção.
 */

const { HOJE, ontem, tipos, tarefas } = vi.hoisted(() => {
  const dia = (deslocamento: number) => {
    const data = new Date();
    data.setDate(data.getDate() + deslocamento);
    return data.toISOString().split("T")[0];
  };
  const tarefa = (extras: Record<string, unknown>) => ({
    responsavelId: "u1",
    concluida: false,
    importante: false,
    lido: false,
    privada: false,
    tarefaFutura: false,
    prioridade: "normal",
    ...extras,
  });
  return {
    HOJE: dia(0),
    ontem: dia(-1),
    tipos: [
      { id: "tipo-1", nome: "ONBOARDING", ativo: true },
      // desligado NÃO pode aparecer no seletor
      { id: "tipo-2", nome: "Tipo desligado", ativo: false },
    ],
    tarefas: [
      // Atrasada pelo PRazo FATAL (vencimento é hoje): regra única D6 no card
      tarefa({
        id: "t1",
        titulo: "Tarefa atrasada",
        dataVencimento: dia(0),
        prazoFatal: dia(-1),
        tipoNome: "Auditoria mensal",
        recorrencia: "mensal",
        clienteId: "cliente-9",
        nomeCliente: "Cliente Atraso",
      }),
      tarefa({
        id: "t2",
        titulo: "Tarefa pendente",
        dataVencimento: dia(3),
        tipoNome: "Revisão de contrato",
        recorrencia: "unica",
        nomeCliente: "Cliente Futuro",
      }),
      tarefa({
        id: "t3",
        titulo: "Tarefa concluida",
        dataVencimento: dia(5),
        concluida: true,
      }),
    ],
  };
});

vi.mock("sonner", () => {
  // toast é função E tem .success/.error (a tela usa os dois formatos)
  const toastFuncao = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast: toastFuncao };
});

vi.mock("@/hooks/useNotificacoes", () => ({
  useNotificacoes: () => ({ naoLidas: 0, novas: [] }),
  aoAbrirTarefa: vi.fn(),
  recarregarNotificacoes: vi.fn(),
}));

vi.mock("@/lib/api/membros", () => ({
  mapaDeNomes: vi.fn(async () => new Map()),
  listarMembros: vi.fn(async () => []),
}));

vi.mock("@/lib/api/setores", () => ({ listarSetores: vi.fn(async () => []) }));

vi.mock("@/lib/api/clientes", () => ({
  listarClientes: vi.fn(async () => ({
    content: [
      { id: "cliente-1", nome: "Fazenda Santa Rita", cpfCnpj: "12.345.678/0001-90" },
    ],
    page: { size: 8, number: 0, totalElements: 1, totalPages: 1, first: true, last: true },
  })),
}));

vi.mock("@/lib/api/tarefas", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/tarefas")>();
  return {
    ...original,
    listarTarefas: vi.fn(async () => ({
      content: tarefas,
      page: {
        size: 200, number: 0, totalElements: tarefas.length, totalPages: 1,
        first: true, last: true,
      },
    })),
    criarTarefa: vi.fn(async (dados: Record<string, unknown>) => ({
      id: "tarefa-nova",
      responsavelId: "u1",
      concluida: false,
      importante: false,
      lido: false,
      privada: false,
      tarefaFutura: false,
      prioridade: "normal",
      ...dados,
    })),
    atualizarTarefa: vi.fn(async (id: string, dados: Record<string, unknown>) => ({
      ...tarefas[0],
      id,
      ...dados,
    })),
    listarHistoricoTarefa: vi.fn(async () => []),
    listarTiposTarefa: vi.fn(async () => tipos),
    listarArquivosTarefa: vi.fn(async () => [
      { id: "anexo-1", nomeOriginal: "laudo.pdf", mimeTipo: "application/pdf", tamanhoBytes: 1536 },
    ]),
    anexarArquivosTarefa: vi.fn(async () => [
      { id: "anexo-2", nomeOriginal: "novo.pdf", mimeTipo: "application/pdf", tamanhoBytes: 2048 },
    ]),
    baixarAnexoTarefa: vi.fn(async () => undefined),
  };
});

beforeEach(() => {
  // só limpa as chamadas: as implementações dos mocks continuam
  vi.clearAllMocks();
});

function renderPagina() {
  return render(
    <MemoryRouter>
      <Tarefas />
    </MemoryRouter>,
  );
}

/** Abre o form de nova tarefa (o botão do cabeçalho). */
async function abrirForm() {
  fireEvent.click(await screen.findByRole("button", { name: /Nova tarefa/ }));
  await screen.findByRole("dialog", { name: /Nova tarefa/ });
}

/**
 * Abre o select shadcn (Radix) e escolhe a opção — pointerdown+click, como o Radix
 * espera; a opção é buscada DENTRO do listbox porque o Radix também renderiza um
 * `<select>` oculto com as mesmas opções (mesmo recorte dos testes de contratos).
 */
async function escolher(nomeDoGatilho: string | RegExp, opcao: string) {
  const gatilho = await screen.findByRole("combobox", { name: nomeDoGatilho });
  fireEvent.pointerDown(gatilho, { button: 0 });
  fireEvent.click(gatilho);
  const lista = await screen.findByRole("listbox");
  fireEvent.click(within(lista).getByRole("option", { name: opcao }));
}

/** jsdom não deixa atribuir `files` direto no input de arquivo. */
function escolherArquivos(alvo: HTMLInputElement, arquivos: File[]) {
  Object.defineProperty(alvo, "files", { value: arquivos, configurable: true });
  fireEvent.change(alvo);
}

describe("Tarefas — form reordenado (Fase 4)", () => {
  it("cria com tipoId, clienteId, processo, prazo fatal e recorrência (sem título digitável)", async () => {
    renderPagina();
    await abrirForm();

    // o campo de TÍTULO digitável saiu do form (o tipo vira o título)
    expect(screen.queryByLabelText(/Título/)).toBeNull();

    // 1º cliente: escolher na base leva o id para a API (além do nome)
    fireEvent.change(screen.getByLabelText("Cliente (opcional)"), {
      target: { value: "Fazenda" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Fazenda Santa Rita/ }));

    // 2º processo (opcional): uuid
    fireEvent.change(screen.getByLabelText("Processo (opcional)"), {
      target: { value: "8f3a1c2e-1b2c-4d5e-8f90-1234567890ab" },
    });

    // 3º tipo obrigatório: o seletor só traz os ATIVOS (o desligado nem entra)
    const gatilhoTipo = await screen.findByRole("combobox", { name: /Tipo de tarefa/ });
    fireEvent.pointerDown(gatilhoTipo, { button: 0 });
    fireEvent.click(gatilhoTipo);
    const listaDeTipos = await screen.findByRole("listbox");
    expect(within(listaDeTipos).queryByRole("option", { name: "Tipo desligado" })).toBeNull();
    fireEvent.click(within(listaDeTipos).getByRole("option", { name: "ONBOARDING" }));

    // 4º data fatal (o vencimento já vem = hoje) + 5º recorrência
    fireEvent.change(screen.getByLabelText("Data fatal (opcional)"), {
      target: { value: "2026-12-31" },
    });
    await escolher(/Recorrência/, "Mensal");

    fireEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));

    await waitFor(() => expect(vi.mocked(criarTarefa)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(criarTarefa).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        titulo: "ONBOARDING",
        tipoId: "tipo-1",
        clienteId: "cliente-1",
        nomeCliente: "Fazenda Santa Rita",
        processoId: "8f3a1c2e-1b2c-4d5e-8f90-1234567890ab",
        prazoFatal: "2026-12-31",
        recorrencia: "mensal",
        dataVencimento: HOJE,
      }),
    );
    // sem fila de anexos nada de multipart na criação
    expect(vi.mocked(anexarArquivosTarefa)).not.toHaveBeenCalled();
  });

  it("sem tipo cadastrado: aviso no form e criação bloqueada", async () => {
    vi.mocked(listarTiposTarefa).mockResolvedValueOnce([]);
    renderPagina();
    await abrirForm();

    expect(await screen.findByText(/Nenhum tipo cadastrado/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));
    await waitFor(() =>
      expect(vi.mocked(toast).error).toHaveBeenCalledWith(
        "Nenhum tipo cadastrado — cadastre em Cadastro > Tipos de tarefa.",
      ),
    );
    expect(vi.mocked(criarTarefa)).not.toHaveBeenCalled();
  });

  it("anexos escolhidos no form sobem DEPOIS da criação (multipart)", async () => {
    renderPagina();
    await abrirForm();

    await escolher(/Tipo de tarefa/, "ONBOARDING");
    const arquivo = new File(["conteudo"], "laudo-anexo.pdf", { type: "application/pdf" });
    escolherArquivos(screen.getByLabelText("Anexos (opcional)"), [arquivo]);
    // a fila mostra o arquivo antes de criar
    expect(await screen.findByText("laudo-anexo.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));

    await waitFor(() => expect(vi.mocked(anexarArquivosTarefa)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(anexarArquivosTarefa)).toHaveBeenCalledWith("tarefa-nova", [arquivo]);
    // ordem: cria a tarefa e só então anexa
    expect(vi.mocked(criarTarefa).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(anexarArquivosTarefa).mock.invocationCallOrder[0],
    );
    // a fila NÃO viaja no JSON da criação
    expect(vi.mocked(criarTarefa).mock.calls[0][0]).not.toHaveProperty("anexos");
  });
});

describe("Tarefas — cards de resumo viram filtro", () => {
  it("filtra 1 card por vez e clicar de novo limpa (volta ao total)", async () => {
    renderPagina();
    expect(await screen.findByText("Tarefa atrasada")).toBeInTheDocument();

    // contagens: a tarefa atrasada é a do PRazo fatal (regra única D6)
    expect(screen.getByRole("button", { name: "Total 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pendentes 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atrasadas 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluídas 1" })).toBeInTheDocument();

    // clicar num card filtra a lista
    fireEvent.click(screen.getByRole("button", { name: "Atrasadas 1" }));
    await waitFor(() => {
      expect(screen.getByText("Tarefa atrasada")).toBeInTheDocument();
      expect(screen.queryByText("Tarefa pendente")).toBeNull();
      expect(screen.queryByText("Tarefa concluida")).toBeNull();
    });
    expect(screen.getByRole("button", { name: "Atrasadas 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // chip do card ganha o próprio Limpar
    expect(
      screen.getByRole("button", { name: "Limpar filtro Atrasadas" }),
    ).toBeInTheDocument();

    // 1 por vez: trocar o card troca o recorte
    fireEvent.click(screen.getByRole("button", { name: "Concluídas 1" }));
    await waitFor(() => {
      expect(screen.queryByText("Tarefa atrasada")).toBeNull();
      expect(screen.getByText("Tarefa concluida")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Atrasadas 1" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Concluídas 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // clicar no card selecionado limpa e volta ao total
    fireEvent.click(screen.getByRole("button", { name: "Concluídas 1" }));
    await waitFor(() => {
      expect(screen.getByText("Tarefa atrasada")).toBeInTheDocument();
      expect(screen.getByText("Tarefa pendente")).toBeInTheDocument();
      expect(screen.getByText("Tarefa concluida")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Limpar filtro Concluídas" }),
    ).toBeNull();
  });
});

describe("Tarefas — detalhe com os campos novos", () => {
  it("mostra tipo, cliente, recorrência e prazo fatal editável, e lista os anexos", async () => {
    renderPagina();
    fireEvent.click(await screen.findByText("Tarefa atrasada"));
    await screen.findByRole("dialog");

    // campos novos (V21) no detalhe
    expect(await screen.findByText("Auditoria mensal")).toBeInTheDocument();
    expect(screen.getByText(/Cliente: Cliente Atraso/)).toBeInTheDocument();
    expect(screen.getByText("Mensal")).toBeInTheDocument();
    // status pela regra única: o PRazo fatal venceu ontem
    expect(screen.getByText("Atrasada")).toBeInTheDocument();

    // prazo fatal editável (PATCH) e vencimento continua somente leitura
    expect(screen.getByLabelText("Prazo fatal")).toHaveValue(ontem);
    expect(screen.getByLabelText("Vencimento")).toBeDisabled();

    // anexos: 1 busca por abertura, com download pelo endpoint da tarefa
    expect(vi.mocked(listarArquivosTarefa)).toHaveBeenCalledWith("t1");
    fireEvent.click(await screen.findByRole("button", { name: /laudo\.pdf/ }));
    await waitFor(() =>
      expect(vi.mocked(baixarAnexoTarefa)).toHaveBeenCalledWith("anexo-1", "laudo.pdf"),
    );
  });
});

/** Última carga pedida à API (a montagem já fez a primeira). */
function ultimaBusca() {
  const chamadas = vi.mocked(listarTarefas).mock.calls;
  return chamadas[chamadas.length - 1]?.[0];
}

describe("Tarefas — busca com tipo (Correção 6)", () => {
  it("select traz 'Tipo de tarefa' (o antigo Título) e a opção Processo, e busca no campo escolhido", async () => {
    renderPagina();
    await screen.findByText("Tarefa atrasada");

    const select = screen.getByLabelText("Tipo de busca") as HTMLSelectElement;
    expect(
      within(select).getAllByRole("option").map((opcao) => opcao.textContent),
    ).toEqual(["Tipo de tarefa", "Descrição", "Cliente", "Processo"]);

    fireEvent.change(select, { target: { value: "processo" } });
    fireEvent.change(screen.getByLabelText("Buscar por processo..."), {
      target: { value: "8f3a1c2e" },
    });

    await waitFor(
      () =>
        expect(ultimaBusca()).toEqual(
          expect.objectContaining({ busca: "8f3a1c2e", buscaEm: "processo", page: 0 }),
        ),
      { timeout: 3000 },
    );
  });
});

describe("Tarefas — filtro por coluna da lista (Correção 6)", () => {
  it("recorta a tabela em memória, com (x) de limpar, sem chamar a API de novo", async () => {
    renderPagina();
    await screen.findByText("Tarefa atrasada");
    const chamadasNaMontagem = vi.mocked(listarTarefas).mock.calls.length;

    fireEvent.change(screen.getByLabelText("Filtrar por Cliente"), {
      target: { value: "Cliente Atraso" },
    });

    await waitFor(() => {
      expect(screen.getByText("Tarefa atrasada")).toBeInTheDocument();
      expect(screen.queryByText("Tarefa pendente")).toBeNull();
      expect(screen.queryByText("Tarefa concluida")).toBeNull();
    });
    // local: nenhuma chamada nova + a paginação passa a contar o recorte
    expect(vi.mocked(listarTarefas).mock.calls.length).toBe(chamadasNaMontagem);
    expect(screen.getByText("1–1 de 1")).toBeInTheDocument();

    // (x) da coluna devolve as três linhas
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtro de Cliente" }));
    await waitFor(() => {
      expect(screen.getByText("Tarefa pendente")).toBeInTheDocument();
      expect(screen.getByText("Tarefa concluida")).toBeInTheDocument();
    });
    expect(screen.getByText("1–3 de 3")).toBeInTheDocument();
  });

  it("filtros de coluna valem juntos (E) — digitar os dois mantém só a interseção", async () => {
    renderPagina();
    await screen.findByText("Tarefa atrasada");

    fireEvent.change(screen.getByLabelText("Filtrar por Cliente"), {
      target: { value: "atraso" },
    });
    fireEvent.change(screen.getByLabelText("Filtrar por Tarefa"), {
      target: { value: "pendente" },
    });

    // nenhuma linha bate com os dois ao mesmo tempo
    await waitFor(() => {
      expect(screen.queryByText("Tarefa atrasada")).toBeNull();
      expect(screen.queryByText("Tarefa pendente")).toBeNull();
    });
    expect(screen.getByText("Nada com os filtros de coluna.")).toBeInTheDocument();
    // case-insensitive: "atraso" bate com "Cliente Atraso" quando é o único filtro
    fireEvent.change(screen.getByLabelText("Filtrar por Tarefa"), {
      target: { value: "" },
    });
    await waitFor(() => expect(screen.getByText("Tarefa atrasada")).toBeInTheDocument());
    expect(screen.queryByText("Tarefa pendente")).toBeNull();
  });
});
