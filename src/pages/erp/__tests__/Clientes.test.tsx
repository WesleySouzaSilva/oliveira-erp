import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Clientes from "@/pages/erp/Clientes";
import { listarClientes } from "@/lib/api/clientes";
import { listarCidades, listarEstados } from "@/lib/api/localidade";
import { consultarCep, consultarCnpj } from "@/lib/api/integracoes";

/**
 * Clientes — filtro por coluna (Correção 6): a listagem é paginada na API, então cada
 * input do cabeçalho vira parâmetro do `GET /clientes` (nome, cpfCnpj, municipio,
 * telefone, situacao), sempre na página 0 e JUNTO com a busca global do topo (E).
 *
 * Os diálogos de contrato e a localidade são stubs: não participam do que este arquivo
 * testa e puxariam o grafo inteiro dos módulos de contrato.
 */
const { clientes } = vi.hoisted(() => ({
  clientes: [
    {
      id: "cliente-1",
      nome: "Fazenda Santa Rita",
      cpfCnpj: "12.345.678/0001-90",
      municipio: "Rio Verde",
      uf: "GO",
      telefone: "(16) 99999-0001",
      situacao: "ativo",
    },
    {
      id: "cliente-2",
      nome: "Agropecuária Norte",
      cpfCnpj: "98.765.432/0001-10",
      municipio: "Sorriso",
      uf: "MT",
      telefone: "(66) 3333-2222",
      situacao: "rescindido",
    },
  ],
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => vi.fn(async () => true),
}));

vi.mock("@/lib/api/localidade", () => ({
  listarEstados: vi.fn(async () => []),
  listarCidades: vi.fn(async () => []),
  semAcento: (valor: string) => valor,
}));

// Auto-preenchimento por CEP/CNPJ (Invertexto): a chamada real vira mock — o form só
// manda o CEP/CNPJ e a API devolve os dados.
vi.mock("@/lib/api/integracoes", () => ({
  consultarCep: vi.fn(),
  consultarCnpj: vi.fn(),
}));

vi.mock("@/components/erp/ContratosClienteDialog", () => ({
  ContratosClienteDialog: () => null,
}));
vi.mock("@/components/erp/ContratosBancoClienteDialog", () => ({
  ContratosBancoClienteDialog: () => null,
}));

vi.mock("@/lib/api/clientes", () => ({
  listarClientes: vi.fn(async () => ({
    content: clientes,
    page: {
      size: 20,
      number: 0,
      totalElements: clientes.length,
      totalPages: 1,
      first: true,
      last: true,
    },
  })),
  criarCliente: vi.fn(async (dados: Record<string, unknown>) => ({ id: "cliente-novo", ...dados })),
  atualizarCliente: vi.fn(async (id: string, dados: Record<string, unknown>) => ({ id, ...dados })),
  excluirCliente: vi.fn(async () => undefined),
}));

beforeEach(() => {
  // só limpa as chamadas: as implementações dos mocks continuam
  vi.clearAllMocks();
});

function renderPagina() {
  return render(
    <MemoryRouter>
      <Clientes />
    </MemoryRouter>,
  );
}

/** A última carga pedida à API (a montagem já fez uma vazia). */
const ultimaChamada = () => {
  const chamadas = vi.mocked(listarClientes).mock.calls;
  return chamadas[chamadas.length - 1]?.[0];
};

