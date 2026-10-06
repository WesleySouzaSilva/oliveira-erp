/**
 * Catálogo de módulos do menu. Cada módulo agrupa uma ou mais
 * "permission keys" usadas internamente em `usePermissions.canAccess`.
 *
 * Quando um colaborador tem um grupo de permissão atribuído, os módulos
 * marcados no grupo definem todos os acessos dele, sobrescrevendo as
 * restrições padrão do papel (cargo).
 */
export interface ModuleDef {
  key: string;
  label: string;
  description?: string;
  /** Chaves usadas em canAccess() — devem bater com PATH_TO_PERMISSION. */
  perms: string[];
  /** Marca módulos sensíveis (ex.: RH, Acessos) só pra UI alertar. */
  sensivel?: boolean;
}

export const MODULE_CATALOG: ModuleDef[] = [
  {
    key: "area_agro",
    label: "Área — Agro",
    description: "Acesso ao contexto Agro (produtores rurais, laudos e processos agro).",
    perms: ["area-agro"],
  },
  {
    key: "area_empresarial",
    label: "Área — Empresarial",
    description: "Acesso ao contexto Empresarial (consultoria, empresas e avenças).",
    perms: ["area-empresarial"],
  },
  {
    key: "area_demandas",
    label: "Área — Demandas complexas",
    description: "Acesso ao contexto de causas avulsas de outras matérias.",
    perms: ["area-demandas-gerais"],
  },
  {
    key: "area_previdenciario",
    label: "Área — Previdenciário",
    description: "Acesso ao contexto previdenciário.",
    perms: ["area-previdenciario"],
  },
  {
    key: "juridico",
    label: "Jurídico",
    description: "Laudos, processos, petições, abusividade, templates, notificações e dados climáticos.",
    perms: [
      "novo-laudo",
      "climaticos",
      "laudos",
      "templates",
      "abusividade",
      "processos",
      "notificacoes",
      "peticoes",
    ],
  },
  {
    key: "codigos_tribunais",
    label: "Códigos dos Tribunais",
    description: "Acesso aos códigos de verificação em duas etapas dos tribunais.",
    perms: ["codigos-tribunais"],
    sensivel: true,
  },
  {
    key: "vencimentos",
    label: "Vencimentos",
    description: "Controle de vencimentos de contratos.",
    perms: ["vencimentos"],
  },
  {
    key: "comercial",
    label: "Setor Comercial (CRM)",
    description: "Funil, leads, atendimentos e propostas.",
    perms: ["comercial"],
  },
  {
    key: "marketing",
    label: "Marketing — Métricas",
    description: "Lançamento e overview do setor de marketing.",
    perms: ["metricas-marketing", "metricas-overview-marketing"],
  },
  {
    key: "metricas_comercial",
    label: "Comercial — Métricas",
    description: "Lançamento e overview do setor comercial (overview-comercial, leads diários, contratos fechados).",
    perms: ["metricas-comercial", "metricas-overview-comercial"],
  },
  {
    key: "metricas_geral",
    label: "Métricas Geral (Overview)",
    description: "Overview consolidado das métricas e metas semestrais.",
    perms: ["metricas-overview"],
  },
  {
    key: "clientes",
    label: "Clientes",
    description: "Gestão de clientes (CRM completo).",
    perms: ["clientes"],
  },
  {
    key: "relatorios",
    label: "Relatórios",
    description: "Relatórios da equipe e próprios.",
    perms: ["relatorios", "relatorios-proprio"],
  },
  {
    key: "equipe",
    label: "Equipe",
    description: "Visão da equipe e cargas de trabalho.",
    perms: ["equipe"],
  },
  {
    key: "gestao",
    label: "Gestão Geral",
    description: "Painel de gestão executiva.",
    perms: ["gestao"],
  },
  {
    key: "acordos",
    label: "Setor de Acordos",
    description: "Kanban e auditoria de acordos.",
    perms: ["acordos"],
  },
  {
    key: "rh",
    label: "Gestão de Pessoas (RH)",
    description: "Colaboradores, salários, metas, PDIs, feedbacks.",
    perms: ["rh"],
    sensivel: true,
  },
  {
    key: "acessos",
    label: "Acessos da Equipe",
    description: "Gerenciar convites e papéis da equipe.",
    perms: ["acessos"],
    sensivel: true,
  },
];

