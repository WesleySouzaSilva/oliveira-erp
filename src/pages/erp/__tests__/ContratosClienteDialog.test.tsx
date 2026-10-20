import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContratosClienteDialog } from "@/components/erp/ContratosClienteDialog";

/**
 * Contratos do cliente: a lista mostra so numero, objeto, valor, abertura, situacao e
 * acoes — a descricao so existe depois que a pessoa aperta a seta da linha
 * (decisao 6 de `docs/plano-contratos-e-timeline.md`).
 */

vi.mock("@/lib/api/contratos", () => {
  const base = (id: string, numero: string, extras: Record<string, unknown> = {}) => ({
    id,
    clienteId: "cliente-1",
    numero,
    situacao: "ativo",
    dataAbertura: "2026-10-01",
    valor: 15000,
    objetoId: "tipo-1",
    ...extras,
  });
  return {
    listarContratos: vi.fn(async () => [
      base("contrato-1", "CT-001", {
        descricao: "Revisao do contrato de safra 2026",
        banco: "Banco do Brasil",
        dataInicio: "2026-10-05",
      }),
      base("contrato-2", "CT-002", { descricao: null }),
    ]),
    criarContrato: vi.fn(),
    atualizarContrato: vi.fn(),
    excluirContrato: vi.fn(async () => undefined),
    buscarContrato: vi.fn(),
    anexarArquivos: vi.fn(async () => []),
    listarArquivos: vi.fn(async () => []),
    excluirArquivo: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/api/objetos", () => ({
  listarTiposObjeto: vi.fn(async () => [{ id: "tipo-1", tipoObjeto: "Arroz" }]),
}));

vi.mock("@/lib/api/setores", () => ({
  listarSetores: vi.fn(async () => [
    { id: "setor-1", nome: "Financeiro" },
    { id: "setor-2", nome: "Pos-Vendas" },
  ]),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => vi.fn(async () => true),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function abrir() {
  render(
    <ContratosClienteDialog
      aberto={true}
      onAbertoChange={vi.fn()}
      clienteId="cliente-1"
      clienteNome="Fazenda Santa Rita"
    />,
  );
}

describe("ContratosClienteDialog — descricao so por trás da seta", () => {
  it("nao mostra a descricao na lista e abre/fecha com a seta da linha", async () => {
    abrir();
    expect(await screen.findByText("CT-001")).toBeInTheDocument();

    // a descricao NUNCA aparece sem clique
    expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull();

    const seta = screen.getByRole("button", { name: "Ver descrição do contrato CT-001" });
    expect(seta.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(seta);

    expect(await screen.findByText("Revisao do contrato de safra 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recolher contrato CT-001" }).getAttribute("aria-expanded"),
    ).toBe("true");

    // recolhe de volta: a descricao sai da tela
    fireEvent.click(screen.getByRole("button", { name: "Recolher contrato CT-001" }));
    await waitFor(() =>
      expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull(),
    );
  });

  it("expandir tudo / recolher tudo mexem em todas as linhas", async () => {
    abrir();
    expect(await screen.findByText("CT-002")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expandir todas as descrições" }));

    expect(await screen.findByText("Revisao do contrato de safra 2026")).toBeInTheDocument();
    // contrato sem descricao: o painel abre e diz que nao tem
    expect(await screen.findByText("Sem descrição.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recolher todas as descrições" }));
    await waitFor(() =>
      expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull(),
    );
    expect(
      screen.getByRole("button", { name: "Ver descrição do contrato CT-001" }),
    ).toBeTruthy();
  });

  it("o botao Editar continua abrindo o formulario da linha", async () => {
    abrir();
    expect(await screen.findByText("CT-001")).toBeInTheDocument();

    const linhas = screen.getAllByRole("row");
    const primeiraLinha = linhas.find((linha) => linha.textContent?.includes("CT-001"))!;
    fireEvent.click(within(primeiraLinha).getByRole("button", { name: /Editar/ }));

    expect(await screen.findByText("Editar contrato CT-001")).toBeInTheDocument();
    // o número saiu do formulário (agora é automático) — a edição se identifica pelo título
    expect(screen.getByText("Editar contrato CT-001")).toBeInTheDocument();
    // edição não oferece setor de envio (só o cadastro cria tarefas)
    expect(screen.queryByText(/Setores de envio/)).toBeNull();
  });

  it("formulário de novo contrato mostra os setores de envio (cada um vira uma tarefa)", async () => {
    abrir();
    expect(await screen.findByText("CT-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Novo contrato/ }));

    expect(await screen.findByText(/Setores de envio/)).toBeInTheDocument();
    const financeiro = screen.getByLabelText("Enviar para Financeiro");
    fireEvent.click(financeiro);
    expect(financeiro).toBeChecked();
  });
});
