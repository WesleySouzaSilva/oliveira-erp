import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { lazyRetry, registrarRotas } from "@/lib/lazyRetry";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { AreaProvider } from "@/contexts/AreaContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CeoRoute } from "@/components/CeoRoute";
import { PortalRoute } from "@/components/portal/PortalRoute";
// Páginas de entrada também sob demanda: tiram as animações do pacote inicial
const Auth = lazyRetry(() => import("./pages/Auth"));
const PortalLogin = lazyRetry(() => import("./pages/PortalLogin"));
const PortalDefinirSenha = lazyRetry(() => import("./pages/portal/PortalDefinirSenha"));
const EsqueciSenha = lazyRetry(() => import("./pages/EsqueciSenha"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const PrimeiroAcesso = lazyRetry(() => import("./pages/PrimeiroAcesso"));
const AcessoNegado = lazyRetry(() => import("./pages/AcessoNegado"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

// Demais rotas em lazy chunks — reduz drasticamente o bundle inicial
const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
const Home = lazyRetry(() => import("./pages/Home"));
const MeusLaudos = lazyRetry(() => import("./pages/MeusLaudos"));
const LaudoVisualizar = lazyRetry(() => import("./pages/LaudoVisualizar"));
const NovoLaudo = lazyRetry(() => import("./pages/NovoLaudo"));
const ProcessoDetalhe = lazyRetry(() => import("./pages/ProcessoDetalhe"));
const Templates = lazyRetry(() => import("./pages/Templates"));
const DadosClimaticos = lazyRetry(() => import("./pages/DadosClimaticos"));
const Processos = lazyRetry(() => import("./pages/Processos"));
const ProcessosSemCliente = lazyRetry(() => import("./pages/ProcessosSemCliente"));
const Configuracoes = lazyRetry(() => import("./pages/Configuracoes"));
const Ajuda = lazyRetry(() => import("./pages/Ajuda"));
const GuiaUso = lazyRetry(() => import("./pages/GuiaUso"));
const Vencimentos = lazyRetry(() => import("./pages/Vencimentos"));
const Radar = lazyRetry(() => import("./pages/Radar"));
const Relatorios = lazyRetry(() => import("./pages/Relatorios"));
const Equipe = lazyRetry(() => import("./pages/Equipe"));
const CodigosTribunais = lazyRetry(() => import("./pages/CodigosTribunais"));
const Feriados = lazyRetry(() => import("./pages/Feriados"));
const Controladoria = lazyRetry(() => import("./pages/controladoria/Controladoria"));
const ProcessosJudiciais = lazyRetry(() => import("./pages/ProcessosJudiciais"));
const Treinamentos = lazyRetry(() => import("./pages/treinamentos/Treinamentos"));
const TreinTrilhaPlayer = lazyRetry(() => import("./pages/treinamentos/TrilhaPlayer"));
const TreinTrilhaEditor = lazyRetry(() => import("./pages/treinamentos/TrilhaEditor"));
const TreinProvas = lazyRetry(() => import("./pages/treinamentos/Provas"));
const TreinProvaAplicacoes = lazyRetry(() => import("./pages/treinamentos/ProvaAplicacoes"));
const TreinResponderProva = lazyRetry(() => import("./pages/treinamentos/ResponderProva"));
const ProvaPublica = lazyRetry(() => import("./pages/ProvaPublica"));
const Assinaturas = lazyRetry(() => import("./pages/assinaturas/Assinaturas"));
const LaudoAbusividade = lazyRetry(() => import("./pages/LaudoAbusividade"));
const PainelCaso = lazyRetry(() => import("./pages/PainelCaso"));
const Notificacoes = lazyRetry(() => import("./pages/Notificacoes"));
const FilaVencidas = lazyRetry(() => import("./pages/FilaVencidas"));
const VincularOperacoes = lazyRetry(() => import("./pages/VincularOperacoes"));
const VarreduraImport = lazyRetry(() => import("./pages/VarreduraImport"));
const ComplementacoesPendentes = lazyRetry(() => import("./pages/ComplementacoesPendentes"));
const TriagemProtocolos = lazyRetry(() => import("./pages/TriagemProtocolos"));
const Agenda = lazyRetry(() => import("./pages/Agenda"));
const TarefasPage = lazyRetry(() => import("./pages/Tarefas"));
const Peticoes = lazyRetry(() => import("./pages/Peticoes"));
const HistoricoPeticoes = lazyRetry(() => import("./pages/HistoricoPeticoes"));
const JuridicoOverview = lazyRetry(() => import("./pages/JuridicoOverview"));
const NovoCliente = lazyRetry(() => import("./pages/NovoCliente"));
const NovoClienteFechamento = lazyRetry(() => import("./pages/NovoClienteFechamento"));
const Clientes = lazyRetry(() => import("./pages/Clientes"));
const ClienteDetalhe = lazyRetry(() => import("./pages/ClienteDetalhe"));
const Feed = lazyRetry(() => import("./pages/Feed"));
const GestaoRH = lazyRetry(() => import("./pages/GestaoRH"));
const GestaoComercial = lazyRetry(() => import("./pages/GestaoComercial"));
const Acordos = lazyRetry(() => import("./pages/Acordos"));
const TabelaSalarial = lazyRetry(() => import("./pages/TabelaSalarial"));
const MetasSemestrais = lazyRetry(() => import("./pages/MetasSemestrais"));
const ApuracaoBonus = lazyRetry(() => import("./pages/ApuracaoBonus"));
// Layout (menu, cabeçalho) sob demanda: sai do pacote inicial.
const AppLayout = lazy(() => import("./components/AppLayout").then((m) => ({ default: m.AppLayout })));

const MetricasIndex = lazyRetry(() => import("./pages/metricas/MetricasIndex"));
const OverviewMarketing = lazyRetry(() => import("./pages/metricas/OverviewMarketing"));
const OverviewComercial = lazyRetry(() => import("./pages/metricas/OverviewComercial"));
const MetricasLancamentoMarketing = lazyRetry(() => import("./pages/metricas/LancamentoMarketing"));
const MetricasLancamentoComercial = lazyRetry(() => import("./pages/metricas/LancamentoComercial"));
const HistoricoLancamentosComercial = lazyRetry(() => import("./pages/metricas/HistoricoLancamentosComercial"));
const PerformanceIndividual = lazyRetry(() => import("./pages/metricas/PerformanceIndividual"));
const MetricasOrganicos = lazyRetry(() => import("./pages/metricas/Organicos"));
const MetricasMetas = lazyRetry(() => import("./pages/metricas/Metas"));
const MetaAdsIntegracao = lazyRetry(() => import("./pages/metricas/MetaAdsIntegracao"));
const ContratosFechados = lazyRetry(() => import("./pages/metricas/ContratosFechados"));

const TentativasFuturas = lazyRetry(() => import("./pages/metricas/TentativasFuturas"));
const PropostasEnviadas = lazyRetry(() => import("./pages/metricas/PropostasEnviadas"));
const ConsumoIA = lazyRetry(() => import("./pages/metricas/ConsumoIA"));
const OliviaConhecimento = lazyRetry(() => import("./pages/OliviaConhecimento"));
const CalculadoraHonorarios = lazyRetry(() => import("./pages/CalculadoraHonorarios"));
const Calculadoras = lazyRetry(() => import("./pages/Calculadoras"));
const ConsultoriaEmpresarial = lazyRetry(() => import("./pages/ConsultoriaEmpresarial"));
const EmpresasConsultoria = lazyRetry(() => import("./pages/consultoria/EmpresasConsultoria"));
const EmpresaConsultoriaDetalhe = lazyRetry(() => import("./pages/consultoria/EmpresaConsultoriaDetalhe"));
const DemandasInbox = lazyRetry(() => import("./pages/consultoria/DemandasInbox"));
const CausasList = lazyRetry(() => import("./pages/demandasGerais/CausasList"));
const CausaDetalhe = lazyRetry(() => import("./pages/demandasGerais/CausaDetalhe"));
const PainelDemandasGeraisPage = lazyRetry(() => import("./pages/demandasGerais/PainelDemandasGerais"));
const DemandaDetalhe = lazyRetry(() => import("./pages/consultoria/DemandaDetalhe"));
const DemandasExternas = lazyRetry(() => import("./pages/consultoria/DemandasExternas"));
const DemandaExternaDetalhe = lazyRetry(() => import("./pages/consultoria/DemandaExternaDetalhe"));
const PropostasConsultoria = lazyRetry(() => import("./pages/consultoria/PropostasConsultoria"));
const CarteiraAvencas = lazyRetry(() => import("./pages/consultoria/CarteiraAvencas"));
const OnboardingConsultoria = lazyRetry(() => import("./pages/consultoria/OnboardingConsultoria"));
const OnboardingConsultoriaDetalhe = lazyRetry(() => import("./pages/consultoria/OnboardingConsultoriaDetalhe"));
const Financeiro = lazyRetry(() => import("./pages/financeiro/Financeiro"));
const FinanceiroLancamentos = lazyRetry(() => import("./pages/financeiro/FinanceiroLancamentos"));
const DashboardMaster = lazyRetry(() => import("./pages/master/DashboardMaster"));
const AnaliseContratos = lazyRetry(() => import("./pages/AnaliseContratos"));
const AtendimentosComercial = lazyRetry(() => import("./pages/comercial/Atendimentos"));
const PosVendaOnboardings = lazyRetry(() => import("./pages/posVenda/Onboardings"));
const PosVendaOnboardingDetalhe = lazyRetry(() => import("./pages/posVenda/OnboardingDetalhe"));
const RelatorioClientePosVenda = lazyRetry(() => import("./pages/posVenda/RelatorioCliente"));
const CarteiraClientesPosVenda = lazyRetry(() => import("./pages/posVenda/CarteiraClientes"));
const TriagemCarteira = lazyRetry(() => import("./pages/posVenda/TriagemCarteira"));
const DivisaoCarteira = lazyRetry(() => import("./pages/posVenda/DivisaoCarteira"));
const SaudeSistema = lazyRetry(() => import("./pages/SaudeSistema"));
const PainelPosVenda = lazyRetry(() => import("./pages/posVenda/PainelPosVenda"));
const WorkflowPage = lazyRetry(() => import("./pages/Workflow"));
const Mensagens = lazyRetry(() => import("./pages/Mensagens"));
const Inbox = lazyRetry(() => import("./pages/Inbox"));

const Campo = lazyRetry(() => import("./pages/Campo"));
const PortalDemandas = lazyRetry(() => import("./pages/portal/PortalDemandas"));
const PortalDemandaDetalhe = lazyRetry(() => import("./pages/portal/PortalDemandaDetalhe"));
const PortalIndex = lazyRetry(() => import("./pages/portal/PortalIndex"));
const PortalClienteProcessos = lazyRetry(() => import("./pages/portal/PortalClienteProcessos"));
const PortalClienteAtendimentos = lazyRetry(() => import("./pages/portal/PortalClienteAtendimentos"));
const PortalClienteAcordos = lazyRetry(() => import("./pages/portal/PortalClienteAcordos"));
const PortalClienteProcessoDetalhe = lazyRetry(() => import("./pages/portal/PortalClienteProcessoDetalhe"));
const OfertasCatalogo = lazyRetry(() => import("./pages/produtizacao/OfertasCatalogo"));
const PedidosServico = lazyRetry(() => import("./pages/produtizacao/PedidosServico"));
const PortalMeuPlano = lazyRetry(() => import("./pages/portal/PortalMeuPlano"));
const PortalServicos = lazyRetry(() => import("./pages/portal/PortalServicos"));
const PortalMeusPedidos = lazyRetry(() => import("./pages/portal/PortalMeusPedidos"));
const PortalRelatorios = lazyRetry(() => import("./pages/portal/PortalRelatorios"));
const PortalHome = lazyRetry(() => import("./pages/portal/PortalHome"));
const PortalClienteContratos = lazyRetry(() => import("./pages/portal/PortalClienteContratos"));
const PortalClienteChamados = lazyRetry(() => import("./pages/portal/PortalClienteChamados"));
const PortalClienteChamadoDetalhe = lazyRetry(() => import("./pages/portal/PortalClienteChamadoDetalhe"));
const ChamadosPortal = lazyRetry(() => import("./pages/posVenda/ChamadosPortal"));
const ChamadoPortalDetalhe = lazyRetry(() => import("./pages/posVenda/ChamadoPortalDetalhe"));

// Mapa rota → tela, usado para baixar o código antes do clique (etapa 1B).
registrarRotas({
  "/": Home,
  "/vencimentos": Vencimentos,
  "/radar": Radar,
  "/relatorios": Relatorios,
  "/abusividade": LaudoAbusividade,
  "/laudos": MeusLaudos,
  "/novo-laudo": NovoLaudo,
  "/processos": Processos,
  "/processos/sem-cliente": ProcessosSemCliente,
  "/templates": Templates,
  "/climaticos": DadosClimaticos,
  "/configuracoes": Configuracoes,
  "/equipe": Equipe,
  "/codigos-tribunais": CodigosTribunais,
  "/feriados": Feriados,
  "/controladoria": Controladoria,
  "/treinamentos": Treinamentos,
  "/treinamentos/painel": Treinamentos,
  "/treinamentos/provas": TreinProvas,
  "/assinaturas": Assinaturas,
  "/agenda": Agenda,
  "/tarefas": TarefasPage,
  "/causas": CausasList,
  "/demandas-gerais": PainelDemandasGeraisPage,
  "/ajuda": Ajuda,
  "/guia": GuiaUso,
  "/notificacoes": Notificacoes,
  "/fila-vencidas": FilaVencidas,
  "/operacoes-sem-titular": VincularOperacoes,
  "/notificacoes/varredura": VarreduraImport,
  "/notificacoes/complementacoes": ComplementacoesPendentes,
  "/notificacoes/protocolos": TriagemProtocolos,
  "/peticoes": Peticoes,
  "/peticoes/historico": HistoricoPeticoes,
  "/juridico/overview": JuridicoOverview,
  "/novo-cliente": NovoCliente,
  "/clientes/fechamento": NovoClienteFechamento,
  "/clientes": Clientes,
  "/feed": Feed,
  "/rh": GestaoRH,
  "/comercial": GestaoComercial,
  "/acordos": Acordos,
  "/carreira/salarios": TabelaSalarial,
  "/carreira/metas": MetasSemestrais,
  "/carreira/bonus": ApuracaoBonus,
  "/metricas/overview-marketing": OverviewMarketing,
  "/metricas/overview-comercial": OverviewComercial,
  "/metricas/marketing": MetricasLancamentoMarketing,
  "/metricas/comercial": MetricasLancamentoComercial,
  "/metricas/comercial/historico": HistoricoLancamentosComercial,
  "/metricas/performance": PerformanceIndividual,
  "/metricas/organicos": MetricasOrganicos,
  "/metricas/metas": MetricasMetas,
  "/metricas/integracao-meta": MetaAdsIntegracao,
  "/metricas/contratos-fechados": ContratosFechados,
  "/metricas/tentativas": TentativasFuturas,
  "/metricas/propostas-enviadas": PropostasEnviadas,
  "/metricas/consumo-ia": ConsumoIA,
  "/calculadora-honorarios": CalculadoraHonorarios,
  "/calculadoras": Calculadoras,
  "/consultoria-empresarial": ConsultoriaEmpresarial,
  "/consultoria/empresas": EmpresasConsultoria,
  "/consultoria/demandas": DemandasInbox,
  "/consultoria/demandas-externas": DemandasExternas,
  "/consultoria/propostas": PropostasConsultoria,
  "/consultoria/carteira": CarteiraAvencas,
  "/consultoria/onboarding": OnboardingConsultoria,
  "/comercial/atendimentos": AtendimentosComercial,
  "/pos-venda/onboarding": PosVendaOnboardings,
  "/pos-venda/carteira": CarteiraClientesPosVenda,
  "/pos-venda/triagem": TriagemCarteira,
  "/pos-venda/divisao": DivisaoCarteira,
  "/saude-sistema": SaudeSistema,
  "/pos-venda/painel": PainelPosVenda,
  "/pos-venda/chamados": ChamadosPortal,
  "/workflow": WorkflowPage,
  "/mensagens": Mensagens,
  "/inbox": Inbox,
  "/campo": Campo,
  "/admin/ofertas": OfertasCatalogo,
  "/admin/pedidos": PedidosServico,
});

// Cache global: reduz refetch desnecessário e melhora sensação de velocidade
import { queryClient } from "@/lib/queryClient";

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AreaProvider>
      <TooltipProvider>
        <ConfirmDialogProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/definir-senha" element={<PortalDefinirSenha />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/primeiro-acesso" element={<PrimeiroAcesso />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            {/* /gestao consolidado no Dashboard (bloco "Visão Gestor") — preserva bookmarks */}
            <Route path="/gestao" element={<Navigate to="/" replace />} />
            <Route path="/vencimentos" element={<ProtectedRoute><Vencimentos /></ProtectedRoute>} />
            <Route path="/radar" element={<ProtectedRoute><Radar /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/abusividade" element={<ProtectedRoute><LaudoAbusividade /></ProtectedRoute>} />
            <Route path="/laudos" element={<ProtectedRoute><MeusLaudos /></ProtectedRoute>} />
            <Route path="/laudos/:id" element={<ProtectedRoute><LaudoVisualizar /></ProtectedRoute>} />
            <Route path="/novo-laudo" element={<ProtectedRoute><NovoLaudo /></ProtectedRoute>} />
            <Route path="/processos" element={<ProtectedRoute><Processos /></ProtectedRoute>} />
            <Route path="/processos/sem-cliente" element={<ProtectedRoute><ProcessosSemCliente /></ProtectedRoute>} />
            <Route path="/processos/:id" element={<ProtectedRoute><ProcessoDetalhe /></ProtectedRoute>} />
            {/* /pipeline consolidado em /processos?view=kanban — preserva bookmarks */}
            <Route path="/pipeline" element={<Navigate to="/processos?view=kanban" replace />} />
            <Route path="/caso/:id" element={<ProtectedRoute><PainelCaso /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="/climaticos" element={<ProtectedRoute><DadosClimaticos /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/equipe" element={<ProtectedRoute><Equipe /></ProtectedRoute>} />
            <Route path="/codigos-tribunais" element={<ProtectedRoute><CodigosTribunais /></ProtectedRoute>} />
            <Route path="/feriados" element={<ProtectedRoute><Feriados /></ProtectedRoute>} />
            <Route path="/controladoria" element={<ProtectedRoute><Controladoria /></ProtectedRoute>} />
            <Route path="/processos-judiciais" element={<ProtectedRoute><ProcessosJudiciais /></ProtectedRoute>} />
            <Route path="/treinamentos" element={<ProtectedRoute><Treinamentos /></ProtectedRoute>} />
            <Route path="/treinamentos/trilha/:id" element={<ProtectedRoute><TreinTrilhaPlayer /></ProtectedRoute>} />
            <Route path="/treinamentos/editar/:id" element={<ProtectedRoute><TreinTrilhaEditor /></ProtectedRoute>} />
            <Route path="/treinamentos/painel" element={<ProtectedRoute><Treinamentos /></ProtectedRoute>} />
            <Route path="/treinamentos/provas" element={<ProtectedRoute><TreinProvas /></ProtectedRoute>} />
            <Route path="/treinamentos/provas/:id/aplicacoes" element={<ProtectedRoute><TreinProvaAplicacoes /></ProtectedRoute>} />
            <Route path="/treinamentos/prova/:aplicacaoId" element={<ProtectedRoute><TreinResponderProva /></ProtectedRoute>} />
            <Route path="/prova/:token" element={<ProvaPublica />} />
            <Route path="/assinaturas" element={<ProtectedRoute><Assinaturas /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
            <Route path="/tarefas" element={<ProtectedRoute><TarefasPage /></ProtectedRoute>} />
            <Route path="/causas" element={<ProtectedRoute><CausasList /></ProtectedRoute>} />
            <Route path="/causas/:id" element={<ProtectedRoute><CausaDetalhe /></ProtectedRoute>} />
            <Route path="/demandas-gerais" element={<ProtectedRoute><PainelDemandasGeraisPage /></ProtectedRoute>} />
            <Route path="/ajuda" element={<ProtectedRoute><Ajuda /></ProtectedRoute>} />
            <Route path="/guia" element={<ProtectedRoute><GuiaUso /></ProtectedRoute>} />
            <Route path="/previa-laudos" element={<Navigate to="/laudos" replace />} />
            <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
            <Route path="/fila-vencidas" element={<ProtectedRoute><FilaVencidas /></ProtectedRoute>} />
            <Route path="/operacoes-sem-titular" element={<ProtectedRoute><VincularOperacoes /></ProtectedRoute>} />
            <Route path="/notificacoes/varredura" element={<ProtectedRoute><VarreduraImport /></ProtectedRoute>} />
            <Route path="/notificacoes/complementacoes" element={<ProtectedRoute><ComplementacoesPendentes /></ProtectedRoute>} />
            <Route path="/notificacoes/protocolos" element={<ProtectedRoute><TriagemProtocolos /></ProtectedRoute>} />
            <Route path="/peticoes" element={<ProtectedRoute><Peticoes /></ProtectedRoute>} />
            <Route path="/peticoes/historico" element={<ProtectedRoute><HistoricoPeticoes /></ProtectedRoute>} />
            <Route path="/juridico/overview" element={<ProtectedRoute><JuridicoOverview /></ProtectedRoute>} />
            <Route path="/novo-cliente" element={<ProtectedRoute><NovoCliente /></ProtectedRoute>} />
            <Route path="/clientes/fechamento" element={<ProtectedRoute><NovoClienteFechamento /></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/clientes/:nome" element={<ProtectedRoute><ClienteDetalhe /></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/rh" element={<ProtectedRoute><GestaoRH /></ProtectedRoute>} />
            <Route path="/comercial" element={<ProtectedRoute><GestaoComercial /></ProtectedRoute>} />
            <Route path="/acordos" element={<ProtectedRoute><Acordos /></ProtectedRoute>} />
            <Route path="/carreira/salarios" element={<ProtectedRoute><TabelaSalarial /></ProtectedRoute>} />
            <Route path="/carreira/metas" element={<ProtectedRoute><MetasSemestrais /></ProtectedRoute>} />
            <Route path="/carreira/bonus" element={<ProtectedRoute><ApuracaoBonus /></ProtectedRoute>} />
            {/* /acessos consolidado em /configuracoes?tab=acessos — preserva bookmarks */}
            <Route path="/acessos" element={<Navigate to="/configuracoes?tab=acessos" replace />} />
            <Route path="/acesso-negado" element={<AcessoNegado />} />
            <Route path="/metricas" element={<ProtectedRoute><AppLayout><MetricasIndex /></AppLayout></ProtectedRoute>} />
            <Route path="/metricas/overview-marketing" element={<ProtectedRoute><OverviewMarketing /></ProtectedRoute>} />
            <Route path="/metricas/overview-comercial" element={<ProtectedRoute><OverviewComercial /></ProtectedRoute>} />
            <Route path="/metricas/marketing" element={<ProtectedRoute><MetricasLancamentoMarketing /></ProtectedRoute>} />
            <Route path="/metricas/comercial" element={<ProtectedRoute><MetricasLancamentoComercial /></ProtectedRoute>} />
            <Route path="/metricas/comercial/historico" element={<ProtectedRoute><HistoricoLancamentosComercial /></ProtectedRoute>} />
            <Route path="/metricas/performance" element={<ProtectedRoute><PerformanceIndividual /></ProtectedRoute>} />
            <Route path="/metricas/organicos" element={<ProtectedRoute><MetricasOrganicos /></ProtectedRoute>} />
            <Route path="/metricas/metas" element={<ProtectedRoute><MetricasMetas /></ProtectedRoute>} />
            <Route path="/metricas/integracao-meta" element={<ProtectedRoute><MetaAdsIntegracao /></ProtectedRoute>} />
            <Route path="/metricas/contratos-fechados" element={<ProtectedRoute><ContratosFechados /></ProtectedRoute>} />
            
            <Route path="/metricas/tentativas" element={<ProtectedRoute><TentativasFuturas /></ProtectedRoute>} />
            <Route path="/metricas/propostas-enviadas" element={<ProtectedRoute><PropostasEnviadas /></ProtectedRoute>} />
            <Route path="/metricas/consumo-ia" element={<ProtectedRoute><ConsumoIA /></ProtectedRoute>} />
            <Route path="/olivia/conhecimento" element={<ProtectedRoute><AppLayout><OliviaConhecimento /></AppLayout></ProtectedRoute>} />
            <Route path="/calculadora-honorarios" element={<ProtectedRoute><CalculadoraHonorarios /></ProtectedRoute>} />
            <Route path="/calculadoras" element={<ProtectedRoute><Calculadoras /></ProtectedRoute>} />
            <Route path="/consultoria-empresarial" element={<ProtectedRoute><ConsultoriaEmpresarial /></ProtectedRoute>} />
            <Route path="/consultoria/empresas" element={<ProtectedRoute><EmpresasConsultoria /></ProtectedRoute>} />
            <Route path="/consultoria/empresas/:id" element={<ProtectedRoute><EmpresaConsultoriaDetalhe /></ProtectedRoute>} />
            <Route path="/consultoria/demandas" element={<ProtectedRoute><DemandasInbox /></ProtectedRoute>} />
            <Route path="/consultoria/demandas/:id" element={<ProtectedRoute><DemandaDetalhe /></ProtectedRoute>} />
            <Route path="/consultoria/demandas-externas" element={<ProtectedRoute><DemandasExternas /></ProtectedRoute>} />
            <Route path="/consultoria/demandas-externas/:id" element={<ProtectedRoute><DemandaExternaDetalhe /></ProtectedRoute>} />
            <Route path="/consultoria/propostas" element={<ProtectedRoute><PropostasConsultoria /></ProtectedRoute>} />
            <Route path="/consultoria/carteira" element={<ProtectedRoute><CarteiraAvencas /></ProtectedRoute>} />
            <Route path="/consultoria/onboarding" element={<ProtectedRoute><OnboardingConsultoria /></ProtectedRoute>} />
            <Route path="/consultoria/onboarding/:id" element={<ProtectedRoute><OnboardingConsultoriaDetalhe /></ProtectedRoute>} />
            <Route path="/financeiro" element={<CeoRoute><Financeiro /></CeoRoute>} />
            <Route path="/financeiro/lancamentos" element={<CeoRoute><FinanceiroLancamentos /></CeoRoute>} />
            <Route path="/master" element={<CeoRoute><DashboardMaster /></CeoRoute>} />
            <Route path="/analise-contratos" element={<ProtectedRoute><AppLayout><AnaliseContratos /></AppLayout></ProtectedRoute>} />
            <Route path="/comercial/atendimentos" element={<ProtectedRoute><AtendimentosComercial /></ProtectedRoute>} />
            <Route path="/pos-venda/onboarding" element={<ProtectedRoute><PosVendaOnboardings /></ProtectedRoute>} />
            <Route path="/pos-venda/onboarding/:id" element={<ProtectedRoute><PosVendaOnboardingDetalhe /></ProtectedRoute>} />
            <Route path="/pos-venda/relatorio-cliente" element={<ProtectedRoute><AppLayout><RelatorioClientePosVenda /></AppLayout></ProtectedRoute>} />
            <Route path="/pos-venda/carteira" element={<ProtectedRoute><CarteiraClientesPosVenda /></ProtectedRoute>} />
            <Route path="/pos-venda/triagem" element={<ProtectedRoute><TriagemCarteira /></ProtectedRoute>} />
            <Route path="/pos-venda/divisao" element={<ProtectedRoute><DivisaoCarteira /></ProtectedRoute>} />
            <Route path="/saude-sistema" element={<ProtectedRoute><SaudeSistema /></ProtectedRoute>} />
            <Route path="/pos-venda/painel" element={<ProtectedRoute><PainelPosVenda /></ProtectedRoute>} />
            <Route path="/pos-venda/chamados" element={<ProtectedRoute><ChamadosPortal /></ProtectedRoute>} />
            <Route path="/pos-venda/chamados/:id" element={<ProtectedRoute><ChamadoPortalDetalhe /></ProtectedRoute>} />
            <Route path="/workflow" element={<ProtectedRoute><WorkflowPage /></ProtectedRoute>} />
            <Route path="/mensagens" element={<ProtectedRoute><Mensagens /></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
            
            <Route path="/campo" element={<ProtectedRoute><Campo /></ProtectedRoute>} />
            <Route path="/portal" element={<PortalRoute><PortalIndex /></PortalRoute>} />
            <Route path="/portal/demandas" element={<PortalRoute require="empresa"><PortalDemandas /></PortalRoute>} />
            <Route path="/portal/demandas/:id" element={<PortalRoute require="empresa"><PortalDemandaDetalhe /></PortalRoute>} />
            <Route path="/portal/meu-plano" element={<PortalRoute require="empresa"><PortalMeuPlano /></PortalRoute>} />
            <Route path="/portal/servicos" element={<PortalRoute require="empresa"><PortalServicos /></PortalRoute>} />
            <Route path="/portal/pedidos" element={<PortalRoute require="empresa"><PortalMeusPedidos /></PortalRoute>} />
            <Route path="/portal/relatorios" element={<PortalRoute require="empresa"><PortalRelatorios /></PortalRoute>} />
            <Route path="/portal/inicio" element={<PortalRoute require="cliente"><PortalHome /></PortalRoute>} />
            <Route path="/portal/contratos" element={<PortalRoute require="cliente"><PortalClienteContratos /></PortalRoute>} />
            <Route path="/portal/chamados" element={<PortalRoute require="cliente"><PortalClienteChamados /></PortalRoute>} />
            <Route path="/portal/chamados/:id" element={<PortalRoute require="cliente"><PortalClienteChamadoDetalhe /></PortalRoute>} />
            <Route path="/portal/processos" element={<PortalRoute require="cliente"><PortalClienteProcessos /></PortalRoute>} />
            <Route path="/portal/processos/:id" element={<PortalRoute require="cliente"><PortalClienteProcessoDetalhe /></PortalRoute>} />
            <Route path="/portal/atendimentos" element={<PortalRoute require="cliente"><PortalClienteAtendimentos /></PortalRoute>} />
            <Route path="/portal/acordos" element={<PortalRoute require="cliente"><PortalClienteAcordos /></PortalRoute>} />
            <Route path="/admin/ofertas" element={<ProtectedRoute><OfertasCatalogo /></ProtectedRoute>} />
            <Route path="/admin/pedidos" element={<ProtectedRoute><PedidosServico /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        </ConfirmDialogProvider>
      </TooltipProvider>
      </AreaProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
