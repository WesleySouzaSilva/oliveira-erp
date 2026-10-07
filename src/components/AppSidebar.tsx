import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Pin, Users, Scale, FileText } from "lucide-react";
import { BugReportButton } from "@/components/BugReportButton";
import { NotificacoesDropdown } from "@/components/NotificacoesDropdown";
import { usePermissions } from "@/hooks/usePermissions";
import { usePinnedItems } from "@/hooks/usePinnedItems";
import { allSections } from "@/components/sidebar/sidebarNavData";
import { SidebarNavSection, NavItem } from "@/components/sidebar/SidebarNavSection";
import { SidebarUserSection } from "@/components/sidebar/SidebarUserSection";
import { AreaSwitcher } from "@/components/sidebar/AreaSwitcher";
import { useArea } from "@/contexts/AreaContext";
import { useIsCeo } from "@/hooks/useIsCeo";
import { useTemCodigosTribunais } from "@/hooks/useTemCodigosTribunais";
import { usePapelTrein } from "@/lib/treinamentos";
import { useOperacoesSemTitular } from "@/hooks/useOperacoesSemTitular";
import { preloadRota } from "@/lib/lazyRetry";
import { logoutApi } from "@/lib/api/http";

/** Ao passar o mouse ou focar um item do menu, baixa o código daquela tela. */
function preloadDoLink(e: { target: EventTarget | null }) {
  const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (a && a.origin === window.location.origin) preloadRota(a.pathname);
}

const SECTOR_DEFAULT_SECTION: Record<string, string> = {
  // Jurídico
  advogado: "juridico",
  assessor_juridico: "juridico",
  estagiario_direito: "juridico",
  coordenador: "juridico",
  setor_acordos: "juridico",
  // Negócios
  comercial: "negocios",
  closer: "negocios",
  sdr: "negocios",
  social_seller: "negocios",
  marketing: "negocios",
  gerente_marketing: "negocios",
  criacao: "negocios",
  copywriter: "negocios",
  social_media: "negocios",
  // Pós-Venda
  pos_venda: "pos-venda",
  gestor_pos_venda: "pos-venda",
  advogado_pos_venda: "pos-venda",
  estagiario_pos_venda: "pos-venda",
  // Técnico de campo
  agronomo: "clientes",
  engenheiro_agronomo: "clientes",
};

const PIN_ICON: Record<string, any> = {
  cliente: Users,
  processo: Scale,
  laudo: FileText,
};

const SECTIONS_LS_KEY = "oliveira:sidebar-collapsed-sections";

