import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroApi } from "@/lib/api/http";
import Usuarios from "@/pages/erp/Usuarios";

/**
 * Menu Usuários (admin): listagem + cadastro + edição dentro da plataforma.
 *
 * O formulário não tem mais "Papel": o bloco de vínculo é SETOR (1..N, cada linha com o
 * intervalo de valor de contrato) + OBJETOS (menu de seleção com a lista do cadastro de
 * Objetos) — pedidos do titular em 15/10/2026. Não-admin nem enxerga a tela: só o aviso
 * de acesso restrito, sem nenhuma chamada.
 */

const listarUsuarios = vi.fn();
const criarUsuario = vi.fn();
const atualizarUsuario = vi.fn();
let administrador = true;

vi.mock("@/lib/api/usuarios", () => ({
  listarUsuarios: (...args: unknown[]) => listarUsuarios(...args),
  criarUsuario: (...args: unknown[]) => criarUsuario(...args),
  atualizarUsuario: (...args: unknown[]) => atualizarUsuario(...args),
}));

vi.mock("@/lib/api/setores", () => ({
  listarSetores: vi.fn(async () => [
    { id: "setor-1", nome: "Agronegocio" },
    { id: "setor-2", nome: "Empresarial" },
  ]),
}));

vi.mock("@/lib/api/objetos", () => ({
  listarTiposObjeto: vi.fn(async () => [
    { id: "obj-1", tipoObjeto: "Arroz" },
    { id: "obj-2", tipoObjeto: "Soja" },
  ]),
}));

vi.mock("@/lib/api/http", async (importar) => {
  const original = await importar<typeof import("@/lib/api/http")>();
  return {
    ...original,
    usuarioApi: () => ({
      id: "u1",
      email: "admin@oliveira.com.br",
      admin: administrador,
      ceo: false,
      permissoes: [],
    }),
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  administrador = true;
  listarUsuarios.mockReset();
  criarUsuario.mockReset();
  atualizarUsuario.mockReset();
  criarUsuario.mockResolvedValue({ id: "novo", email: "joao@oliveira.com.br" });
  listarUsuarios.mockResolvedValue([
    {
      id: "u2",
      email: "maria@oliveira.com.br",
      nome: "Maria Souza",
      papel: "advogado",
      ceo: false,
      ativo: true,
      setores: [{ id: "setor-2", nome: "Empresarial", valorMin: 10000, valorMax: 50000 }],
      objetos: [{ id: "obj-1", tipoObjeto: "Arroz" }],
    },
  ]);
});

async function abrirFormularioNovo() {
  render(<Usuarios />);
  expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Novo usuário/ }));
  expect(await screen.findByText(/Setores em que a pessoa trabalha/)).toBeInTheDocument();
}

describe("Usuários", () => {
  it("admin vê a listagem com o setor (com a faixa) e os objetos da pessoa", async () => {
    render(<Usuarios />);

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("maria@oliveira.com.br")).toBeInTheDocument();
    expect(screen.getByText(/Empresarial/)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 10\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("Arroz")).toBeInTheDocument();
    expect(listarUsuarios).toHaveBeenCalledTimes(1);
  });

  it("não-admin vê só o aviso de acesso restrito e não busca nada", () => {
    administrador = false;
    render(<Usuarios />);

    expect(screen.getByText("Acesso restrito")).toBeInTheDocument();
    expect(listarUsuarios).not.toHaveBeenCalled();
  });

  it("formulário tem bloco de setores (1..N com intervalo) e o menu de seleção de objetos", async () => {
    await abrirFormularioNovo();

    expect(screen.getByLabelText(/E-mail/)).toBeTruthy();
    // sem o select de Papel: o bloco de vínculo agora é o setor
    expect(screen.queryByLabelText("Papel")).toBeNull();

    // adiciona a linha de setor e informa o intervalo de valor
    fireEvent.click(screen.getByRole("button", { name: "Adicionar setor" }));
    fireEvent.change(screen.getByLabelText("Setor"), { target: { value: "setor-1" } });
    fireEvent.change(screen.getByLabelText("De R$"), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText("Até R$"), { target: { value: "50000" } });

    // menu de seleção de objetos (combobox com a lista do cadastro de Objetos)
    fireEvent.click(screen.getByRole("combobox", { name: "Objetos atendidos" }));
    const opcaoArroz = await screen.findByRole("option", { name: "Arroz" });
    fireEvent.click(opcaoArroz);
    expect(screen.getByText("1 objeto selecionado")).toBeInTheDocument();
  });

  it("cadastra com setor + faixa e objetos no payload", async () => {
    await abrirFormularioNovo();

    fireEvent.change(screen.getByLabelText(/Nome/), { target: { value: "João Silva" } });
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: "joao@oliveira.com.br" } });
    fireEvent.change(screen.getByLabelText(/Senha/), { target: { value: "senha12345" } });
    // a função (antigo papel) agora é campo do formulário
    fireEvent.change(screen.getByLabelText(/Função/), { target: { value: "advogado" } });

    fireEvent.click(screen.getByRole("button", { name: "Adicionar setor" }));
    fireEvent.change(screen.getByLabelText("Setor"), { target: { value: "setor-1" } });
    fireEvent.change(screen.getByLabelText("De R$"), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText("Até R$"), { target: { value: "50000" } });

    fireEvent.click(screen.getByRole("combobox", { name: "Objetos atendidos" }));
    fireEvent.click(await screen.findByRole("option", { name: "Arroz" }));

    fireEvent.click(screen.getByRole("button", { name: /Cadastrar usuário/ }));

    await waitFor(() => expect(criarUsuario).toHaveBeenCalledTimes(1));
    expect(criarUsuario).toHaveBeenCalledWith({
      email: "joao@oliveira.com.br",
      senha: "senha12345",
      nome: "João Silva",
      papel: "advogado",
      // sem permissão escolhida no form -> grupo nulo (a pessoa fica no básico)
      permissionGroupId: null,
      setores: [{ setorId: "setor-1", valorMin: 10000, valorMax: 50000 }],
      objetos: ["obj-1"],
    });
  });

  it("API sem a rota /usuarios: avisa e o resto da página (setores/objetos) continua", async () => {
    // é o caso do servidor com a API antiga: /usuarios dá 500/404
    listarUsuarios.mockRejectedValue(
      new ErroApi("Ocorreu um erro interno inesperado no servidor.", { status: 500 }),
    );

    render(<Usuarios />);

    expect(await screen.findByText("Cadastro de usuários ainda não publicado")).toBeInTheDocument();

    // a chamada de vínculos não foi derrubada junto: o formulário já tem setores e objetos
    fireEvent.click(screen.getByRole("button", { name: /Novo usuário/ }));
    expect(await screen.findByText(/Setores em que a pessoa trabalha/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar setor" }));
    expect(screen.getByLabelText("Setor")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Objetos atendidos" })).toBeTruthy();
  });
});
