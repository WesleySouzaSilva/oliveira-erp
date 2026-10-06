import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useVerComoAlvo } from "@/hooks/useVerComoAlvo";
import { useAuth } from "@/contexts/AuthContext";
import { expandModulesToPermKeys, AREA_MODULE_KEYS } from "@/lib/permissionModules";

export type AreaKey = "agro" | "empresarial" | "demandas-gerais" | "previdenciario";
const AREA_PERM: Record<AreaKey, string> = {
  agro: "area-agro",
  empresarial: "area-empresarial",
  "demandas-gerais": "area-demandas-gerais",
  previdenciario: "area-previdenciario",
};

const ROLE_RESTRICTIONS: Record<string, string[]> = {
  advogado: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "relatorios-proprio", "comercial", "rh"],
  assessor_juridico: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "relatorios-proprio", "comercial", "rh"],
  estagiario_direito: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "relatorios-proprio", "equipe", "gestao", "comercial", "rh"],
  coordenador: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "rh"],
  agronomo: ["rh"],
  engenheiro_agronomo: ["rh"],
  pos_venda: ["rh"],
  gestor_pos_venda: [],
  advogado_pos_venda: ["rh"],
  estagiario_pos_venda: ["rh", "relatorios", "equipe", "gestao"],
  // Setor de Acordos - acesso ao Jurídico completo + Acordos
  setor_acordos: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "equipe", "gestao", "comercial", "rh", "relatorios"],
  // Comercial roles
  comercial: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "equipe", "gestao", "rh", "relatorios"],
  closer: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "equipe", "gestao", "rh", "relatorios"],
  sdr: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "equipe", "gestao", "rh", "relatorios"],
  social_seller: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "equipe", "gestao", "rh", "relatorios"],
  // Marketing roles
  marketing: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "clientes", "equipe", "gestao", "rh", "relatorios"],
  gerente_marketing: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "clientes", "equipe", "gestao", "rh", "relatorios"],
  criacao: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "clientes", "equipe", "gestao", "rh", "relatorios"],
  copywriter: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "clientes", "equipe", "gestao", "rh", "relatorios"],
  social_media: ["novo-laudo", "climaticos", "laudos", "templates", "abusividade", "processos", "notificacoes", "peticoes", "vencimentos", "clientes", "equipe", "gestao", "rh", "relatorios"],
};

const PATH_TO_PERMISSION: Record<string, string> = {
  "/novo-laudo": "novo-laudo",
  "/climaticos": "climaticos",
  "/laudos": "laudos",
  "/templates": "templates",
  "/abusividade": "abusividade",
  "/equipe": "equipe",
  "/processos": "processos",
  "/notificacoes": "notificacoes",
  "/peticoes": "peticoes",
  "/vencimentos": "vencimentos",
  "/clientes": "clientes",
  // "/codigos-tribunais" não entra aqui: quem vê é quem tem credencial
  // liberada (portão no servidor, `tem_codigos_tribunais`/totp-tribunais).
  // O módulo saiu dos grupos, então checar grupo aqui barrava liberados.
  "/rh": "rh",
  "/carreira/salarios": "rh",
  "/carreira/metas": "rh",
  "/carreira/bonus": "rh",
  "/relatorios": "relatorios",
  "/comercial": "comercial",
  "/acordos": "acordos",
  // Métricas — visibilidade por setor
  "/metricas": "metricas-overview",
  "/metricas/marketing": "metricas-marketing",
  "/metricas/comercial": "metricas-comercial",
  "/metricas/overview-marketing": "metricas-overview-marketing",
  "/metricas/overview-comercial": "metricas-overview-comercial",
  "/metricas/organicos": "metricas-marketing",
  "/metricas/leads-diarios": "metricas-comercial",
  "/metricas/metas": "metricas-overview",
  "/metricas/contratos-fechados": "metricas-comercial",
  "/metricas/integracao-meta": "metricas-marketing",
  // Auditoria de tentativas: apenas quem pode ver overview
  "/metricas/tentativas": "metricas-overview",
};

const MARKETING_ROLES = new Set([
  "marketing",
  "gerente_marketing",
  "criacao",
  "copywriter",
  "social_media",
]);
const COMERCIAL_ROLES = new Set([
  "comercial",
  "closer",
  "sdr",
  "social_seller",
]);

