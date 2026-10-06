import { ReactNode, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  FileText,
  Handshake,
  Home,
  Landmark,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Scale,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalUser } from "@/hooks/usePortalUser";
import { usePortalCliente } from "@/hooks/usePortalCliente";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import logoDark from "@/assets/logo-dark.png";
import logoSymbol from "@/assets/logo-symbol.png";
import { PortalOlivia } from "./PortalOlivia";
import { tempoRelativo } from "./portalUi";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: number };

const NAV_CLIENTE: NavItem[] = [
  { to: "/portal/inicio", label: "Início", icon: Home },
  { to: "/portal/processos", label: "Processos", icon: Scale },
  { to: "/portal/contratos", label: "Contratos", icon: Landmark },
  { to: "/portal/chamados", label: "Chamados", icon: LifeBuoy },
  { to: "/portal/atendimentos", label: "Atendimentos", icon: MessageSquare },
  { to: "/portal/acordos", label: "Acordos", icon: Handshake },
];

const NAV_EMPRESA: NavItem[] = [
  { to: "/portal/demandas", label: "Demandas", icon: FileText },
  { to: "/portal/servicos", label: "Serviços", icon: Building2 },
  { to: "/portal/pedidos", label: "Meus Pedidos", icon: LifeBuoy },
  { to: "/portal/relatorios", label: "Relatórios", icon: Scale },
  { to: "/portal/meu-plano", label: "Meu Plano", icon: Handshake },
];

/** Itens que cabem na barra inferior do celular (o resto fica acessível pelo Início). */
const NAV_MOBILE_CLIENTE = ["/portal/inicio", "/portal/processos", "/portal/contratos", "/portal/chamados"];

export function PortalLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const portal = usePortalUser();
  const { cliente, chamados, notificacoes, invalidar } = usePortalCliente();
  const [oliviaAberta, setOliviaAberta] = useState(false);

  const isCliente = portal.status === "portal_cliente";
  const isEmpresa = portal.status === "portal_empresa";

  const chamadosAguardando = (chamados.data || []).filter((c) => c.status === "aguardando_cliente").length;
  const naoLidas = (notificacoes.data || []).filter((n) => !n.lida);

  const nav: NavItem[] = isCliente
    ? NAV_CLIENTE.map((i) => (i.to === "/portal/chamados" && chamadosAguardando ? { ...i, badge: chamadosAguardando } : i))
    : isEmpresa
    ? NAV_EMPRESA
    : [];
  const navMobile = isCliente ? nav.filter((i) => NAV_MOBILE_CLIENTE.includes(i.to)) : nav.slice(0, 4);

  const handleLogout = async () => {
    await signOut();
    navigate("/portal/login", { replace: true });
  };

  const marcarLidas = async () => {
    const ids = naoLidas.map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notificacoes_sistema").update({ lida: true }).in("id", ids);
    invalidar("notificacoes");
  };

  const primeiroNome = (cliente.data?.nome || "").trim().split(/\s+/)[0] || "";

  return (
    <div className="min-h-dvh bg-background flex">
      {/* ---------------- Menu lateral (desktop) ---------------- */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-primary text-primary-foreground">
        <Link to="/portal" className="px-6 pt-7 pb-5 flex items-center gap-3">
          <img src={logoDark} alt="Oliveira Agro" className="h-14 w-auto" />
        </Link>
        <div className="px-6 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Portal do Cliente</p>
          {cliente.data?.nome && (
            <p className="mt-1 text-sm text-primary-foreground/85 leading-snug line-clamp-2">{cliente.data.nome}</p>
          )}
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary-foreground/10 text-primary-foreground font-medium"
                    : "text-primary-foreground/70 hover:bg-primary-foreground/5 hover:text-primary-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        {isCliente && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => setOliviaAberta(true)}
              className="w-full flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-3 text-left hover:bg-accent/20 transition-colors"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-medium">Falar com a OlivIA</span>
                <span className="block text-[11px] text-primary-foreground/70">Assistente do escritório</span>
              </span>
            </button>
          </div>
        )}
        <div className="border-t border-primary-foreground/10 px-4 py-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-primary-foreground/60 truncate">{user?.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 text-[11px] text-primary-foreground/70 hover:text-primary-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </aside>

      {/* ---------------- Conteúdo ---------------- */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
            <Link to="/portal" className="flex items-center gap-2 lg:hidden">
              <img src={logoSymbol} alt="" className="h-7 w-auto" />
              <span className="font-display text-sm font-semibold text-foreground">Portal do Cliente</span>
            </Link>
            <div className="hidden lg:block text-sm text-muted-foreground">
              {primeiroNome ? `Olá, ${primeiroNome}.` : ""}
            </div>
            <div className="flex items-center gap-1">
              <Popover onOpenChange={(o) => { if (!o) void marcarLidas(); }}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notificações">
                    <Bell className="h-[18px] w-[18px]" />
                    {naoLidas.length > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="px-3 py-2 border-b border-border text-xs font-semibold text-foreground">Notificações</div>
                  <ul className="max-h-80 overflow-y-auto divide-y divide-border">
                    {(notificacoes.data || []).length === 0 && (
                      <li className="px-3 py-6 text-center text-xs text-muted-foreground">Nada por aqui ainda.</li>
                    )}
                    {(notificacoes.data || []).map((n) => (
                      <li key={n.id} className={cn("px-3 py-2.5 text-xs", !n.lida && "bg-accent/5")}>
                        <p className="text-foreground leading-snug">{n.mensagem}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{tempoRelativo(n.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
              {isCliente && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-accent hover:text-accent"
                  onClick={() => setOliviaAberta(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">OlivIA</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={handleLogout} aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-5 sm:py-7 pb-24 lg:pb-10">{children}</main>

        <footer className="hidden lg:block border-t border-border py-3 text-center text-[11px] text-muted-foreground">
          Oliveira Agro · você vê aqui o que a equipe liberou para acompanhamento. Dúvidas? Abra um chamado.
        </footer>
      </div>

      {/* ---------------- Barra inferior (celular) ---------------- */}
      {navMobile.length > 0 && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${navMobile.length}, minmax(0, 1fr))` }}>
            {navMobile.map((item) => {
              const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "relative flex flex-col items-center gap-0.5 py-2 text-[11px]",
                      active ? "text-primary font-medium" : "text-muted-foreground",
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", active && "text-accent")} />
                    {item.label}
                    {item.badge ? (
                      <span className="absolute top-1 right-[22%] h-2 w-2 rounded-full bg-accent" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {isCliente && <PortalOlivia aberta={oliviaAberta} onFechar={() => setOliviaAberta(false)} />}
    </div>
  );
}
