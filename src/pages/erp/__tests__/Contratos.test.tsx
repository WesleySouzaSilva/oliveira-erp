import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Contratos from "@/pages/erp/Contratos";

/**
 * Contratos Clientes (lista geral): a descrição NUNCA aparece na tabela — so' depois da
 * seta da linha — e o painel que abre mostra SÓ a descrição (banco/datas/observacoes ficaram
 * de fora a pedido do titular em 15/10/2026).
 */

vi.mock("@/lib/api/contratos", () => {
  const base = (id: string, numero: string, extras: Record<string, unknown> = {}) => ({
    id,
    clienteId: "cliente-1",
    clienteNome: "Fazenda Santa Rita",
    numero,
    objetoId: "tipo-1",
    objetoNome: "Arroz",
    valor: 15000,
    dataAbertura: "2026-10-01",
    situacao: "ativo",
    ...extras,
  });
  return {
    listarContratosGeral: vi.fn(async () => ({
      content: [
        base("c1", "CT-001", {
          descricao: "Revisao do contrato de safra 2026",
          banco: "Banco do Brasil",
          observacoes: "Observacao que nao deve aparecer",
        }),
        base("c2", "CT-002", { descricao: null }),
      ],
      page: { size: 50, number: 0, totalElements: 2, totalPages: 1, first: true, last: true },
    })),
  };
});

vi.mock("@/lib/api/objetos", () => ({
  listarTiposObjeto: vi.fn(async () => [{ id: "tipo-1", tipoObjeto: "Arroz" }]),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("Contratos Clientes", () => {
  it("lista resumida: numero, cliente, objeto, valor, abertura — sem descricao", async () => {
    render(<Contratos />);

    expect(await screen.findByText("CT-001")).toBeInTheDocument();
    expect(screen.getByText("CT-002")).toBeInTheDocument();
    // os dois contratos são do mesmo cliente/objeto na massa
    expect(screen.getAllByText("Fazenda Santa Rita")).toHaveLength(2);
    expect(screen.getAllByText("Arroz")).toHaveLength(2);
    // descricao fora da tabela
    expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull();
    // "2 contratos" aparece no subtitulo e no rodapé de paginação
    expect(screen.getAllByText(/2 contratos/).length).toBeGreaterThan(0);
  });

  it("seta abre so a descricao (sem banco/observacoes) e recolhe", async () => {
    render(<Contratos />);

    const seta = await screen.findByRole("button", { name: "Ver descrição do contrato CT-001" });
    fireEvent.click(seta);

    expect(await screen.findByText("Revisao do contrato de safra 2026")).toBeInTheDocument();
    // pedido do titular: expandir = só a descrição
    expect(screen.queryByText("Banco do Brasil")).toBeNull();
    expect(screen.queryByText("Observacao que nao deve aparecer")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Recolher contrato CT-001" }));
    expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull();
  });
});
