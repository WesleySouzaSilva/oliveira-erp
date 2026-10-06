import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { usePortalUser, isPortalStatus } from "@/hooks/usePortalUser";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { canAccessPath, loading: permissionsLoading } = usePermissions();
  const portal = usePortalUser();

  const blocked = !loading && !permissionsLoading && !!user && !canAccessPath(location.pathname);

  useEffect(() => {
    if (blocked) {
      toast.error("Acesso restrito", {
        description: `Você não tem permissão para acessar ${location.pathname}.`,
        id: `denied-${location.pathname}`,
      });
    }
  }, [blocked, location.pathname]);

  if (loading || (user && permissionsLoading) || (user && portal.status === "loading")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Usuário externo do portal NUNCA pode entrar em rotas internas
  if (isPortalStatus(portal.status)) {
    let recovery = false;
    try { recovery = sessionStorage.getItem("oa_recovery") === "1"; } catch { /* noop */ }
    return <Navigate to={recovery ? "/portal/definir-senha" : "/portal"} replace />;
  }

  if (blocked) {
    return <Navigate to="/acesso-negado" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
