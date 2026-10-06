export type FaseProcesso = 1 | 2 | 3 | 4 | 5;
export type StatusFase = "pendente" | "em_andamento" | "concluida" | "bloqueada";
export type TipoEncerramento = "admin_aceito" | "judicial_aceito" | "nao_prosseguir" | "negado_definitivo" | "outro";
export type TipoRespostaBanco = "aceito" | "negado" | "silencio" | "aguardando" | "documentos_complementares";

export interface Processo {
  id: string;
  laudoId: string;
  produtor: string;
  banco: string;
  contrato: string;
  saldoDevedor: string;
  cultura: string;
  safra: string;
  municipio: string;
  uf: string;
  faseAtual: FaseProcesso;
  statusFases: Record<FaseProcesso, StatusFase>;
  datasFases: Record<FaseProcesso, { inicio?: string; fim?: string }>;
  responsavelJuridico: string;
  responsavelAgronomo: string;
  scoreEnquadramento: number;
  hipotesesMcr: string[];
  prazoSolicitado: number;
  createdAt: string;
  // Fase 2
  viaEnvio?: string;
  dataEnvioNotificacao?: string;
  prazoRespostaBanco?: string;
  // Fase 3
  tipoRespostaBanco?: TipoRespostaBanco;
  dataRespostaBanco?: string;
  // Fase 4
  numeroProcessoCnj?: string;
  comarca?: string;
  vara?: string;
  statusTutela?: "pendente" | "deferida" | "negada";
  // Fase 5
  tipoEncerramento?: TipoEncerramento;
  dataEncerramento?: string;
  prazoConcedido?: number;
}

export interface Alerta {
  id: string;
  tipo: "urgente" | "atencao" | "info" | "ok";
  mensagem: string;
  data: string;
}

export interface Movimentacao {
  id: string;
  fase: FaseProcesso;
  tipo: string;
  descricao: string;
  usuario: string;
  createdAt: string;
}