describe("Clientes — filtro por coluna (Correção 6)", () => {
  it("input de Município vira o parâmetro municipio, na página 0", async () => {
    renderPagina();
    await screen.findByText("Fazenda Santa Rita");

    fireEvent.change(screen.getByLabelText("Filtrar por Município"), {
      target: { value: "Rio" },
    });

    await waitFor(
      () => expect(ultimaChamada()).toEqual(expect.objectContaining({ municipio: "Rio", page: 0 })),
      { timeout: 3000 },
    );
    // coluna vazia não manda parâmetro nenhum
    expect(ultimaChamada()?.telefone).toBeUndefined();
    expect(ultimaChamada()?.situacao).toBeUndefined();
    expect(ultimaChamada()?.nome).toBeUndefined();
  });

  it("select de Situação usa o catálogo da tela e manda situacao", async () => {
    renderPagina();
    await screen.findByText("Fazenda Santa Rita");

    const select = screen.getByLabelText("Filtrar por Situação") as HTMLSelectElement;
    expect(
      within(select).getAllByRole("option").map((opcao) => opcao.textContent),
    ).toEqual(["Todas", "Ativo", "Encerrado", "Rescindido", "Fora do escopo"]);

    fireEvent.change(select, { target: { value: "rescindido" } });
    await waitFor(
      () =>
        expect(ultimaChamada()).toEqual(
          expect.objectContaining({ situacao: "rescindido", page: 0 }),
        ),
      { timeout: 3000 },
    );

    // (x) de limpar a coluna aparece quando preenchido
    const limpar = screen.getByRole("button", { name: "Limpar filtro de Situação" });
    fireEvent.click(limpar);
    await waitFor(
      () => expect(ultimaChamada()?.situacao).toBeUndefined(),
      { timeout: 3000 },
    );
  });

  it("coluna e busca geral valem juntos (E), sem apagar os outros filtros", async () => {
    renderPagina();
    await screen.findByText("Fazenda Santa Rita");

    fireEvent.change(screen.getByLabelText("Filtrar por Nome"), {
      target: { value: "Fazenda" },
    });
    await waitFor(() => expect(ultimaChamada()?.nome).toBe("Fazenda"), { timeout: 3000 });

    fireEvent.change(screen.getByLabelText("Filtrar por Município"), {
      target: { value: "Rio" },
    });
    await waitFor(
      () =>
        expect(ultimaChamada()).toEqual(
          expect.objectContaining({ nome: "Fazenda", municipio: "Rio", page: 0 }),
        ),
      { timeout: 3000 },
    );

    // a busca global do topo entra na MESMA chamada (E), não substitui os filtros
    fireEvent.change(screen.getByLabelText("Buscar por nome do cliente..."), {
      target: { value: "Santa" },
    });
    await waitFor(
      () =>
        expect(ultimaChamada()).toEqual(
          expect.objectContaining({
            busca: "Santa",
            buscaEm: "nome",
            nome: "Fazenda",
            municipio: "Rio",
            page: 0,
          }),
        ),
      { timeout: 3000 },
    );
  });
});

