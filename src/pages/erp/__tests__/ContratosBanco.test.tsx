import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContratosBanco from "@/pages/erp/ContratosBanco";
import {
  criarContratoBanco,
  excluirContratoBanco,
  listarContratosBanco,
} from "@/lib/api/contratosBanco";
import { listarClientes } from "@/lib/api/clientes";

/**
 * Contratos com o banco (tela geral /erp/contratos-banco, correção 4 + agrupamento 26/10):
 * a lista vem do mock da API e é AGRUPADA POR CLIENTE (nome 1x + soma), a seta do nome
 * expande os contratos, cada contrato tem observações próprias e os botões Visualizar /
 * Editar / Excluir, a busca manda os filtros `cliente`/`banco` e o form (COMPARTILHADO com
 * o dialog do cliente) cria com clienteId + banco + numero.
 */

vi.mock("@/lib/api/contratosBanco", () => {
  const base = (id: string, numero: string, extras: Record<string, unknown> = {}) => ({
    id,
    clienteId: "cliente-1",
    clienteNome: "Fazenda Santa Rita",
    banco: "Bradesco",
    numeroContrato: numero,
    valorTotalOperacao: 250000,
    valorParcela: 4166.67,
    primeiroVencimento: "2026-11-10",
    vencimentoProximaParcela: "2026-12-10",
    vencimentoUltimaParcela: "2027-10-10",
    observacoes: null,
    ...extras,
  });
  return {
    listarContratosBanco: vi.fn(async () => ({
      content: [
        base("cb-1", "NB-001", { observacoes: "Financiamento de trator novo." }),
        base("cb-2", "NB-002", {
          banco: "Sicoob",
          valorTotalOperacao: 120000,
          valorParcela: 1000,
          primeiroVencimento: "2026-09-05",
          vencimentoProximaParcela: "2026-10-05",
          vencimentoUltimaParcela: "2028-09-05",
        }),
      ],
      page: { size: 50, number: 0, totalElements: 2, totalPages: 1, first: true, last: true },
    })),
    buscarContratoBanco: vi.fn(async () => base("cb-1", "NB-001")),
    criarContratoBanco: vi.fn(async () => base("cb-9", "NB-009")),
    atualizarContratoBanco: vi.fn(async () => base("cb-1", "NB-001")),
    excluirContratoBanco: vi.fn(async () => undefined),
    anexarArquivosBanco: vi.fn(async () => []),
    listarArquivosBanco: vi.fn(async () => []),
    baixarArquivoBanco: vi.fn(async () => undefined),
    excluirArquivoBanco: vi.fn(async () => undefined),
  };
});

// A busca de cliente do atalho "Novo contrato" (ClienteBusca) usa a API de clientes.
vi.mock("@/lib/api/clientes", () => ({
  listarClientes: vi.fn(async () => ({
    content: [
      { id: "cliente-9", nome: "Fazenda Boa Vista", cpfCnpj: "12.345.678/0001-90", municipio: "Passo Fundo", uf: "RS" },
    ],
    page: { size: 8, number: 0, totalElements: 1, totalPages: 1, first: true, last: true },
  })),
}));