export type RHRole = "admin" | "coordenador" | "self";

export function usePermissions() {
  const { user } = useAuth();
  const real = useOrgMembers();
  const va = useVerComoAlvo();
  // Modo "ver como": a interface calcula as permissões da pessoa vista.
  // Só filtra (mostra menos); o RLS continua sendo o do admin logado.
  const members = real.members;
  const isAdmin = va.alvo ? va.info?.papel === "admin" : real.isAdmin;
  const loading = real.loading || va.loading;
  const currentMemberGroupModulos = va.alvo ? (va.info?.grupoModulos ?? null) : real.currentMemberGroupModulos;

  const currentMember = va.alvo
    ? (va.info ? { papel: va.info.papel, areas: va.info.areas } : undefined)
    : members.find(m => m.user_id === user?.id);
  const papel = currentMember?.papel || "agronomo";

  const restrictions = ROLE_RESTRICTIONS[papel] || [];
  const isMarketing = MARKETING_ROLES.has(papel);
  const isComercial = COMERCIAL_ROLES.has(papel);

  // Se o membro tem um grupo de permissão atribuído, ele substitui as
  // restrições do papel: passa a valer EXCLUSIVAMENTE o que o grupo libera.
  const hasGroup = currentMemberGroupModulos !== null && currentMemberGroupModulos !== undefined;
  const groupPermSet = hasGroup
    ? expandModulesToPermKeys(currentMemberGroupModulos)
    : null;

  const canAccess = (permKey: string): boolean => {
    if (isAdmin) return true;

    // Quando há grupo customizado, ele é a fonte da verdade.
    if (groupPermSet) {
      return groupPermSet.has(permKey);
    }

    // RH (Gestão de Pessoas) é exclusivo de Administradores
    if (permKey === "rh") return false;
    // Acessos da Equipe é exclusivo de Administradores
    if (permKey === "acessos") return false;
    // Métricas — overview do setor liberado para gerentes e coordenação;
    // overview total fica apenas para Admin (controlado em telas internas).
    if (permKey === "metricas-overview") {
      return papel === "gerente_marketing" || papel === "coordenador";
    }
    if (permKey === "metricas-overview-marketing") {
      return papel === "gerente_marketing" || papel === "coordenador" || isMarketing;
    }
    if (permKey === "metricas-overview-comercial") {
      return papel === "coordenador" || isComercial;
    }
    if (permKey === "metricas-marketing") return isMarketing;
    if (permKey === "metricas-comercial") return isComercial;
    if (permKey === "metricas-any") return isMarketing || isComercial;
    return !restrictions.includes(permKey);
  };

  const canAccessPath = (path: string): boolean => {
    if (isAdmin) return true;
    const permKey = PATH_TO_PERMISSION[path];
    if (!permKey) return true;
    return canAccess(permKey);
  };

  // SQUAD da pessoa (membros.areas) é a fonte da verdade das áreas de atuação.
  // Fallback (areas vazio): comportamento antigo — grupo de permissão ou tudo
  // liberado — para nunca trancar ninguém fora.
  const memberAreas = (currentMember?.areas || []) as string[];
  const grupoDefineAreas =
    hasGroup && (currentMemberGroupModulos || []).some((m) => (AREA_MODULE_KEYS as readonly string[]).includes(m));

  const canAccessArea = (area: AreaKey): boolean => {
    if (isAdmin) return true;
    if (memberAreas.length > 0) return memberAreas.includes(area);
    if (!grupoDefineAreas || !groupPermSet) return true;
    return groupPermSet.has(AREA_PERM[area]);
  };

  const allowedAreas = (Object.keys(AREA_PERM) as AreaKey[]).filter(canAccessArea);

  // RH-specific role
  const rhRole: RHRole = isAdmin ? "admin" : papel === "coordenador" ? "coordenador" : "self";

  const canViewAllTasks = isAdmin;
  const canViewOwnReports = isAdmin;
  const canManageTeam = isAdmin;

  return {
    papel,
    isAdmin,
    isMarketing,
    isComercial,
    loading,
    canAccess,
    canAccessPath,
    canAccessArea,
    allowedAreas,
    canViewAllTasks,
    canViewOwnReports,
    canManageTeam,
    rhRole,
  };
}
