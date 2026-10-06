import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Building2, LogOut, Users } from "lucide-react";
import { autenticadoApi, buscarUsuarioAtual, logoutApi, usuarioApi, type UsuarioApi } from "@/lib/api/http";
import { Button } from "@/components/ui/button";

/**
 * Layout dos módulos já migrados para a API própria (rotas `/erp/...`).
 *
 * É um shell enxuto de propósito: enquanto migramos módulo a módulo, o menu mostra só o que
 * já fala com a nossa API — o sistema antigo continua em `/` (Supabase). Quando um módulo
 * sai daqui, ele entra no `AppLayout` normal.
 */
export default function LayoutErp() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<UsuarioApi | null>(() => usuarioApi());

  // Token guardado mas sem usuário em cache? Confirma a sessão contra a API (GET /auth/me).
  useEffect(() => {
    if (!autenticadoApi() || usuario) return;
    buscarUsuarioAtual()
      .then(setUsuario)
      .catch(() => {
        /* 401 já limpa a sessão e o guard abaixo manda para o login */
      });
  }, [usuario]);

  if (!autenticadoApi()) {
    return <Navigate to="/erp/entrar" replace />;
  }

  const sair = async () => {
    await logoutApi();
    navigate("/erp/entrar", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 shrink-0 border-r bg-card/40 flex flex-col">
        <div className="px-4 py-4 border-b flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-serif font-bold">
            O
          </span>
          <div className="leading-tight">
            <p className="font-serif font-bold text-sm">Oliveira</p>
            <p className="text-[11px] text-muted-foreground">módulos na API</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLink
            to="/erp/clientes"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <Users className="w-4 h-4" /> Clientes
          </NavLink>
        </nav>

        <div className="p-3 border-t space-y-2">
          <div className="px-2 text-xs text-muted-foreground truncate" title={usuario?.email}>
            {usuario?.nome || usuario?.email}
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start" asChild>
            <a href="/">
              <Building2 className="w-4 h-4 mr-2" /> Sistema antigo
            </a>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={sair}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