// O select "Banco" do form (COMPARTILHADO) vem do cadastro de bancos — não mais da lista fixa.
vi.mock("@/lib/api/bancos", () => ({
  listarBancos: vi.fn(async () => [
    { id: "banco-1", nome: "Bradesco", ativo: true },
    { id: "banco-2", nome: "Sicoob", ativo: true },
    { id: "banco-3", nome: "Santander", ativo: true },
    // inativo de propósito: NÃO pode aparecer no seletor do form
    { id: "banco-4", nome: "Banrisul", ativo: false },
  ]),
  criarBanco: vi.fn(),
  atualizarBanco: vi.fn(),
  excluirBanco: vi.fn(),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => vi.fn(async () => true),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** Expande o grupo do cliente pela seta do NOME (aria-label "Ver contratos de ..."). */
async function expandirCliente(nome: string) {
  const seta = await screen.findByRole("button", { name: `Ver contratos de ${nome}` });
  fireEvent.click(seta);
}

/** Abre o select shadcn (Radix) e escolhe a opção — pointerdown+click, como o Radix espera.
 * A opção é buscada DENTRO do listbox: o Radix também renderiza um `<select>` oculto com
 * as mesmas opções (autofill de formulário), que atrapalharia a busca por texto.
 * As opções chegam depois do `GET /bancos`, então espera a desejada existir. */
async function escolherBanco(nome: string) {
  const gatilho = await screen.findByRole("combobox", { name: "Banco" });
  fireEvent.pointerDown(gatilho, { button: 0 });
  fireEvent.click(gatilho);
  const lista = await screen.findByRole("listbox");
  await waitFor(() =>
    expect(within(lista).getByRole("option", { name: nome })).toBeInTheDocument(),
  );
  fireEvent.click(within(lista).getByRole("option", { name: nome }));
}

describe("Contratos com o banco", () => {
  it("agrupa por cliente: nome UMA vez, soma do valor total e contratos sob a seta", async () => {
    render(<ContratosBanco />);

    // o cliente aparece UMA única vez (linha do grupo)
    expect(await screen.findByText("Fazenda Santa Rita")).toBeInTheDocument();
    expect(screen.getAllByText("Fazenda Santa Rita")).toHaveLength(1);

    // a soma dos valores totais (250.000 + 120.000) aparece na linha do cliente
    expect(screen.getByText("R$ 370.000,00")).toBeInTheDocument();

    // os contratos só aparecem DEPOIS da seta
    await expandirCliente("Fazenda Santa Rita");
    expect(await screen.findByText("NB-001")).toBeInTheDocument();
    expect(screen.getByText("NB-002")).toBeInTheDocument();
    expect(screen.getByText("Bradesco")).toBeInTheDocument();
    expect(screen.getByText("Sicoob")).toBeInTheDocument();

    expect(listarContratosBanco).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, size: 50 }),
    );
  });

  it("cada contrato tem a seta de observações e os botões Visualizar/Editar/Excluir", async () => {
    render(<ContratosBanco />);
    expect(await screen.findByText("Fazenda Santa Rita")).toBeInTheDocument();
    await expandirCliente("Fazenda Santa Rita");
    expect(await screen.findByText("NB-001")).toBeInTheDocument();

    // seta de observações do contrato NB-001
    fireEvent.click(
      screen.getByRole("button", { name: "Ver observações do contrato NB-001" }),
    );
    expect(await screen.findByText("Financiamento de trator novo.")).toBeInTheDocument();

    // ações do contrato
    expect(screen.getAllByRole("button", { name: /Visualizar/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Editar/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Excluir/ }).length).toBeGreaterThan(0);
  });

  it("visualizar abre a janela somente leitura com os dados do contrato", async () => {
    render(<ContratosBanco />);
    expect(await screen.findByText("Fazenda Santa Rita")).toBeInTheDocument();
    await expandirCliente("Fazenda Santa Rita");
    expect(await screen.findByText("NB-001")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Visualizar/ })[0]);
    expect(await screen.findByText("Contrato com o banco")).toBeInTheDocument();
    expect(screen.getByText("Valor total da operação")).toBeInTheDocument();
  });

  it("busca por nome do cliente e por banco mandam os filtros `cliente` e `banco`", async () => {
    render(<ContratosBanco />);
    expect(await screen.findByText("Fazenda Santa Rita")).toBeInTheDocument();
    vi.mocked(listarContratosBanco).mockClear();

    fireEvent.change(screen.getByLabelText("Buscar por nome do cliente"), {
      target: { value: "santa" },
    });
    fireEvent.change(screen.getByLabelText("Buscar por banco"), {
      target: { value: "itaú" },
    });

    // debounce de 300 ms: um único chamado com os DOIS filtros
    await waitFor(
      () =>
        expect(vi.mocked(listarContratosBanco)).toHaveBeenLastCalledWith(
          expect.objectContaining({ cliente: "santa", banco: "itaú", page: 0 }),
        ),
      { timeout: 3000 },
    );
  });

  it("exclusão confirma e chama DELETE na API", async () => {
    render(<ContratosBanco />);
    expect(await screen.findByText("Fazenda Santa Rita")).toBeInTheDocument();
    await expandirCliente("Fazenda Santa Rita");
    expect(await screen.findByText("NB-001")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Excluir/ })[0]);

    await waitFor(() => expect(vi.mocked(excluirContratoBanco)).toHaveBeenCalledWith("cb-1"));
  });

  it("form (compartilhado) cria contrato com clienteId, banco e numero", async () => {
    render(<ContratosBanco />);
    expect(await screen.findByText("Fazenda Santa Rita")).toBeInTheDocument();

    // 1) atalho: escolher o cliente antes de abrir o form
    fireEvent.click(screen.getByRole("button", { name: /Novo contrato/ }));
    fireEvent.change(screen.getByPlaceholderText("Buscar cliente pelo nome ou CPF/CNPJ..."), {
      target: { value: "Boa Vista" },
    });
    fireEvent.click(await screen.findByText("Fazenda Boa Vista"));
    fireEvent.click(screen.getByRole("button", { name: "Abrir formulário" }));

    // 2) o form compartilhado abre já vinculado ao cliente escolhido
    await escolherBanco("Bradesco");
    fireEvent.change(screen.getByLabelText("Nº do contrato"), {
      target: { value: "NB-100" },
    });
    fireEvent.change(screen.getByLabelText("Valor total da operação (R$)"), {
      target: { value: "250000,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contrato" }));

    await waitFor(() =>
      expect(vi.mocked(criarContratoBanco)).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteId: "cliente-9",
          banco: "Bradesco",
          numeroContrato: "NB-100",
          valorTotalOperacao: 250000,
        }),
      ),
    );
  });
});