/** Converte a lista de módulos do grupo em um Set de chaves de permissão. */
export const AREA_MODULE_KEYS = [
  "area_agro",
  "area_empresarial",
  "area_demandas",
  "area_previdenciario",
] as const;

/**
 * Catálogo exibido na UI de grupos de permissão. As áreas (squads) deixaram de
 * ser atributo do grupo e passaram a ser atributo da PESSOA (`membros.areas`),
 * editável em Gestão de Pessoas. As chaves `area_*` continuam no catálogo e no
 * `expandModulesToPermKeys` para não quebrar grupos já gravados.
 */
const HIDDEN_MODULE_KEYS: readonly string[] = [
  ...AREA_MODULE_KEYS,
  // Códigos dos Tribunais: quem vê é quem tem credencial liberada (portão na
  // edge function), não um módulo de grupo. Chave mantida no catálogo para
  // não quebrar grupos já gravados.
  "codigos_tribunais",
];

export const SELECTABLE_MODULE_CATALOG: ModuleDef[] = MODULE_CATALOG.filter(
  (m) => !HIDDEN_MODULE_KEYS.includes(m.key),
);

export function expandModulesToPermKeys(modulos: string[] | null | undefined): Set<string> {
  const set = new Set<string>();
  if (!modulos || modulos.length === 0) return set;
  for (const m of MODULE_CATALOG) {
    if (modulos.includes(m.key)) {
      m.perms.forEach((p) => set.add(p));
    }
  }
  // Chaves derivadas
  if (set.has("metricas-marketing") || set.has("metricas-comercial")) {
    set.add("metricas-any");
  }
  return set;
}

/**
 * Perfis prontos: pontos de partida para montar um grupo de permissão
 * com um clique. Depois de aplicado, o admin pode ajustar módulo a módulo.
 */
export interface PerfilPronto {
  nome: string;
  descricao: string;
  modulos: string[];
}

export const PERFIS_PRONTOS: PerfilPronto[] = [
  {
    nome: "Jurídico Pleno",
    descricao: "Advogado(a): laudos, processos, petições, vencimentos, clientes e relatórios.",
    modulos: ["juridico", "vencimentos", "clientes", "relatorios", "equipe"],
  },
  {
    nome: "Assessor(a) Jurídico",
    descricao: "Apoio jurídico: processos, petições, vencimentos e clientes. Sem relatórios da equipe.",
    modulos: ["juridico", "vencimentos", "clientes"],
  },
  {
    nome: "Estagiário(a) Jurídico",
    descricao: "Acesso mínimo de apoio: processos/petições e controle de prazos.",
    modulos: ["juridico", "vencimentos"],
  },
  {
    nome: "Comercial",
    descricao: "CRM, clientes e métricas do próprio setor comercial.",
    modulos: ["comercial", "clientes", "metricas_comercial"],
  },
  {
    nome: "Marketing",
    descricao: "Lançamentos e overview de marketing. Sem acesso a clientes e jurídico.",
    modulos: ["marketing"],
  },
  {
    nome: "Pós-Venda",
    descricao: "Clientes, acordos, vencimentos e relatórios de andamento.",
    modulos: ["clientes", "acordos", "vencimentos", "relatorios"],
  },
  {
    nome: "Coordenação",
    descricao: "Visão ampla de operação e métricas, sem RH nem gestão de acessos.",
    modulos: [
      "juridico",
      "vencimentos",
      "clientes",
      "comercial",
      "acordos",
      "relatorios",
      "equipe",
      "gestao",
      "metricas_geral",
      "metricas_comercial",
      "marketing",
    ],
  },
  {
    nome: "Somente consulta",
    descricao: "Acesso básico de consulta a clientes e prazos.",
    modulos: ["clientes", "vencimentos"],
  },
];