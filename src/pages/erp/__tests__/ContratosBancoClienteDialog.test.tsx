import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContratosBancoClienteDialog } from "@/components/erp/ContratosBancoClienteDialog";
import {
  criarContratoBanco,
  excluirContratoBanco,
  listarContratosBanco,
} from "@/lib/api/contratosBanco";
import { listarBancos } from "@/lib/api/bancos";

/**
 * Contratos do cliente COM O BANCO (ação "Contratos → Com o banco" da lista de clientes,
 * correção 4): o dialog é CLIENT-SCOPED — lista com `?clienteId=` e o form compartilhado
 * cria sempre com o `clienteId` do cliente da linha.
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
      content: [base("cb-1", "NB-001")],
      page: { size: 50, number: 0, totalElements: 1, totalPages: 1, first: true, last: true },
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

function abrir() {
  render(
    <ContratosBancoClienteDialog
      aberto={true}
      onAbertoChange={vi.fn()}
      clienteId="cliente-1"
      clienteNome="Fazenda Santa Rita"
    />,
  );
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

/** Abre o select de banco e devolve as opções visíveis (Radix só monta o listbox aberto). */
async function opcoesDeBanco(): Promise<HTMLElement[]> {
  const gatilho = await screen.findByRole("combobox", { name: "Banco" });
  fireEvent.pointerDown(gatilho, { button: 0 });
  fireEvent.click(gatilho);
  const lista = await screen.findByRole("listbox");
  // o carregamento do cadastro é assíncrono: espera as opções dos ativos chegarem
  await waitFor(() => expect(within(lista).getAllByRole("option").length).toBeGreaterThan(1));
  return within(lista).getAllByRole("option");
}

describe("ContratosBancoClienteDialog — dialog client-scoped", () => {
  it("lista os contratos DO cliente via GET ?clienteId=", async () => {
    abrir();

    expect(await screen.findByText("NB-001")).toBeInTheDocument();
    expect(screen.getByText("Bradesco")).toBeInTheDocument();
    expect(screen.getByText("R$ 250.000,00")).toBeInTheDocument();
    expect(listarContratosBanco).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: "cliente-1" }),
    );
  });

  it("cria com o clienteId certo usando o form compartilhado", async () => {
    abrir();
    expect(await screen.findByText("NB-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Novo contrato/ }));
    await escolherBanco("Santander");
    fireEvent.change(screen.getByLabelText("Nº do contrato"), {
      target: { value: "NB-777" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contrato" }));

    await waitFor(() =>
      expect(vi.mocked(criarContratoBanco)).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteId: "cliente-1",
          banco: "Santander",
          numeroContrato: "NB-777",
        }),
      ),
    );
  });

  it("'Outro' no select abre o campo de banco livre", async () => {
    abrir();
    expect(await screen.findByText("NB-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Novo contrato/ }));
    await escolherBanco("Outro");
    fireEvent.change(await screen.findByLabelText("Nome do banco (outro)"), {
      target: { value: "Banco Municipal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contrato" }));

    await waitFor(() =>
      expect(vi.mocked(criarContratoBanco)).toHaveBeenCalledWith(
        expect.objectContaining({ clienteId: "cliente-1", banco: "Banco Municipal" }),
      ),
    );
  });

  it("exclusão confirma e chama a API", async () => {
    abrir();
    expect(await screen.findByText("NB-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Excluir/ }));
    await waitFor(() => expect(vi.mocked(excluirContratoBanco)).toHaveBeenCalledWith("cb-1"));
  });

  it("select de banco vem do cadastro: só ATIVOS, com 'Outro' por último", async () => {
    abrir();
    expect(await screen.findByText("NB-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Novo contrato/ }));

    const nomes = (await opcoesDeBanco()).map((opcao) => opcao.textContent?.trim());
    expect(nomes).toContain("Bradesco");
    expect(nomes).toContain("Sicoob");
    expect(nomes).toContain("Santander");
    expect(nomes).not.toContain("Banrisul"); // inativo fica fora do seletor
    expect(nomes[nomes.length - 1]).toBe("Outro");
  });

  it("sem nenhum banco cadastrado, avisa para cadastrar em Cadastro > Bancos", async () => {
    vi.mocked(listarBancos).mockResolvedValueOnce([]);
    abrir();
    expect(await screen.findByText("NB-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Novo contrato/ }));

    expect(
      await screen.findByText("Nenhum banco cadastrado — cadastre em Cadastro > Bancos"),
    ).toBeInTheDocument();
    // o "Outro" (texto livre) segue disponível mesmo com o cadastro vazio
    await escolherBanco("Outro");
    expect(await screen.findByLabelText("Nome do banco (outro)")).toBeInTheDocument();
  });

  it("banco gravado fora do cadastro continua como opção na edição (não perde o valor)", async () => {
    // o cadastro já não oferece "Bradesco" (desligado, excluído ou texto livre antigo)
    vi.mocked(listarBancos).mockResolvedValueOnce([
      { id: "banco-3", nome: "Santander", ativo: true },
    ]);
    abrir();
    expect(await screen.findByText("NB-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    const gatilho = await screen.findByRole("combobox", { name: "Banco" });
    await waitFor(() => expect(gatilho).toHaveTextContent("Bradesco"));

    fireEvent.pointerDown(gatilho, { button: 0 });
    fireEvent.click(gatilho);
    const lista = await screen.findByRole("listbox");
    await waitFor(() =>
      expect(within(lista).getByRole("option", { name: "Bradesco" })).toBeInTheDocument(),
    );
  });
});
