import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MensagensBadge } from "./MensagensBadge";

export interface NavChildItem {
  icon: any;
  label: string;
  path: string;
  permKey?: string;
  adminOnly?: boolean;
}

export interface NavItem {
  icon: any;
  label: string;
  path: string;
  accent?: boolean;
  pro?: boolean;
  permKey?: string;
  adminOnly?: boolean;
  ceoOnly?: boolean;
  description?: string;
  /** Portão dinâmico (não é permKey de grupo). Resolvido no AppSidebar. */
  gate?: "codigos-tribunais" | "operacoes-sem-titular" | "treinamentos";
  children?: NavChildItem[];
}

export interface NavSection {
  id?: string;
  title: string;
  items: NavItem[];
  /**
   * Área de atuação a que a seção pertence. Usado pelo seletor de área no
   * topo do sidebar para alternar contexto (Agro / Empresarial). Seções
   * marcadas como 'transversal' aparecem em todas as áreas.
   * Default (quando ausente): 'transversal'.
   */
  area?: "transversal" | "agro" | "empresarial" | "demandas-gerais" | "previdenciario";
  /** Quando true, só aparece para o CEO (filtrado em AppSidebar). */
  ceoOnly?: boolean;
}

interface SidebarNavSectionProps {
  section: NavSection;
  isActive: (path: string) => boolean;
  isParentActive: (item: NavItem) => boolean;
  openMenus: Record<string, boolean>;
  toggleMenu: (path: string) => void;
  onMobileClose: () => void;
  collapsed?: boolean;
  onToggleSection?: () => void;
}

export function SidebarNavSection({
  section,
  isActive,
  isParentActive,
  openMenus,
  toggleMenu,
  onMobileClose,
  collapsed = false,
  onToggleSection,
}: SidebarNavSectionProps) {
  const withTooltip = (node: React.ReactNode, description?: string) => {
    if (!description) return node;
    return (
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>{node as any}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          sideOffset={8}
          collisionPadding={12}
          className="w-[220px] max-w-[80vw] text-[12px] font-normal leading-[1.4] whitespace-normal break-words text-balance"
        >
          {description}
        </TooltipContent>
      </Tooltip>
    );
  };
  const collapsible = !!onToggleSection;
  return (
    <div>
      {section.title && (
        collapsible ? (
          <button
            type="button"
            onClick={onToggleSection}
            className="w-full flex items-center gap-1 px-3 pt-5 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-accent/70 hover:text-accent transition-colors"
          >
            <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${collapsed ? "" : "rotate-90"}`} />
            <span>{section.title}</span>
          </button>
        ) : (
          <p className="px-3 pt-5 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-accent/70">
            {section.title}
          </p>
        )
      )}
      {!collapsed && section.items.map((item) => {
        const Icon = item.icon;
        const hasChildren = !!item.children && item.children.length > 0;
        const parentActive = isParentActive(item);
        const menuOpen = openMenus[item.path] || parentActive;

        if (hasChildren) {
          return (
            <div key={item.path}>
              {withTooltip(
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); toggleMenu(item.path); }}
                className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  parentActive
                    ? "bg-area-accent/15 text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                {parentActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-area-accent" />
                )}
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
              </button>,
              item.description)}
              <AnimatePresence initial={false}>
                {menuOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 pl-3 border-l border-sidebar-border space-y-0.5 py-1">
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = isActive(child.path);
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={onMobileClose}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                              childActive
                                ? "bg-sidebar-accent/80 text-accent font-semibold"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                            }`}
                          >
                            <ChildIcon className="w-4 h-4 shrink-0" />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }

        const active = isActive(item.path);
        return (
          <div key={item.path}>
          {withTooltip(
          <Link
            key={item.path}
            to={item.path}
            onClick={onMobileClose}
            className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              active
                ? "bg-area-accent/15 text-sidebar-accent-foreground font-semibold"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            } ${item.accent ? "text-accent font-semibold" : ""}`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-area-accent" />
            )}
            <Icon className="w-5 h-5 shrink-0" />
            <span>{item.label}</span>
            {item.pro && (
              <span className="ml-auto text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-semibold">PRO</span>
            )}
            {item.path === "/mensagens" && <MensagensBadge />}
          </Link>,
          item.description)}
          </div>
        );
      })}
    </div>
  );
}
