import {
  LayoutDashboard, FileText, PlusCircle, LayoutTemplate, Cloud,
  Settings, HelpCircle, Scale, Briefcase,
  CalendarClock,
  ListChecks, Users, Gavel, ClipboardList,
  FileWarning, ScrollText, BarChart3, CheckCircle2, Heart, TrendingUp, FileCheck, Send,
  Handshake, DollarSign, Target, Trophy, Compass,
  LineChart, FilePlus2, PieChart, Flag, Plug,
  ShieldAlert, ShieldCheck, Activity, Sprout, PenLine,
  Calculator, Briefcase as BriefcaseIcon,
  FileSearch, Cpu, NotebookPen, ClipboardCheck,
  Building2, GraduationCap,
  Lock, Wallet, Package, Inbox as InboxIcon,
} from "lucide-react";
import { Workflow, MessageSquare, Inbox, LifeBuoy } from "lucide-react";
import type { NavSection } from "./SidebarNavSection";

/**
 * Estrutura de navegação reorganizada nos 4 setores operacionais + transversais.
 * - Cada seção tem um `id` para persistir estado de colapso e inferir o setor do usuário.
 * - Itens que sumiram do menu como links soltos (Feed, Notificações, Novo Cliente,
 *   /metricas/lancamento) continuam acessíveis via Inbox, GlobalSearch ⌘K ou botões
 *   dentro das próprias páginas — nenhuma rota foi removida.
 */
