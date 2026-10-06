import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock useOrgMembers + useAuth before importing the hook under test
vi.mock("@/hooks/useOrgMembers", () => ({
  useOrgMembers: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

import { usePermissions } from "@/hooks/usePermissions";
import { useOrgMembers } from "@/hooks/useOrgMembers";

const mockedUseOrgMembers = vi.mocked(useOrgMembers);

function setRole(papel: string, isAdmin = false) {
  mockedUseOrgMembers.mockReturnValue({
    members: [{ id: "m1", user_id: "user-1", papel, nome: "Test" }],
    orgId: "org-1",
    isAdmin,
    loading: false,
    currentMemberGroupModulos: null,
  });
}

const METRICAS_PATHS = [
  "/metricas",
  "/metricas/marketing",
  "/metricas/comercial",
  "/metricas/organicos",
  "/metricas/leads-diarios",
  "/metricas/metas",
  "/metricas/contratos-fechados",
  "/metricas/integracao-meta",
];

const MARKETING_PATHS = new Set([
  "/metricas/marketing",
  "/metricas/organicos",
  "/metricas/integracao-meta",
]);
const COMERCIAL_PATHS = new Set([
  "/metricas/comercial",
  "/metricas/leads-diarios",
  "/metricas/contratos-fechados",
]);
const OVERVIEW_PATHS = new Set([
  "/metricas",
  "/metricas/metas",
]);

describe("usePermissions — rotas de /metricas", () => {
  beforeEach(() => {
    mockedUseOrgMembers.mockReset();
  });

  describe("Admin", () => {
    beforeEach(() => setRole("admin", true));
    it("acessa todas as rotas de métricas", () => {
      const { result } = renderHook(() => usePermissions());
      for (const path of METRICAS_PATHS) {
        expect(result.current.canAccessPath(path), `admin: ${path}`).toBe(true);
      }
    });
  });

  describe("Marketing (marketing puro)", () => {
    beforeEach(() => setRole("marketing", false));
    it("acessa apenas as rotas de marketing", () => {
      const { result } = renderHook(() => usePermissions());
      for (const path of METRICAS_PATHS) {
        const allowed = MARKETING_PATHS.has(path);
        expect(result.current.canAccessPath(path), `marketing: ${path}`).toBe(allowed);
      }
    });
    it("nega overview e rotas comerciais", () => {
      const { result } = renderHook(() => usePermissions());
      for (const path of [...OVERVIEW_PATHS, ...COMERCIAL_PATHS]) {
        expect(result.current.canAccessPath(path), `marketing-bloqueio: ${path}`).toBe(false);
      }
    });
  });

  describe("Gerente de Marketing — também vê overview", () => {
    beforeEach(() => setRole("gerente_marketing", false));
    it("acessa rotas de marketing + overview", () => {
      const { result } = renderHook(() => usePermissions());
      for (const path of MARKETING_PATHS) {
        expect(result.current.canAccessPath(path), `gm mkt: ${path}`).toBe(true);
      }
      for (const path of OVERVIEW_PATHS) {
        expect(result.current.canAccessPath(path), `gm overview: ${path}`).toBe(true);
      }
      for (const path of COMERCIAL_PATHS) {
        expect(result.current.canAccessPath(path), `gm com: ${path}`).toBe(false);
      }
    });
  });

  describe("Comercial (closer)", () => {
    beforeEach(() => setRole("closer", false));
    it("acessa apenas as rotas comerciais", () => {
      const { result } = renderHook(() => usePermissions());
      for (const path of METRICAS_PATHS) {
        const allowed = COMERCIAL_PATHS.has(path);
        expect(result.current.canAccessPath(path), `comercial: ${path}`).toBe(allowed);
      }
    });
    it("nega overview e rotas de marketing", () => {
      const { result } = renderHook(() => usePermissions());
      for (const path of [...OVERVIEW_PATHS, ...MARKETING_PATHS]) {
        expect(result.current.canAccessPath(path), `comercial-bloqueio: ${path}`).toBe(false);
      }
    });
  });

  describe("Papel sem acesso (agronomo)", () => {
    beforeEach(() => setRole("agronomo", false));
    it("é bloqueado em todas as rotas de métricas", () => {
      const { result } = renderHook(() => usePermissions());
      for (const path of METRICAS_PATHS) {
        expect(result.current.canAccessPath(path), `agronomo: ${path}`).toBe(false);
      }
    });
  });
});