export const mockProcessos: Processo[] = [
  {
    id: "proc-001",
    laudoId: "1",
    produtor: "José Carlos da Silva",
    banco: "Banco do Brasil",
    contrato: "BB-2024-00123456",
    saldoDevedor: "R$ 285.000,00",
    cultura: "Soja",
    safra: "2024/2025",
    municipio: "Londrina",
    uf: "PR",
    faseAtual: 2,
    statusFases: {
      1: "concluida",
      2: "em_andamento",
      3: "pendente",
      4: "bloqueada",
      5: "pendente",
    },
    datasFases: {
      1: { inicio: "2025-02-15", fim: "2025-03-01" },
      2: { inicio: "2025-03-05" },
      3: {},
      4: {},
      5: {},
    },
    responsavelJuridico: "Dra. Ana Paula Mendes",
    responsavelAgronomo: "Eng. Carlos Ribeiro",
    scoreEnquadramento: 82,
    hipotesesMcr: ["b", "d"],
    prazoSolicitado: 36,
    createdAt: "2025-02-15",
    viaEnvio: "Cartório de Títulos e Documentos",
    dataEnvioNotificacao: "2025-03-05",
    prazoRespostaBanco: "2025-03-26",
  },
  {
    id: "proc-002",
    laudoId: "4",
    produtor: "Pedro Henrique Oliveira",
    banco: "Sicredi",
    contrato: "SIC-2023-00789012",
    saldoDevedor: "R$ 520.000,00",
    cultura: "Algodão",
    safra: "2023/2024",
    municipio: "Luís Eduardo Magalhães",
    uf: "BA",
    faseAtual: 4,
    statusFases: {
      1: "concluida",
      2: "concluida",
      3: "concluida",
      4: "em_andamento",
      5: "pendente",
    },
    datasFases: {
      1: { inicio: "2025-01-10", fim: "2025-01-28" },
      2: { inicio: "2025-02-01", fim: "2025-02-15" },
      3: { inicio: "2025-02-15", fim: "2025-03-02" },
      4: { inicio: "2025-03-05" },
      5: {},
    },
    responsavelJuridico: "Dr. Marcos Vinícius Costa",
    responsavelAgronomo: "Eng. Fernanda Lima",
    scoreEnquadramento: 91,
    hipotesesMcr: ["a", "b"],
    prazoSolicitado: 48,
    createdAt: "2025-01-10",
    tipoRespostaBanco: "negado",
    dataRespostaBanco: "2025-03-02",
    numeroProcessoCnj: "0001234-56.2025.8.05.0001",
    comarca: "Luís Eduardo Magalhães",
    vara: "1ª Vara Cível",
    statusTutela: "deferida",
  },
  {
    id: "proc-003",
    laudoId: "6",
    produtor: "Antônio Marcos Pereira",
    banco: "Caixa Econômica Federal",
    contrato: "CEF-2024-00345678",
    saldoDevedor: "R$ 180.000,00",
    cultura: "Arroz",
    safra: "2024/2025",
    municipio: "Pelotas",
    uf: "RS",
    faseAtual: 3,
    statusFases: {
      1: "concluida",
      2: "concluida",
      3: "em_andamento",
      4: "bloqueada",
      5: "pendente",
    },
    datasFases: {
      1: { inicio: "2025-02-01", fim: "2025-02-15" },
      2: { inicio: "2025-02-18", fim: "2025-02-28" },
      3: { inicio: "2025-03-01" },
      4: {},
      5: {},
    },
    responsavelJuridico: "Dra. Carolina Souza",
    responsavelAgronomo: "Eng. Roberto Santos",
    scoreEnquadramento: 68,
    hipotesesMcr: ["b"],
    prazoSolicitado: 24,
    createdAt: "2025-02-01",
    tipoRespostaBanco: "aguardando",
    prazoRespostaBanco: "2025-03-21",
  },
  {
    id: "proc-004",
    laudoId: "2",
    produtor: "Maria Aparecida Souza",
    banco: "Bradesco",
    contrato: "BRA-2024-00567890",
    saldoDevedor: "R$ 95.000,00",
    cultura: "Milho",
    safra: "2024/2025",
    municipio: "Ribeirão Preto",
    uf: "SP",
    faseAtual: 5,
    statusFases: {
      1: "concluida",
      2: "concluida",
      3: "concluida",
      4: "pendente",
      5: "concluida",
    },
    datasFases: {
      1: { inicio: "2025-01-05", fim: "2025-01-18" },
      2: { inicio: "2025-01-20", fim: "2025-02-01" },
      3: { inicio: "2025-02-01", fim: "2025-02-10" },
      4: {},
      5: { inicio: "2025-02-10", fim: "2025-02-10" },
    },
    responsavelJuridico: "Dr. Felipe Augusto",
    responsavelAgronomo: "Eng. Carlos Ribeiro",
    scoreEnquadramento: 75,
    hipotesesMcr: ["a", "c"],
    prazoSolicitado: 24,
    createdAt: "2025-01-05",
    tipoRespostaBanco: "aceito",
    dataRespostaBanco: "2025-02-10",
    tipoEncerramento: "admin_aceito",
    dataEncerramento: "2025-02-10",
    prazoConcedido: 24,
  },
];

export const mockAlertas: Record<string, Alerta[]> = {
  "proc-001": [
    { id: "a1", tipo: "atencao", mensagem: "Prazo de resposta do banco vence em 8 dias (26/03)", data: "2025-03-18" },
    { id: "a2", tipo: "info", mensagem: "Notificação enviada via Cartório de T.D. em 05/03", data: "2025-03-05" },
  ],
  "proc-002": [
    { id: "a3", tipo: "ok", mensagem: "Tutela de urgência deferida em 12/03/2025", data: "2025-03-12" },
    { id: "a4", tipo: "info", mensagem: "Petição inicial protocolada em 05/03", data: "2025-03-05" },
  ],
  "proc-003": [
    { id: "a5", tipo: "urgente", mensagem: "Prazo de resposta do banco vence em 3 dias (21/03)", data: "2025-03-18" },
    { id: "a6", tipo: "atencao", mensagem: "Banco não respondeu há 18 dias", data: "2025-03-18" },
  ],
  "proc-004": [
    { id: "a7", tipo: "ok", mensagem: "Processo encerrado — prorrogação concedida administrativamente", data: "2025-02-10" },
  ],
};

