import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import {
  Building2, ListChecks, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Users, X,
} from "lucide-react";
import { autenticadoApi, buscarUsuarioAtual, logoutApi, usuarioApi, type UsuarioApi } from "@/lib/api/http";
import { Button } from "@/components/ui/button";
import { TemaToggle } from "@/components/theme/TemaToggle";

/**
 * Layout dos módulos já migrados para a API própria (rotas `/erp/...`).
 *
 * É um shell enxuto de propósito: enquanto migramos módulo a módulo, o menu mostra só o que
 * já fala com a nossa API — o sistema antigo continua em `/` (Supabase). Quando um módulo
 * sai daqui, ele entra no `AppLayout` normal.
 *
 * Menu com recolhimento:
 *
 * - no desktop, o botão do topo recolhe a barra (`w-60` -> `w-[72px]`), some com os rótulos e
 *   deixa só os ícones centralizados; a escolha fica guardada no `localStorage`;
 * - no celular a barra vira uma gaveta que abre pelo hambúrguer (o menu recolhido do desktop
 *   não vale aqui: a gaveta abre cheia, com os rótulos), com fundo escurecido atrás.
 */
const CHAVE_MENU_RECOLHIDO = "oliveira:menu-recolhido";
const SUPABASE_CONFIGURADO = Boolean(import.meta.env.VITE_SUPABASE_URL);

export default function LayoutErp() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<UsuarioApi | null>(() => usuarioApi());
  /** Barra recolhida no desktop (só ícones). */
  const [recolhido, setRecolhido] = useState(
    () => window.localStorage.getItem(CHAVE_MENU_RECOLHIDO) === "1",
  );
  /** Gaveta do menu aberta no celular. */
  const [gavetaAberta, setGavetaAberta] = useState(false);

  // Token guardado mas sem usuário em cache? Confirma a sessão contra a API (GET /auth/me).
  useEffect(() => {
    if (!autenticadoApi() || usuario) return;
    buscarUsuarioAtual()
      .then(setUsuario)
      .catch(() => {
        /* 401 já limpa a sessão e o guard abaixo manda para o login */
      });
  }, [usuario]);

  // Janela grande o suficiente? A gaveta só faz sentido no celular.
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const fechar = () => setGavetaAberta(false);
    media.addEventListener("change", fechar);
    return () => media.removeEventListener("change", fechar);
  }, []);

  if (!autenticadoApi()) {
    return <Navigate to="/erp/entrar" replace />;
  }

  const sair = async () => {
    await logoutApi();
    navigate("/erp/entrar", { replace: true });
  };

  const alternarRecolhido = () => {
    setRecolhido((atual) => {
      window.localStorage.setItem(CHAVE_MENU_RECOLHIDO, atual ? "0" : "1");
      return !atual;
    });
  };

  /** Link do menu: ícone sempre; rótulo some quando a barra está recolhida. */
  const itemMenu = (icone: ReactNode, rotulo: string, destino: string) => (
    <NavLink
      to={destino}
      onClick={() => setGavetaAberta(false)}
      title={rotulo}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
          isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        } ${recolhido ? "lg:justify-center lg:px-0" : ""}`
      }
    >
      {icone}
      <span className={recolhido ? "lg:hidden" : ""}>{rotulo}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Barra de topo só no celular (menu recolhido vira gaveta) */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur">
        <button
          type="button"
          onClick={() => setGavetaAberta(true)}
          aria-label="Abrir menu"
          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-serif font-bold">Oliveira</span>
        <TemaToggle className="ml-auto" />
      </header>

      {/* Fundo escuro atrás da gaveta no celular */}
      {gavetaAberta && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setGavetaAberta(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`bg-card/40 border-r flex-col shrink-0 w-60 transition-[width] duration-200 ${
          gavetaAberta ? "flex fixed inset-y-0 left-0 z-50 shadow-2xl" : "hidden"
        } lg:flex lg:static lg:z-auto lg:shadow-none ${recolhido ? "lg:w-[72px]" : ""}`}
      >
        <div
          className={`px-4 py-4 border-b flex items-center gap-2 ${
            recolhido ? "lg:flex-col lg:gap-3 lg:px-2" : ""
          }`}
        >
          <span className="w-8 h-8 shrink-0 rounded-lg bg-primary text-primary-foreground grid place-items-center font-serif font-bold">
            O
          </span>
          <div className={`leading-tight min-w-0 ${recolhido ? "lg:hidden" : ""}`}>
            <p className="font-serif font-bold text-sm">Oliveira</p>
            <p className="text-[11px] text-muted-foreground">módulos na API</p>
          </div>
          <div className={`flex items-center gap-1 ${recolhido ? "lg:mt-1" : "ml-auto"}`}>
            <TemaToggle />
            <button
              type="button"
              onClick={alternarRecolhido}
              title={recolhido ? "Expandir menu" : "Recolher menu"}
              aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
              className="hidden lg:inline-flex w-7 h-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {recolhido ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setGavetaAberta(false)}
              aria-label="Fechar menu"
              className="lg:hidden w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {itemMenu(<ListChecks className="w-4 h-4" />, "Tarefas", "/erp/tarefas")}
          {itemMenu(<Users className="w-4 h-4" />, "Clientes", "/erp/clientes")}
        </nav>

        <div className={`p-3 border-t space-y-2 ${recolhido ? "lg:px-2" : ""}`}>
          <div
            className={`px-2 text-xs text-muted-foreground truncate ${recolhido ? "lg:hidden" : ""}`}
            title={usuario?.email}
          >
            {usuario?.nome || usuario?.email}
          </div>
          {SUPABASE_CONFIGURADO && (
            <Button
              variant="outline"
              size="sm"
              title="Sistema antigo"
              className={`w-full ${recolhido ? "lg:justify-center lg:px-0" : "justify-start"}`}
              asChild
            >
              <a href="/">
                <Building2 className="w-4 h-4 lg:mr-0" />
                <span className={recolhido ? "lg:hidden" : ""}>Sistema antigo</span>
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            title="Sair"
            className={`w-full ${recolhido ? "lg:justify-center lg:px-0" : "justify-start"}`}
            onClick={sair}
          >
            <LogOut className="w-4 h-4 lg:mr-0" />
            <span className={recolhido ? "lg:hidden" : ""}>Sair</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