export function AppSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { canAccess, isAdmin, loading: permissionsLoading, papel, allowedAreas } = usePermissions();
  const { isCeo } = useIsCeo();
  const temCodigosTribunais = useTemCodigosTribunais();
  const semTitular = useOperacoesSemTitular();
  const papelTrein = usePapelTrein();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pinnedItems = usePinnedItems();

  // Área selecionada (Agro / Empresarial) vem do contexto compartilhado.
  // A persistência em localStorage (`oliveira:sidebar-area`) é feita pelo provider.
  const { area, setArea } = useArea();

  // Se a área ativa não é permitida ao usuário, cai para a primeira liberada.
  useEffect(() => {
    if (permissionsLoading || allowedAreas.length === 0) return;
    if (!allowedAreas.includes(area as any)) setArea(allowedAreas[0] as any);
  }, [permissionsLoading, allowedAreas, area, setArea]);

  // Filtra seções pela área selecionada (transversais sempre aparecem).
  const areaFilteredSections = useMemo(
    () => allSections
      .filter((s) => !s.area || s.area === "transversal" || s.area === area)
      .filter((s) => !s.ceoOnly || isCeo),
    [area, isCeo]
  );

  // "Treinamentos" só aparece quando há conteúdo para a pessoa; enquanto a
  // consulta não volta, fica oculto (não pisca).
  const comGateTrein = areaFilteredSections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.gate !== "treinamentos" || (!papelTrein.carregando && papelTrein.ve_menu)) }))
    .filter((s) => s.items.length > 0);

  const sections = permissionsLoading
    ? comGateTrein
    : comGateTrein.map(section => ({
        ...section,
        items: section.items
          .filter(item => !item.permKey || canAccess(item.permKey))
          .filter(item => !item.adminOnly || isAdmin)
          .filter(item => item.gate !== "codigos-tribunais" || temCodigosTribunais)
          .filter(item => item.gate !== "operacoes-sem-titular" || semTitular > 0)
          .map(item => ({
            ...item,
            children: item.children?.filter(child => !child.permKey || canAccess(child.permKey)),
          }))
          // If the item originally had children but all were filtered out, hide it.
          .filter(item => {
            const original = section.items.find(i => i.path === item.path);
            const hadChildren = !!original?.children && original.children.length > 0;
            if (!hadChildren) return true;
            return !!item.children && item.children.length > 0;
          }),
      })).filter(section => section.items.length > 0);

  // Estado de colapso por seção, persistido em localStorage.
  // Default: somente a seção do setor do usuário (e "inicio") fica aberta.
  const defaultCollapsed = useMemo(() => {
    const userSector = SECTOR_DEFAULT_SECTION[papel] || "inicio";
    const open = new Set(["inicio", userSector]);
    if (isAdmin) open.add("admin");
    const out: Record<string, boolean> = {};
    sections.forEach((s) => {
      if (s.id) out[s.id] = !open.has(s.id);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papel, isAdmin, sections.length]);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(SECTIONS_LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });

  // Aplica defaults uma vez quando permissões carregam (sem sobrescrever escolhas do usuário).
  useEffect(() => {
    if (permissionsLoading) return;
    setCollapsedSections((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.entries(defaultCollapsed).forEach(([k, v]) => {
        if (next[k] === undefined) { next[k] = v; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [permissionsLoading, defaultCollapsed]);

  useEffect(() => {
    try { localStorage.setItem(SECTIONS_LS_KEY, JSON.stringify(collapsedSections)); } catch { /* ignore */ }
  }, [collapsedSections]);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((s) =>
      s.items.forEach((item) => {
        if (item.children) {
          const isChildActive = item.children.some((c) => location.pathname === c.path);
          if (isChildActive) initial[item.path] = true;
        }
      })
    );
    return initial;
  });

  const toggleMenu = (path: string) => {
    setOpenMenus((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const userEmail = user?.email || "";
  const userInitials = userEmail.slice(0, 2).toUpperCase();

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: NavItem) => {
    if (!item.children) return false;
    return item.children.some((c) => location.pathname === c.path || location.pathname.startsWith(c.path + "/"));
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      /* Supabase indisponivel em ambiente local: a saida da API propria segue */
    }
    await logoutApi();
    navigate("/erp/entrar");
  };

  const renderSidebarContent = (onClose?: () => void) => (
    <div className="relative flex flex-col h-full">
      {/* Filete do squad ativo na borda esquerda da sidebar */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-area-accent" />
      <div className="relative px-3 pt-4 pb-3 flex items-center gap-2 pr-16">
        <AreaSwitcher value={area} onChange={setArea} allowed={allowedAreas as any} />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <NotificacoesDropdown />
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden h-10 w-10 flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground rounded"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      <nav
        className="flex-1 px-3 space-y-1 overflow-y-auto"
        onPointerOver={preloadDoLink}
        onFocus={preloadDoLink}
      >
        {pinnedItems.length > 0 && (
          <div>
            <p className="px-3 pt-5 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-accent/70 flex items-center gap-1">
              <Pin className="w-3 h-3" /> Favoritos
            </p>
            {pinnedItems.map((p) => {
              const Icon = PIN_ICON[p.type] || Pin;
              const active = location.pathname === p.path;
              return (
                <Link
                  key={`pin-${p.type}-${p.id}`}
                  to={p.path}
                  onClick={() => setMobileOpen(false)}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                  title={p.title}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-accent" />
                  )}
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{p.title}</span>
                </Link>
              );
            })}
          </div>
        )}
        {sections.map((section, sIdx) => (
          <SidebarNavSection
            key={section.id || sIdx}
            section={section}
            isActive={isActive}
            isParentActive={isParentActive}
            openMenus={openMenus}
            toggleMenu={toggleMenu}
            onMobileClose={() => setMobileOpen(false)}
            collapsed={section.id ? !!collapsedSections[section.id] : false}
            onToggleSection={section.id ? () => toggleSection(section.id!) : undefined}
          />
        ))}
        <div className="mt-2 border-t border-sidebar-border pt-2">
          <BugReportButton variant="sidebar" />
        </div>
      </nav>
      <SidebarUserSection userEmail={userEmail} userInitials={userInitials} onSignOut={handleSignOut} />
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:flex bg-sidebar flex-col fixed inset-y-0 left-0 z-30 transition-[width] duration-300 ease-in-out overflow-hidden ${
          collapsed ? "w-0" : "w-60"
        }`}
      >
        <div className="w-60 shrink-0 h-full">
          {renderSidebarContent()}
        </div>
      </aside>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-primary text-primary-foreground shadow-card"
      >
        <Menu className="w-5 h-5" />
      </button>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/40 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-60 bg-sidebar z-50 lg:hidden"
            >
              {renderSidebarContent(() => setMobileOpen(false))}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
