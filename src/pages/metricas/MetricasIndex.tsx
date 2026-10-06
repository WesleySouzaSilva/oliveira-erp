import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import MetricasDashboard from "./Dashboard";
import { PageLoader } from "@/components/ui/loaders";

/**
 * Roteador de entrada de /metricas:
 * - Admin / Gerente Mkt / Coordenador → mostram o Dashboard (overview)
 * - Marketing puro → redireciona para /metricas/marketing
 * - Comercial puro → redireciona para /metricas/comercial
 */
export default function MetricasIndex() {
  const { isAdmin, isMarketing, isComercial, papel, loading } = usePermissions();
  const navigate = useNavigate();

  // Admin e Coordenador vêem o dashboard consolidado.
  // Gerente de Marketing vai direto para o overview de marketing.
  const showConsolidated = isAdmin || papel === "coordenador";

  useEffect(() => {
    if (loading || showConsolidated) return;
    if (papel === "gerente_marketing" || isMarketing) {
      navigate("/metricas/overview-marketing", { replace: true });
    } else if (isComercial) {
      navigate("/metricas/overview-comercial", { replace: true });
    }
  }, [loading, showConsolidated, isMarketing, isComercial, papel, navigate]);

  if (loading) {
    return (
      <PageLoader />
    );
  }

  if (showConsolidated) return <MetricasDashboard />;

  // Sem nenhum acesso a métricas → mandar embora
  if (papel !== "gerente_marketing" && !isMarketing && !isComercial)
    return <Navigate to="/acesso-negado" replace />;

  // Em transição (useEffect ainda navegando)
  return (
    <PageLoader />
  );
}