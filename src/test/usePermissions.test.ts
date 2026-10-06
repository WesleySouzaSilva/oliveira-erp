import { describe, it, expect } from "vitest";

// Test ROLE_RESTRICTIONS logic extracted for unit testing
const ROLE_RESTRICTIONS: Record<string, string[]> = {
  advogado: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "relatorios-proprio", "comercial", "rh", "acordos"],
  agronomo: ["rh", "acordos"],
  admin: [],
  setor_acordos: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "equipe", "gestao", "comercial", "rh", "relatorios"],
};

function canAccess(papel: string, isAdmin: boolean, permKey: string): boolean {
  if (isAdmin) return true;
  const restrictions = ROLE_RESTRICTIONS[papel] || [];
  return !restrictions.includes(permKey);
}

describe("usePermissions logic", () => {
  it("admin can access everything", () => {
    expect(canAccess("admin", true, "laudos")).toBe(true);
    expect(canAccess("admin", true, "rh")).toBe(true);
    expect(canAccess("admin", true, "acordos")).toBe(true);
  });

  it("advogado cannot access laudos or climaticos", () => {
    expect(canAccess("advogado", false, "laudos")).toBe(false);
    expect(canAccess("advogado", false, "climaticos")).toBe(false);
    expect(canAccess("advogado", false, "novo-laudo")).toBe(false);
  });

  it("advogado can access processos", () => {
    expect(canAccess("advogado", false, "processos")).toBe(true);
    expect(canAccess("advogado", false, "vencimentos")).toBe(true);
  });

  it("agronomo can access laudos but not rh", () => {
    expect(canAccess("agronomo", false, "laudos")).toBe(true);
    expect(canAccess("agronomo", false, "rh")).toBe(false);
    expect(canAccess("agronomo", false, "acordos")).toBe(false);
  });

  it("setor_acordos can access acordos and processos but not laudos", () => {
    expect(canAccess("setor_acordos", false, "acordos")).toBe(true);
    expect(canAccess("setor_acordos", false, "processos")).toBe(true);
    expect(canAccess("setor_acordos", false, "laudos")).toBe(false);
  });

  it("unknown role has no restrictions", () => {
    expect(canAccess("unknown_role", false, "laudos")).toBe(true);
    expect(canAccess("unknown_role", false, "rh")).toBe(true);
  });
});

// Matriz expandida: papéis sectoriais x rotas críticas
const EXTENDED_RESTRICTIONS: Record<string, string[]> = {
  comercial: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "equipe", "gestao", "rh", "relatorios", "acordos"],
  marketing: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "clientes", "equipe", "gestao", "rh", "relatorios", "acordos"],
  coordenador: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "rh"],
  pos_venda: ["rh"],
};

function canAccessExt(papel: string, isAdmin: boolean, permKey: string): boolean {
  if (isAdmin) return true;
  const r = EXTENDED_RESTRICTIONS[papel] || [];
  return !r.includes(permKey);
}

describe("usePermissions — matriz de papéis sectoriais", () => {
  it("comercial bloqueia laudos/processos/rh mas libera clientes", () => {
    expect(canAccessExt("comercial", false, "laudos")).toBe(false);
    expect(canAccessExt("comercial", false, "processos")).toBe(false);
    expect(canAccessExt("comercial", false, "rh")).toBe(false);
    expect(canAccessExt("comercial", false, "clientes")).toBe(true);
  });

  it("marketing bloqueia processos/clientes/relatorios mas libera comercial", () => {
    expect(canAccessExt("marketing", false, "processos")).toBe(false);
    expect(canAccessExt("marketing", false, "clientes")).toBe(false);
    expect(canAccessExt("marketing", false, "rh")).toBe(false);
    expect(canAccessExt("marketing", false, "comercial")).toBe(true);
  });

  it("coordenador bloqueia produção de laudos mas libera gestão", () => {
    expect(canAccessExt("coordenador", false, "novo-laudo")).toBe(false);
    expect(canAccessExt("coordenador", false, "laudos")).toBe(false);
    expect(canAccessExt("coordenador", false, "gestao")).toBe(true);
    expect(canAccessExt("coordenador", false, "relatorios")).toBe(true);
  });

  it("pos_venda bloqueia apenas rh", () => {
    expect(canAccessExt("pos_venda", false, "rh")).toBe(false);
    expect(canAccessExt("pos_venda", false, "laudos")).toBe(true);
    expect(canAccessExt("pos_venda", false, "clientes")).toBe(true);
  });
});
