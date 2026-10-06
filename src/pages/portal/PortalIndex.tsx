import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalUser } from "@/hooks/usePortalUser";

/**
 * Dispatcher do /portal: manda o usuário externo pro portal certo.
 */
export default function PortalIndex() {
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
  let recovery = false;
  try { recovery = sessionStorage.getItem("oa_recovery") === "1"; } catch { /* noop */ }
  if (recovery) return <Navigate to="/portal/definir-senha" replace />;
  if (portal.status === "portal_empresa") return <Navigate to="/portal/demandas" replace />;
  if (portal.status === "portal_cliente") return <Navigate to="/portal/inicio" replace />;
  return <Navigate to="/acesso-negado" replace />;
}