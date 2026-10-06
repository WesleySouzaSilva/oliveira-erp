import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalUser, isPortalStatus, type PortalStatus } from "@/hooks/usePortalUser";

/**
 * Guard do PORTAL DO CLIENTE.
 * - Sem login → /auth
 * - Membro interno (em `membros`) → redireciona para "/" (não acessa o portal)
 * - Sem vínculo (nem membro, nem portal) → /acesso-negado
 * - Usuário do portal → renderiza filhos
 */
export function PortalRoute({
  children,
  require,
}: {
  children: React.ReactNode;
  /** Restringe a um tipo específico de usuário externo. Sem valor = qualquer portal. */
  require?: "empresa" | "cliente";
}) {
  const { user, loading } = useAuth();
  const portal = usePortalUser();

  if (loading || (user && portal.status === "loading")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/portal/login" replace />;
  if (portal.status === "interno") return <Navigate to="/" replace />;
  if (!isPortalStatus(portal.status)) return <Navigate to="/acesso-negado" replace />;
  const need: PortalStatus | null =
    require === "empresa" ? "portal_empresa" : require === "cliente" ? "portal_cliente" : null;
  if (need && portal.status !== need) return <Navigate to="/portal" replace />;
  return <>{children}</>;
}