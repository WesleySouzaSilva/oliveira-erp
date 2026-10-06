import { lazy, Suspense } from "react";
import { useArea } from "@/contexts/AreaContext";
import Dashboard from "@/pages/Dashboard";

const PainelEmpresarial = lazy(() => import("@/components/dashboard/PainelEmpresarial"));
const PainelDemandasGerais = lazy(() => import("@/pages/demandasGerais/PainelDemandasGerais"));

/**
 * Home context-aware: renderiza o Painel Empresarial quando a área selecionada
 * é "Empresarial"; caso contrário, o Dashboard original do Agro (inalterado).
 */
export default function Home() {
  const { area } = useArea();
  if (area === "empresarial") {
    return (
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <PainelEmpresarial />
      </Suspense>
    );
  }
  if (area === "demandas-gerais" || area === "previdenciario") {
    return (
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <PainelDemandasGerais />
      </Suspense>
    );
  }
  return <Dashboard />;
}
