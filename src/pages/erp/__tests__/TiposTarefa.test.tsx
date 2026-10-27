import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import TiposTarefa from "@/pages/erp/TiposTarefa";
import {
  atualizarTipoTarefa, criarTipoTarefa, excluirTipoTarefa, listarTiposTarefa,
} from "@/lib/api/tarefas";

/**
 * Tipos de tarefa — tela nova da frente de filtros (Correção 6 + cadastro do tipo):
 *
 * - lista Nome / Ativo / Ações no padrão CRUD de Setores;
 * - criar e renomear pelo mesmo dialog (input de nome);
 * - ativar/desativar manda `PUT /tarefas/tipos/{id}` com `{ ativo }` (o tipo desligado
 *   sai do seletor do form de nova tarefa);
 * - excluir passa por confirmação que AVISA o SET NULL das tarefas existentes.
 *
 * `useConfirm` é mockado devolvendo `true` (mesmo recorte dos testes de contratos), mas
 * guarda as opções para o teste conferir o texto do aviso.
 */
const { tipos, confirmar } = vi.hoisted(() => ({
  tipos: [
    { id: "tipo-1", nome: "Auditoria mensal", ativo: true },
    { id: "tipo-2", nome: "Revisão de contrato", ativo: false },
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

vi.mock("@/lib/api/tarefas", () => ({
  listarTiposTarefa: vi.fn(async () => tipos),
  criarTipoTarefa: vi.fn(async (dados: { nome: string }) => ({
    id: "tipo-novo",
    nome: dados.nome,
    ativo: true,
  })),
  atualizarTipoTarefa: vi.fn(async (id: string, dados: { nome?: string; ativo?: boolean }) => ({
    id,
    nome: dados.nome ?? "sem nome",
    ativo: dados.ativo ?? true,
  })),
  excluirTipoTarefa: vi.fn(async () => undefined),
}));

beforeEach(() => {
  // só limpa as chamadas: as implementações dos mocks continuam
  vi.clearAllMocks();
});

function linhaDe(nome: string): HTMLElement {
  return screen.getByText(nome).closest("tr") as HTMLElement;
}

describe("Tipos de tarefa — cadastro", () => {
  it("lista os tipos com nome, situação e as três ações", async () => {
    render(<TiposTarefa />);

    expect(await screen.findByText("Auditoria mensal")).toBeInTheDocument();
    expect(screen.getByText("Revisão de contrato")).toBeInTheDocument();
    expect(listarTiposTarefa).toHaveBeenCalledTimes(1);

    const ativa = linhaDe("Auditoria mensal");
    const inativa = linhaDe("Revisão de contrato");
    expect(within(ativa).getByText("ativo")).toBeInTheDocument();
    expect(within(inativa).getByText("inativo")).toBeInTheDocument();
    expect(within(inativa).getByRole("button", { name: "Ativar Revisão de contrato" })).toBeInTheDocument();
    expect(within(ativa).getByRole("button", { name: "Renomear Auditoria mensal" })).toBeInTheDocument();
    expect(within(ativa).getByRole("button", { name: "Excluir Auditoria mensal" })).toBeInTheDocument();

    // botões de ATIVAR não ficam nos tipos já ativos
    expect(within(ativa).queryByRole("button", { name: /^Ativar/ })).toBeNull();
  });

  it("cria um tipo novo pelo dialog e recarrega a lista", async () => {
    render(<TiposTarefa />);
    await screen.findByText("Auditoria mensal");

    fireEvent.click(screen.getByRole("button", { name: /Novo tipo/ }));
    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText(/Nome do tipo/), {
      target: { value: "Peticionamento" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(criarTipoTarefa).toHaveBeenCalledWith({ nome: "Peticionamento" }));
    await waitFor(() => expect(listarTiposTarefa).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith("Tipo de tarefa criado.");
  });

  it("ativa o tipo inativo com PUT { ativo: true }", async () => {
    render(<TiposTarefa />);
    await screen.findByText("Revisão de contrato");

    fireEvent.click(
      within(linhaDe("Revisão de contrato")).getByRole("button", {
        name: "Ativar Revisão de contrato",
      }),
    );

    await waitFor(() =>
      expect(atualizarTipoTarefa).toHaveBeenCalledWith("tipo-2", { ativo: true }),
    );
    await waitFor(() => expect(listarTiposTarefa).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith('Tipo "Revisão de contrato" ativado.');
  });

  it("exclui com confirmação que avisa o SET NULL das tarefas", async () => {
    render(<TiposTarefa />);
    await screen.findByText("Auditoria mensal");

    fireEvent.click(
      within(linhaDe("Auditoria mensal")).getByRole("button", {
        name: "Excluir Auditoria mensal",
      }),
    );

    await waitFor(() => expect(excluirTipoTarefa).toHaveBeenCalledWith("tipo-1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tipo de tarefa excluído."));
    expect(confirmar).toHaveBeenCalledTimes(1);
    const aviso = confirmar.mock.calls[0][0];
    expect(aviso.title).toContain("Auditoria mensal");
    expect(aviso.description).toMatch(/SEM TIPO/);
    expect(aviso.description).toMatch(/SET NULL/);
  });
});
