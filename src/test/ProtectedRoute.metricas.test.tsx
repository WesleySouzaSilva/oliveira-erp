import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/hooks/useOrgMembers", () => ({
  useOrgMembers: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));
vi.mock("@/hooks/useIsCeo", () => ({
  useIsCeo: () => ({ isCeo: false, loading: false }),
  useIsCeoReal: () => ({ isCeo: false, loading: false }),
}));
vi.mock("@/hooks/usePortalUser", () => ({
  usePortalUser: () => ({ loading: false, isPortal: false, status: null }),
  isPortalStatus: () => false,
}));

import { ProtectedRoute } from "@/components/ProtectedRoute";
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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path={path}
          element={
            <ProtectedRoute>
              <div data-testid="page">PAGE-OK</div>
            </ProtectedRoute>
          }
        />
        <Route path="/acesso-negado" element={<div data-testid="denied">DENIED</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const ALL = [
  "/metricas",
  "/metricas/marketing",
  "/metricas/comercial",
  "/metricas/organicos",
  "/metricas/leads-diarios",
  "/metricas/metas",
  "/metricas/contratos-fechados",
  "/metricas/integracao-meta",
];

describe("ProtectedRoute — /metricas", () => {
  beforeEach(() => mockedUseOrgMembers.mockReset());

  it("Admin: todas as rotas renderizam a página", () => {
    for (const path of ALL) {
      setRole("admin", true);
      const { container, unmount } = renderAt(path);
      expect(container.querySelector('[data-testid="page"]'), `admin ${path}`).not.toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).toBeNull();
      unmount();
    }
  });

  it("Marketing: libera marketing, bloqueia comercial/overview", () => {
    const allowed = new Set([
      "/metricas/marketing",
      "/metricas/organicos",
      "/metricas/integracao-meta",
    ]);
    for (const path of ALL) {
      setRole("marketing", false);
      const { container, unmount } = renderAt(path);
      if (allowed.has(path)) {
        expect(container.querySelector('[data-testid="page"]'), `mkt ok ${path}`).not.toBeNull();
      } else {
        expect(container.querySelector('[data-testid="denied"]'), `mkt deny ${path}`).not.toBeNull();
      }
      unmount();
    }
  });

  it("Comercial: libera comercial, bloqueia marketing/overview", () => {
    const allowed = new Set([
      "/metricas/comercial",
      "/metricas/leads-diarios",
      "/metricas/contratos-fechados",
    ]);
    for (const path of ALL) {
      setRole("sdr", false);
      const { container, unmount } = renderAt(path);
      if (allowed.has(path)) {
        expect(container.querySelector('[data-testid="page"]'), `com ok ${path}`).not.toBeNull();
      } else {
        expect(container.querySelector('[data-testid="denied"]'), `com deny ${path}`).not.toBeNull();
      }
      unmount();
    }
  });
});
