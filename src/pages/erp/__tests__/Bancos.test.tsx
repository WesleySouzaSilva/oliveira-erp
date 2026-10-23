import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import Bancos from "@/pages/erp/Bancos";
import {
  atualizarBanco, criarBanco, excluirBanco, listarBancos,
} from "@/lib/api/bancos";

/**
 * Bancos — tela nova da correção 5 (cadastro que passa a alimentar o select "Banco" do
 * formulário de contrato do Comercial, antes lista fixa no fonte):
 *
 * - lista Nome / Ativo / Ações no padrão CRUD de Setores/Tipos de tarefa;
 * - criar e renomear pelo mesmo dialog (input de nome);
 * - ativar/desativar manda `PUT /bancos/{id}` com `{ nome, ativo }` COMPLETO (a API não
 *   aceita campo parcial) — o banco desligado sai do seletor do form;
 * - excluir passa por confirmação que AVISA que os contratos existentes mantêm o nome.
 *
 * `useConfirm` é mockado devolvendo `true`, mas guarda as opções para o teste conferir o
 * texto do aviso (mesmo recorte de TiposTarefa.test.tsx).
 */
const { bancos, confirmar } = vi.hoisted(() => ({
  bancos: [
    { id: "banco-1", nome: "Sicoob", ativo: true },
    { id: "banco-2", nome: "Sicredi", ativo: false },
  ],
  confirmar: vi.fn(
    async (_opcoes: {
      title: string;
      description?: string;
      confirmText?: string;
      destructive?: boolean;
    }) => true,
  ),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({ useConfirm: () => confirmar }));

vi.mock("@/lib/api/bancos", () => ({
  listarBancos: vi.fn(async () => bancos),
  criarBanco: vi.fn(async (dados: { nome: string }) => ({
    id: "banco-novo",
    nome: dados.nome,
    ativo: true,
  })),
  atualizarBanco: vi.fn(async (id: string, dados: { nome: string; ativo: boolean }) => ({
    id,
    ...dados,
  })),
  excluirBanco: vi.fn(async () => undefined),
}));

beforeEach(() => {
  // só limpa as chamadas: as implementações dos mocks continuam
  vi.clearAllMocks();
});

function linhaDe(nome: string): HTMLElement {
  return screen.getByText(nome).closest("tr") as HTMLElement;
}

describe("Bancos — cadastro", () => {
  it("lista os bancos com nome, situação e as três ações", async () => {
    render(<Bancos />);

    expect(await screen.findByText("Sicoob")).toBeInTheDocument();
    expect(screen.getByText("Sicredi")).toBeInTheDocument();
    expect(listarBancos).toHaveBeenCalledTimes(1);

    const ativo = linhaDe("Sicoob");
    const inativo = linhaDe("Sicredi");
    expect(within(ativo).getByText("ativo")).toBeInTheDocument();
    expect(within(inativo).getByText("inativo")).toBeInTheDocument();
    expect(within(inativo).getByRole("button", { name: "Ativar Sicredi" })).toBeInTheDocument();
    expect(within(ativo).getByRole("button", { name: "Renomear Sicoob" })).toBeInTheDocument();
    expect(within(ativo).getByRole("button", { name: "Excluir Sicoob" })).toBeInTheDocument();

    // botões de ATIVAR não ficam nos bancos já ativos
    expect(within(ativo).queryByRole("button", { name: /^Ativar/ })).toBeNull();
  });

  it("cria um banco novo pelo dialog e recarrega a lista", async () => {
    render(<Bancos />);
    await screen.findByText("Sicoob");

    fireEvent.click(screen.getByRole("button", { name: /Novo banco/ }));
    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText(/Nome do banco/), {
      target: { value: "Banrisul" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(criarBanco).toHaveBeenCalledWith({ nome: "Banrisul" }));
    await waitFor(() => expect(listarBancos).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith("Banco criado.");
  });

  it("ativa o banco inativo com PUT { nome, ativo: true } completo", async () => {
    render(<Bancos />);
    await screen.findByText("Sicredi");

    fireEvent.click(
      within(linhaDe("Sicredi")).getByRole("button", { name: "Ativar Sicredi" }),
    );

    // a API espera o estado COMPLETO do banco no PUT — nome junto com o ativo
    await waitFor(() =>
      expect(atualizarBanco).toHaveBeenCalledWith("banco-2", { nome: "Sicredi", ativo: true }),
    );
    await waitFor(() => expect(listarBancos).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith('Banco "Sicredi" ativado.');
  });

  it("exclui com confirmação que avisa que os contratos mantêm o nome gravado", async () => {
    render(<Bancos />);
    await screen.findByText("Sicoob");

    fireEvent.click(
      within(linhaDe("Sicoob")).getByRole("button", { name: "Excluir Sicoob" }),
    );

    await waitFor(() => expect(excluirBanco).toHaveBeenCalledWith("banco-1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Banco excluído."));
    expect(confirmar).toHaveBeenCalledTimes(1);
    const aviso = confirmar.mock.calls[0][0];
    expect(aviso.title).toContain("Sicoob");
    expect(aviso.description).toMatch(/MANTÊM/);
    expect(aviso.description).toMatch(/contratos existentes/);
  });
});
