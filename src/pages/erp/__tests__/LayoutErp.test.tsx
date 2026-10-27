import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LayoutErp from "@/components/erp/LayoutErp";

/** Usuário de retorno do /auth/me (mockável por teste). */
const usuarioAdmin = {
  id: "u-1",
  email: "admin@oliveira.test",
  nome: "Admin",
  admin: true,
  ceo: false,
};

vi.mock("@/lib/api/http", () => ({
  autenticadoApi: () => true,
  usuarioApi: () => usuarioAdmin,
  buscarUsuarioAtual: vi.fn(async () => usuarioAdmin),
  logoutApi: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/useNotificacoes", () => ({
  useNotificacoes: () => ({ naoLidas: 0 }),
}));

vi.mock("@/components/theme/TemaToggle", () => ({
  TemaToggle: () => null,
}));

const montar = () =>
  render(
    <MemoryRouter initialEntries={["/erp/tarefas"]}>
      <LayoutErp />
    </MemoryRouter>,
  );

describe("LayoutErp — menu", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("administrador vê o grupo Administração com Usuários, Permissões e Auditoria", () => {
    montar();
    expect(screen.getByRole("button", { name: /administração/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /usuários/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /permissões/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /auditoria/i })).toBeTruthy();
  });

  it("CEO sem admin não vê Administração, mas vê Cadastro", () => {
    usuarioAdmin.admin = false;
    usuarioAdmin.ceo = true;
    try {
      montar();
      expect(screen.queryByRole("link", { name: /usuários/i })).toBeNull();
      expect(screen.getByRole("button", { name: /cadastro/i })).toBeTruthy();
      expect(screen.getByRole("link", { name: /bancos/i })).toBeTruthy();
    } finally {
      usuarioAdmin.admin = true;
      usuarioAdmin.ceo = false;
    }
  });

  it("clicar no grupo fecha e reabre os itens dele (submenu retrátil)", () => {
    montar();
    const cabecalho = screen.getByRole("button", { name: /cadastro/i });
    expect(cabecalho.getAttribute("aria-expanded")).toBe("true");

    // fecha: os itens somem
    fireEvent.click(cabecalho);
    expect(cabecalho.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: /bancos/i })).toBeNull();

    // reabre: os itens voltam
    fireEvent.click(cabecalho);
    expect(cabecalho.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: /bancos/i })).toBeTruthy();
  });

  it("grupos começam abertos e a escolha fica guardada no localStorage", () => {
    montar();
    const comercial = screen.getByRole("button", { name: /comercial/i });
    fireEvent.click(comercial);
    expect(window.localStorage.getItem("oliveira:menu-grupos")).toContain('"comercial":false');
  });
});
