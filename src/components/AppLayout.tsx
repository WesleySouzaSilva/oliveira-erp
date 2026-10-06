import { useState, useEffect, lazy, Suspense } from "react";
import { AppSidebar } from "./AppSidebar";
import { BugReportButton } from "./BugReportButton";
// Busca e assistente carregam sob demanda para aliviar a abertura do app.
const GlobalSearch = lazy(() => import("./GlobalSearch").then((m) => ({ default: m.GlobalSearch })));
const AssistenteIA = lazy(() => import("./AssistenteIA").then((m) => ({ default: m.AssistenteIA })));
import { DemoModeToggle } from "./DemoModeToggle";
import { VerComoControle, VerComoTarja } from "./VerComo";
import { useSessionTracker } from "@/hooks/useSessionTracker";
import { preloadMaisUsadasQuandoOcioso } from "@/lib/lazyRetry";
// import { RadarAlertBanner } from "./radar/RadarAlertBanner";
// import { useArea } from "@/contexts/AreaContext";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const COLLAPSED_LS_KEY = "oliveira:sidebar-collapsed-desktop";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  useSessionTracker();
  // Baixa em segundo plano o código das telas mais usadas (sem efeito visível).
  useEffect(() => { preloadMaisUsadasQuandoOcioso(); }, []);
  // const { area } = useArea();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_LS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_LS_KEY, collapsed ? "1" : "0");
    } catch { /* ignore */ }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} />
      <main className={`min-h-screen transition-[margin] duration-300 ease-in-out ${collapsed ? "lg:ml-0" : "lg:ml-60"}`}>
        <div className="sticky top-0 z-20">
        <VerComoTarja />
        {/* {area === "agro" && <RadarAlertBanner />} — faixas vermelhas removidas temporariamente */}
        {/* Top bar with global search */}
        <div className="bg-background/80 backdrop-blur-sm border-b px-4 sm:px-6 lg:px-10 py-2 flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="lg:flex hidden items-center justify-center w-9 h-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label={collapsed ? "Abrir menu lateral" : "Recolher menu lateral"}
            title={collapsed ? "Abrir menu lateral" : "Recolher menu lateral"}
          >
            {collapsed ? <PanelLeftOpen className="w-4.5 h-4.5" /> : <PanelLeftClose className="w-4.5 h-4.5" />}
          </button>
          <div className="flex-1" />
          <VerComoControle />
          <DemoModeToggle />
          <Suspense fallback={null}><GlobalSearch /></Suspense>
        </div>
        </div>
        <div className="w-full px-4 sm:px-6 lg:px-10 py-6 pt-4 lg:pt-6">
          {children}
        </div>
      </main>
      <BugReportButton variant="floating" />
      <Suspense fallback={null}><AssistenteIA /></Suspense>
    </div>
  );
}