describe("Clientes — auto-preenchimento por CEP/CNPJ (Invertexto)", () => {
  it("preenche logradouro, município e UF pelo CEP ao sair do campo", async () => {
    vi.mocked(listarEstados).mockResolvedValue([{ uf: "SP", codigoIbge: "35", nome: "São Paulo" }]);
    vi.mocked(listarCidades).mockResolvedValue([
      { nome: "São Paulo", uf: "SP", codigoIbge: "3550308" },
    ]);
    vi.mocked(consultarCep).mockResolvedValue({
      cep: "01310-100",
      logradouro: "Avenida Paulista",
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: "SP",
    });
    renderPagina();
    await screen.findByText("Fazenda Santa Rita");

    fireEvent.click(screen.getByRole("button", { name: /Novo Cliente/ }));
    const cep = await screen.findByLabelText("CEP");
    fireEvent.change(cep, { target: { value: "01310-100" } });
    fireEvent.click(screen.getByRole("button", { name: /Pesquisar CEP/ }));

    await waitFor(() => expect(consultarCep).toHaveBeenCalledWith("01310100"));
    await waitFor(() =>
      expect(screen.getByLabelText("Logradouro *")).toHaveValue("Avenida Paulista"),
    );
    // cidade IBGE casada pelo catálogo (sem acento)
    expect(screen.getByRole("combobox", { name: /Cidade/ })).toHaveTextContent("São Paulo");
    expect(screen.getByLabelText("UF *")).toHaveValue("SP");
  });

  it("preenche razão social e endereço pelo CNPJ no botão Buscar empresa", async () => {
    vi.mocked(listarEstados).mockResolvedValue([{ uf: "GO", codigoIbge: "52", nome: "Goiás" }]);
    vi.mocked(listarCidades).mockResolvedValue([
      { nome: "Rio Verde", uf: "GO", codigoIbge: "5218806" },
    ]);
    vi.mocked(consultarCnpj).mockResolvedValue({
      cnpj: "12345678000190",
      razaoSocial: "Agro Importadora Ltda",
      situacao: "ATIVA",
      logradouro: "Rua das Palmeiras",
      numero: "1230",
      bairro: "Centro",
      municipio: "Rio Verde",
      uf: "GO",
      cep: "75900-000",
      cnae: "4611-5",
      capitalSocial: "100000",
      telefone: "62 34939002",
      email: "contato@agro.com.br",
    });
    renderPagina();
    await screen.findByText("Fazenda Santa Rita");

    fireEvent.click(screen.getByRole("button", { name: /Novo Cliente/ }));
    const cnpj = await screen.findByLabelText("CPF/CNPJ *");
    fireEvent.change(cnpj, { target: { value: "12.345.678/0001-90" } });
    fireEvent.click(screen.getByRole("button", { name: /Buscar empresa/ }));

    await waitFor(() => expect(consultarCnpj).toHaveBeenCalledWith("12345678000190"));
    await waitFor(() =>
      expect(screen.getByLabelText("Nome do Cliente / Produtor *")).toHaveValue(
        "Agro Importadora Ltda",
      ),
    );
    // endereço principal preenchido (logradouro, número e bairro no campo livre,
    // cidade e UF) — o JSON real da Invertexto traz tudo dentro de `endereco`
    expect(screen.getByLabelText("Logradouro *")).toHaveValue("Rua das Palmeiras, 1230, Centro");
    expect(screen.getByLabelText("UF *")).toHaveValue("GO");
    // telefone e e-mail da empresa entram nas linhas vazias dos blocos
    expect(screen.getByLabelText("Número *")).toHaveValue("(62) 3493-9002");
    expect(screen.getByLabelText("E-mail *")).toHaveValue("contato@agro.com.br");
  });

  it("não sobrescreve telefone e e-mail que o usuário já digitou", async () => {
    vi.mocked(listarEstados).mockResolvedValue([{ uf: "GO", codigoIbge: "52", nome: "Goiás" }]);
    vi.mocked(listarCidades).mockResolvedValue([
      { nome: "Rio Verde", uf: "GO", codigoIbge: "5218806" },
    ]);
    vi.mocked(consultarCnpj).mockResolvedValue({
      cnpj: "12345678000190",
      razaoSocial: "Agro Importadora Ltda",
      situacao: "ATIVA",
      logradouro: "Rua das Palmeiras",
      numero: "1230",
      bairro: "Centro",
      municipio: "Rio Verde",
      uf: "GO",
      cep: "75900-000",
      cnae: "4611-5",
      capitalSocial: "100000",
      telefone: "62 34939002",
      email: "contato@agro.com.br",
    });
    renderPagina();
    await screen.findByText("Fazenda Santa Rita");

    fireEvent.click(screen.getByRole("button", { name: /Novo Cliente/ }));
    const cnpj = await screen.findByLabelText("CPF/CNPJ *");
    fireEvent.change(cnpj, { target: { value: "12.345.678/0001-90" } });
    // o usuário já digitou contato antes de buscar a empresa
    fireEvent.change(screen.getByLabelText("Número *"), { target: { value: "(64) 99999-8888" } });
    fireEvent.change(screen.getByLabelText("E-mail *"), { target: { value: "user@agro.com" } });

    fireEvent.click(screen.getByRole("button", { name: /Buscar empresa/ }));
    await waitFor(() => expect(consultarCnpj).toHaveBeenCalledWith("12345678000190"));

    // o que estava digitado permanece
    await waitFor(() =>
      expect(screen.getByLabelText("Logradouro *")).toHaveValue("Rua das Palmeiras, 1230, Centro"),
    );
    expect(screen.getByLabelText("Número *")).toHaveValue("(64) 99999-8888");
    expect(screen.getByLabelText("E-mail *")).toHaveValue("user@agro.com");
  });
});