export const allSections: NavSection[] = [
  {
    id: "master",
    title: "Comando (CEO)",
    area: "transversal",
    ceoOnly: true,
    items: [
      { icon: Trophy, label: "Dashboard MASTER", path: "/master", description: "Visão consolidada — financeiro, produção, equipe e pipeline. Só o CEO vê." },
    ],
  },
  {
    id: "inicio",
    title: "Início",
    area: "transversal",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Inbox, label: "Inbox", path: "/inbox", description: "Tarefas, prazos, notificações e feed em um só lugar" },
      {
        icon: CheckCircle2,
        label: "Produtividade",
        path: "/produtividade",
        children: [
          { icon: CheckCircle2, label: "Tarefas", path: "/tarefas" },
          { icon: ClipboardList, label: "Agenda", path: "/agenda" },
        ],
      },
    ],
  },
  {
    id: "clientes",
    title: "Clientes",
    area: "agro",
    items: [
      { icon: Users, label: "Base", path: "/clientes", permKey: "clientes", description: "Lista de produtores; use o botão Novo Cliente para cadastrar." },
      
      { icon: Workflow, label: "Jornada do Produtor", path: "/workflow" },
      {
        icon: FileText,
        label: "Laudos",
        path: "/laudos",
        permKey: "laudos",
        children: [
          { icon: ScrollText, label: "Meus Laudos", path: "/laudos", permKey: "laudos" },
          { icon: PlusCircle, label: "Novo Laudo", path: "/novo-laudo", permKey: "novo-laudo" },
          { icon: LayoutTemplate, label: "Templates", path: "/templates", permKey: "laudos" },
          { icon: Cloud, label: "Dados Climáticos", path: "/climaticos", permKey: "climaticos" },
        ],
      },
      { icon: MessageSquare, label: "Mensagens", path: "/mensagens" },
      { icon: Sprout, label: "Modo Campo", path: "/campo", description: "Registrar visita de campo ao produtor." },
    ],
  },
  {
    id: "negocios",
    title: "Negócios",
    area: "agro",
    items: [
      {
        icon: TrendingUp,
        label: "Comercial",
        path: "/comercial",
        children: [
          { icon: Briefcase, label: "Painel Comercial", path: "/comercial" },
          { icon: PlusCircle, label: "Novo Cliente", path: "/clientes/fechamento" },
          { icon: NotebookPen, label: "Atendimentos", path: "/comercial/atendimentos" },
          { icon: TrendingUp, label: "Overview", path: "/metricas/overview-comercial", permKey: "metricas-overview-comercial" },
          { icon: FilePlus2, label: "Lançamento", path: "/metricas/comercial", permKey: "metricas-comercial" },
          { icon: ClipboardList, label: "Histórico", path: "/metricas/comercial/historico", permKey: "metricas-comercial" },
          { icon: Trophy, label: "Performance", path: "/metricas/performance", permKey: "metricas-comercial" },
          { icon: FileCheck, label: "Contratos Fechados", path: "/metricas/contratos-fechados", permKey: "metricas-comercial" },
          { icon: Send, label: "Propostas", path: "/metricas/propostas-enviadas", permKey: "metricas-overview" },
          { icon: Flag, label: "Metas Mensais", path: "/metricas/metas", permKey: "metricas-overview" },
          { icon: ShieldAlert, label: "Tentativas (auditoria)", path: "/metricas/tentativas", permKey: "metricas-overview", adminOnly: true },
        ],
      },
      {
        icon: PieChart,
        label: "Marketing",
        path: "/metricas/overview-marketing",
        children: [
          { icon: TrendingUp, label: "Overview", path: "/metricas/overview-marketing", permKey: "metricas-overview-marketing" },
          { icon: FilePlus2, label: "Lançamento", path: "/metricas/marketing", permKey: "metricas-marketing" },
          { icon: PieChart, label: "Leads Orgânicos", path: "/metricas/organicos", permKey: "metricas-marketing" },
          { icon: Plug, label: "Meta Ads", path: "/metricas/integracao-meta", permKey: "metricas-marketing" },
        ],
      },
      {
        icon: Calculator,
        label: "Calculadoras",
        path: "/calculadoras",
        permKey: "gestao",
        children: [
          { icon: Calculator, label: "Calculadoras", path: "/calculadoras", permKey: "gestao" },
          { icon: DollarSign, label: "Honorários", path: "/calculadora-honorarios", permKey: "gestao" },
          { icon: BriefcaseIcon, label: "Consultoria Empresarial", path: "/consultoria-empresarial", permKey: "gestao" },
        ],
      },
    ],
  },
  {
    id: "juridico",
    title: "Jurídico",
    area: "agro",
    items: [
      {
        icon: CalendarClock,
        label: "Vencimentos & Notificações",
        path: "/vencimentos",
        permKey: "vencimentos",
        accent: true,
        description: "Radar de operações vencendo + prazos de 15 dias — ferramenta mais importante do jurídico.",
      },
      {
        icon: Scale,
        label: "Processos & Fases",
        path: "/processos",
        permKey: "processos",
        children: [
          { icon: Scale, label: "Processos", path: "/processos", permKey: "processos" },
          { icon: Workflow, label: "Pipeline de casos", path: "/processos?view=kanban", permKey: "processos" },
          { icon: Activity, label: "Overview Jurídico", path: "/juridico/overview", permKey: "processos" },
        ],
      },
      {
        icon: FileWarning,
        label: "Petições",
        path: "/peticoes",
        permKey: "peticoes",
        children: [
          { icon: FileWarning, label: "Petições", path: "/peticoes", permKey: "peticoes" },
          { icon: ClipboardList, label: "Histórico", path: "/peticoes/historico", permKey: "peticoes" },
        ],
      },
      {
        icon: Gavel,
        label: "Abusividade & Contratos",
        path: "/abusividade",
        permKey: "laudos",
        children: [
          { icon: Gavel, label: "Abusividade", path: "/abusividade", permKey: "laudos" },
          { icon: FileSearch, label: "Análise de Contratos", path: "/analise-contratos" },
        ],
      },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios", permKey: "relatorios" },
      { icon: ShieldCheck, label: "Controladoria", path: "/controladoria", description: "Intimações do DJEN e prazos D-5 (ADVBOX + app)." },
      { icon: Gavel, label: "Processos judiciais", path: "/processos-judiciais", description: "Base de processos importada do ADVBOX." },
    ],
  },
  {
    id: "pos-venda",
    title: "Pós-Venda",
    area: "agro",
    items: [
      { icon: ClipboardCheck, label: "Onboarding", path: "/pos-venda/onboarding" },
      { icon: Users, label: "Carteira de Clientes", path: "/pos-venda/carteira", description: "Segmentação dos clientes por nível de dívida, NPS e responsável." },
      { icon: ClipboardCheck, label: "Triagem de carteira", path: "/pos-venda/triagem", description: "Separa cliente ativo de encerrado antes de distribuir a carteira." },
      { icon: LifeBuoy, label: "Chamados do portal", path: "/pos-venda/chamados", description: "Fila do que os clientes abriram pelo Portal do Cliente: contato do banco, dúvidas, documentos." },
      { icon: Trophy, label: "Painel da Equipe", path: "/pos-venda/painel", description: "Ranking e disputa amigável de KPIs de Pós-Venda." },
      { icon: FileText, label: "Relatório ao Cliente", path: "/pos-venda/relatorio-cliente", description: "Overview gerado por IA com tudo que está sendo feito pelo cliente." },
      { icon: Handshake, label: "Acordos", path: "/acordos", permKey: "acordos" },
    ],
  },
  {
    id: "consultoria-empresarial",
    title: "Consultoria Empresarial",
    area: "empresarial",
    items: [
      { icon: Building2, label: "Empresas", path: "/consultoria/empresas" },
      { icon: Inbox, label: "Demandas", path: "/consultoria/demandas" },
      { icon: ShieldAlert, label: "Demandas externas & Acordos", path: "/consultoria/demandas-externas", description: "Cobranças, ações e dívidas externas contra a empresa, e os acordos relacionados." },
      { icon: FileText, label: "Propostas", path: "/consultoria/propostas" },
      { icon: Calculator, label: "Simulador de Planos", path: "/consultoria-empresarial" },
      { icon: Briefcase, label: "Carteira de Empresas", path: "/consultoria/carteira", description: "Pós-Venda — receita recorrente (MRR), NPS, risco e responsável por empresa." },
      { icon: ClipboardCheck, label: "Onboarding", path: "/consultoria/onboarding", description: "Checklist de início quando uma empresa fecha contrato de consultoria." },
    ],
  },
  {
    id: "demandas-gerais",
    title: "Demandas complexas",
    area: "demandas-gerais",
    items: [
      { icon: LayoutDashboard, label: "Painel", path: "/", description: "Painel da área — contagens por status/matéria e prazos críticos." },
      { icon: Gavel, label: "Causas", path: "/causas", description: "Causas avulsas de outras matérias (trabalhista, cível, família, previdenciário, consumidor, outros)." },
    ],
  },
  {
    id: "previdenciario",
    title: "Previdenciário",
    area: "previdenciario",
    items: [
      { icon: LayoutDashboard, label: "Painel", path: "/", description: "Painel da área — contagens por status/matéria e prazos críticos." },
      { icon: Gavel, label: "Causas previdenciárias", path: "/causas?materia=previdenciario", description: "Causas de matéria previdenciária." },
    ],
  },
  {
    id: "ferramentas",
    title: "Ferramentas",
    area: "transversal",
    items: [
      { icon: PenLine, label: "Assinaturas", path: "/assinaturas", description: "Documentos para assinatura no ZapSign — todos os setores." },
      {
        icon: ShieldCheck,
        label: "Códigos dos Tribunais",
        path: "/codigos-tribunais",
        gate: "codigos-tribunais",
        description: "Código de verificação em duas etapas — visível apenas a quem for liberado.",
      },
      {
        icon: ListChecks,
        label: "Limpeza da fila de vencidas",
        path: "/fila-vencidas",
        description: "Operações vencidas separadas por situação: cobertas, em atraso, conferir pasta e sem prova.",
      },
      {
        icon: Users,
        label: "Operações sem titular",
        path: "/operacoes-sem-titular",
        gate: "operacoes-sem-titular",
        description: "Ligar cada operação à pessoa do grupo. Some do menu quando não sobrar nenhuma.",
      },
      {
        icon: CalendarClock,
        label: "Feriados e recesso",
        path: "/feriados",
        description: "Calendário usado para calcular prazos e datas das tarefas do ADVBOX.",
      },
    ],
  },
  {
    id: "pessoas",
    title: "Pessoas & Recursos",
    area: "transversal",
    items: [
      { icon: Heart, label: "Gestão de Pessoas", path: "/rh", permKey: "rh", description: "RH — contratos, feedback e ciclo de pessoas." },
      {
        icon: Trophy,
        label: "Carreira",
        path: "/carreira",
        permKey: "rh",
        children: [
          { icon: DollarSign, label: "Tabela Salarial", path: "/carreira/salarios", permKey: "rh" },
          { icon: Target, label: "Metas Semestrais", path: "/carreira/metas", permKey: "rh" },
          { icon: Trophy, label: "Apuração de Bônus", path: "/carreira/bonus", permKey: "rh" },
        ],
      },
      { icon: Users, label: "Equipe", path: "/equipe", permKey: "equipe", description: "Operacional — alocação e carga de trabalho." },
      {
        icon: GraduationCap,
        label: "Treinamentos",
        path: "/treinamentos",
        gate: "treinamentos",
        description: "Trilhas de treinamento por setor, progresso e certificados.",
        children: [
          { icon: GraduationCap, label: "Acompanhamento", path: "/treinamentos/painel" },
          { icon: ClipboardList, label: "Provas", path: "/treinamentos/provas" },
        ],
      },
    ],
  },
  {
    id: "admin",
    title: "Administração",
    area: "transversal",
    items: [
      { icon: Briefcase, label: "Painel Gestor", path: "/", permKey: "gestao", description: "Bloco Visão Gestor no Dashboard." },
      {
        icon: Package,
        label: "Produtização",
        path: "/admin/ofertas",
        children: [
          { icon: Package, label: "Catálogo de Ofertas", path: "/admin/ofertas" },
          { icon: InboxIcon, label: "Pedidos", path: "/admin/pedidos" },
        ],
      },
      {
        icon: LineChart,
        label: "BI & Métricas",
        path: "/metricas",
        permKey: "metricas-any",
        children: [
          { icon: TrendingUp, label: "Overview Geral", path: "/metricas", permKey: "metricas-overview" },
          { icon: Cpu, label: "Consumo de IA", path: "/metricas/consumo-ia", permKey: "metricas-overview" },
        ],
      },
      { icon: Cpu, label: "Base Olivia", path: "/olivia/conhecimento" },
      { icon: ShieldAlert, label: "Acessos", path: "/configuracoes?tab=acessos", permKey: "acessos" },
      { icon: ShieldAlert, label: "Saúde do sistema", path: "/saude-sistema", permKey: "acessos" },

      { icon: Settings, label: "Configurações", path: "/configuracoes" },
      { icon: Compass, label: "Guia de Uso", path: "/guia" },
      { icon: HelpCircle, label: "Ajuda", path: "/ajuda" },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro (CEO)",
    area: "transversal",
    ceoOnly: true,
    items: [
      { icon: Lock, label: "Financeiro", path: "/financeiro", description: "Visão geral consolidada — restrito ao CEO." },
      { icon: Wallet, label: "Lançamentos", path: "/financeiro/lancamentos", description: "Receitas e despesas manuais — restrito ao CEO." },
    ],
  },
];
