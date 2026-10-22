import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContratosBancoClienteDialog } from "@/components/erp/ContratosBancoClienteDialog";
import {
  criarContratoBanco,
  excluirContratoBanco,
  listarContratosBanco,
} from "@/lib/api/contratosBanco";

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
  };
});

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
 * as mesmas opções (autofill de formulário), que atrapalharia a busca por texto. */
async function escolherBanco(nome: string) {
  const gatilho = await screen.findByRole("combobox", { name: "Banco" });
  fireEvent.pointerDown(gatilho, { button: 0 });
  fireEvent.click(gatilho);
  const lista = await screen.findByRole("listbox");
  fireEvent.click(within(lista).getByRole("option", { name: nome }));
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
});