export const mockMovimentacoes: Record<string, Movimentacao[]> = {
  "proc-001": [
    { id: "m1", fase: 1, tipo: "laudo", descricao: "Laudo técnico finalizado e assinado", usuario: "Eng. Carlos Ribeiro", createdAt: "2025-03-01" },
    { id: "m2", fase: 2, tipo: "notificacao", descricao: "Notificação extrajudicial gerada com IA", usuario: "Dra. Ana Paula Mendes", createdAt: "2025-03-04" },
    { id: "m3", fase: 2, tipo: "envio", descricao: "Notificação enviada via Cartório de T.D.", usuario: "Dra. Ana Paula Mendes", createdAt: "2025-03-05" },
  ],
  "proc-002": [
    { id: "m4", fase: 1, tipo: "laudo", descricao: "Laudo técnico finalizado", usuario: "Eng. Fernanda Lima", createdAt: "2025-01-28" },
    { id: "m5", fase: 2, tipo: "envio", descricao: "Notificação enviada ao Sicredi", usuario: "Dr. Marcos Vinícius Costa", createdAt: "2025-02-01" },
    { id: "m6", fase: 3, tipo: "resposta", descricao: "Banco negou com fundamentação escrita", usuario: "Dr. Marcos Vinícius Costa", createdAt: "2025-03-02" },
    { id: "m7", fase: 4, tipo: "peticao", descricao: "Petição inicial protocolada — Ação de Obrigação de Fazer", usuario: "Dr. Marcos Vinícius Costa", createdAt: "2025-03-05" },
    { id: "m8", fase: 4, tipo: "decisao", descricao: "Tutela de urgência DEFERIDA — suspensão de cobranças", usuario: "Dr. Marcos Vinícius Costa", createdAt: "2025-03-12" },
  ],
  "proc-003": [
    { id: "m9", fase: 1, tipo: "laudo", descricao: "Laudo técnico finalizado", usuario: "Eng. Roberto Santos", createdAt: "2025-02-15" },
    { id: "m10", fase: 2, tipo: "envio", descricao: "Notificação enviada à CEF", usuario: "Dra. Carolina Souza", createdAt: "2025-02-28" },
    { id: "m11", fase: 3, tipo: "aguardando", descricao: "Aguardando resposta do banco — prazo até 21/03", usuario: "Sistema", createdAt: "2025-03-01" },
  ],
  "proc-004": [
    { id: "m12", fase: 1, tipo: "laudo", descricao: "Laudo técnico finalizado", usuario: "Eng. Carlos Ribeiro", createdAt: "2025-01-18" },
    { id: "m13", fase: 2, tipo: "envio", descricao: "Notificação enviada ao Bradesco", usuario: "Dr. Felipe Augusto", createdAt: "2025-01-20" },
    { id: "m14", fase: 3, tipo: "resposta", descricao: "Banco aceitou — prorrogação de 24 meses concedida", usuario: "Dr. Felipe Augusto", createdAt: "2025-02-10" },
    { id: "m15", fase: 5, tipo: "encerramento", descricao: "Processo encerrado com sucesso", usuario: "Dr. Felipe Augusto", createdAt: "2025-02-10" },
  ],
};

export function getFaseLabel(fase: FaseProcesso): string {
  const labels: Record<FaseProcesso, string> = {
    1: "Laudo Técnico",
    2: "Notificação Extrajudicial",
    3: "Resposta do Banco",
    4: "Via Judicial",
    5: "Encerrado",
  };
  return labels[fase];
}

export function getFaseIcon(fase: FaseProcesso): string {
  const icons: Record<FaseProcesso, string> = {
    1: "📋",
    2: "📨",
    3: "🏦",
    4: "⚖️",
    5: "✅",
  };
  return icons[fase];
}

export function getStatusFaseColor(status: StatusFase): string {
  switch (status) {
    case "concluida": return "text-success";
    case "em_andamento": return "text-accent";
    case "pendente": return "text-muted-foreground";
    case "bloqueada": return "text-destructive/50";
  }
}

export function diasNaFase(processo: Processo): number {
  const faseData = processo.datasFases[processo.faseAtual];
  if (!faseData?.inicio) return 0;
  const inicio = new Date(faseData.inicio);
  const hoje = new Date();
  return Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
}

export function getFaseBadgeColor(fase: FaseProcesso): string {
  switch (fase) {
    case 1: return "bg-muted text-muted-foreground";
    case 2: return "bg-accent/15 text-accent";
    case 3: return "bg-info/15 text-info";
    case 4: return "bg-destructive/15 text-destructive";
    case 5: return "bg-success/15 text-success";
  }
}
