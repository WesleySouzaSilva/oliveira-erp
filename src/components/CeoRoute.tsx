import { Navigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useIsCeo } from "@/hooks/useIsCeo";

/**
 * Guard de rota EXCLUSIVO do CEO. Encadeia `ProtectedRoute` (login + portal)
 * e depois checa `is_ceo` na tabela membros. Não-CEO é redirecionado para
 * /acesso-negado. A fronteira real é o RLS — este guard é só UX.
 */
export function CeoRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <CeoGate>{children}</CeoGate>
    </ProtectedRoute>
  );
}

function CeoGate({ children }: { children: React.ReactNode }) {
  const { isCeo, loading } = useIsCeo();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isCeo) {
    return <Navigate to="/acesso-negado" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}