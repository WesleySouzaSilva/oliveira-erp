// Checklist de onboarding da Oliveira Agro — pedido de prorrogação, laudo e ação de alongamento.
// Três níveis: pessoa (cada titular), família (o grupo) e operação (cada contrato).

export type NivelItem = "pessoa" | "familia" | "operacao";
export type OrigemItem = "cliente" | "escritorio";
export type StatusItem = "pendente" | "recebido" | "conferido" | "nao_aplica" | "dispensado";

export const STATUS_LABEL: Record<StatusItem, string> = {
  pendente: "Pendente",
  recebido: "Recebido",
  conferido: "Conferido",
  nao_aplica: "Não se aplica",
  dispensado: "Dispensado",
};

export const ETAPAS = [
  { etapa: 1, titulo: "Fechamento", quem: "Comercial (Celina e Ana)" },
  { etapa: 2, titulo: "Pedido ao banco", quem: "Mapeamento (Maycon e Fernanda)" },
  { etapa: 3, titulo: "Laudos", quem: "Mapeamento e Lucas" },
  { etapa: 4, titulo: "Ação judicial", quem: "Jurídico (só se o banco negar ou não responder)" },
  { etapa: 5, titulo: "Execução / garantias", quem: "Jurídico — corre em paralelo ao pedido ao banco" },
] as const;

/** Processos e cobranças em andamento contra o cliente. */
export const TIPOS_PROCESSO = [
  { key: "nao", label: "Não", curto: "" },
  { key: "execucao", label: "Execução judicial", curto: "Em execução" },
  { key: "busca_apreensao", label: "Busca e apreensão", curto: "Busca e apreensão" },
  { key: "consolidacao", label: "Consolidação de imóvel em cartório (alienação fiduciária)", curto: "Consolidação" },
  { key: "cobranca", label: "Ação de cobrança ou monitória", curto: "Cobrança" },
  { key: "outro", label: "Outro processo", curto: "Processo em curso" },
  { key: "nao_sei", label: "Não sei", curto: "Verificar processos" },
] as const;

export const labelTipoProcesso = (key: string) =>
  TIPOS_PROCESSO.find((t) => t.key === key)?.label || key;
export const curtoTipoProcesso = (key: string) =>
  TIPOS_PROCESSO.find((t) => t.key === key)?.curto || "Processo em curso";

/** Tipos que ligam o módulo "Garantias e execução". */
export const tiposAtivos = (processos?: string[] | null) =>
  (processos || []).filter((p) => p !== "nao" && p !== "nao_sei");

export type RespostaPessoa = {
  tipo: "pf" | "pj";
  casado: boolean;
  govbr: "bronze" | "prata" | "ouro" | "sem";
};

export type RespostasOnboarding = {
  pessoas: Record<string, RespostaPessoa>; // chave: id do titular (cliente_id)
  terra: "propria" | "arrendada" | "ambos";
  atividades: string[]; // graos, leite, gado_corte, aves, suinos, cafe, outras
  enquadramento: "pronaf" | "pronamp" | "demais";
  evento_climatico: boolean;
  seguro: boolean;
  justica_gratuita: boolean;
  /** Processo ou cobrança em andamento contra o cliente (chaves de TIPOS_PROCESSO). */
  processos: string[];
  /** Entrada urgente: vencimento em cima, sem contrato e sem tempo de laudo. */
  urgente?: boolean;
};

export const RESPOSTAS_PADRAO: Omit<RespostasOnboarding, "pessoas"> = {
  terra: "propria",
  atividades: [],
  enquadramento: "demais",
  evento_climatico: false,
  seguro: false,
  justica_gratuita: false,
  processos: [],
  urgente: false,
};

export const PESSOA_PADRAO: RespostaPessoa = { tipo: "pf", casado: false, govbr: "sem" };


export const ATIVIDADES = [
  { key: "graos", label: "Grãos" },
  { key: "leite", label: "Leite" },
  { key: "gado_corte", label: "Gado de corte" },
  { key: "aves", label: "Aves" },
  { key: "suinos", label: "Suínos" },
  { key: "cafe", label: "Café" },
  { key: "outras", label: "Outras" },
] as const;

export type ItemTemplate = {
  chave: string;
  etapa: 1 | 2 | 3 | 4 | 5;
  nivel: NivelItem;
  origem: OrigemItem;
  simples: string; // nome para o cliente
  tecnico: string; // nome técnico (tooltip)
  obrigatorio?: boolean;
  aviso?: string;
  /** Condição de criação. p = respostas da pessoa (quando nível pessoa). */
  cond?: (r: RespostasOnboarding, p?: RespostaPessoa) => boolean;
};

export const ITENS_TEMPLATE: ItemTemplate[] = [
  // ---------- ETAPA 1 — FECHAMENTO ----------
  { chave: "doc_identidade", etapa: 1, nivel: "pessoa", origem: "cliente", simples: "RG e CPF (ou CNH)", tecnico: "Documento oficial de identificação com CPF" },
  { chave: "comprovante_endereco", etapa: 1, nivel: "pessoa", origem: "cliente", simples: "Comprovante de endereço", tecnico: "Comprovante de residência atualizado" },
  { chave: "procuracao", etapa: 1, nivel: "pessoa", origem: "cliente", simples: "Procuração assinada", tecnico: "Instrumento de mandato ad judicia et extra" },
  {
    chave: "certidao_casamento", etapa: 1, nivel: "pessoa", origem: "cliente",
    simples: "Certidão de casamento e documentos do cônjuge",
    tecnico: "Certidão de casamento/união estável + RG e CPF do cônjuge",
    cond: (_r, p) => !!p?.casado,
  },
  {
    chave: "cnpj_contrato_social", etapa: 1, nivel: "pessoa", origem: "cliente",
    simples: "Cartão CNPJ e contrato social",
    tecnico: "Cartão CNPJ atualizado e contrato social consolidado",
    cond: (_r, p) => p?.tipo === "pj",
  },

  // ---------- ETAPA 2 — PEDIDO AO BANCO (mapeamento) ----------
  // Ordem do gov.br: solicitar o acesso → conferir o nível → emitir o Registrato.
  {
    chave: "govbr_acesso", etapa: 2, nivel: "pessoa", origem: "escritorio",
    simples: "Solicitar e alinhar o acesso gov.br com o cliente",
    tecnico: "Acesso assistido ao gov.br (quem mapeia): registro de data, forma, quem conduziu e finalidade — nunca senha do cliente",
  },
  {
    chave: "autorizacao_govbr", etapa: 2, nivel: "pessoa", origem: "cliente",
    simples: "Autorização de acesso ao gov.br assinada",
    tecnico: "Termo de autorização de acesso assistido ao gov.br — finalidade: Registrato, imposto de renda e CAR",
  },
  {
    chave: "govbr_nivel", etapa: 2, nivel: "pessoa", origem: "escritorio",
    simples: "Conferir o nível da conta gov.br",
    tecnico: "Verificação do nível da conta gov.br (bronze precisa subir para prata ou ouro)",
  },
  {
    chave: "govbr_regularizar", etapa: 2, nivel: "pessoa", origem: "cliente",
    simples: "Regularizar conta gov.br para prata ou ouro",
    tecnico: "Elevação do nível da conta gov.br (bronze → prata/ouro)",
    aviso: "Sem prata ou ouro não é possível emitir o Registrato.",
    obrigatorio: false,
    cond: (_r, p) => p?.govbr === "bronze",
  },
  {
    chave: "registrato", etapa: 2, nivel: "pessoa", origem: "escritorio",
    simples: "Registrato do Banco Central emitido",
    tecnico: "Relatório Registrato (SCR) — validade de 90 dias",
  },

  {
    chave: "identificacao_operacao", etapa: 2, nivel: "operacao", origem: "cliente",
    simples: "Identificação da operação: banco e, se souber, número e agência",
    tecnico: "Identificação mínima da operação para o pedido em regime de urgência",
    obrigatorio: false,
    cond: (r) => !!r.urgente,
  },
  { chave: "cedula_contrato", etapa: 2, nivel: "operacao", origem: "cliente", simples: "Cédula ou contrato completo, com aditivos", tecnico: "CCB/cédula rural integral e todos os aditivos e repactuações" },
  { chave: "saldo_devedor", etapa: 2, nivel: "operacao", origem: "cliente", simples: "Saldo devedor atualizado / extrato", tecnico: "Extrato de evolução da dívida (DAD) ou saldo devedor atualizado" },
  {
    chave: "notificacao_banco", etapa: 2, nivel: "operacao", origem: "cliente",
    simples: "Notificação ou cobrança recebida do banco",
    tecnico: "Notificação extrajudicial, carta de cobrança ou aviso de vencimento antecipado",
    obrigatorio: false,
  },
  { chave: "pedido_administrativo", etapa: 2, nivel: "operacao", origem: "escritorio", simples: "Pedido administrativo de prorrogação", tecnico: "Petição administrativa protocolada junto à instituição financeira", obrigatorio: false },
  { chave: "comprovante_envio", etapa: 2, nivel: "operacao", origem: "escritorio", simples: "Comprovante de envio ao banco", tecnico: "Protocolo/AR/consumidor.gov comprovando a entrega do pedido", obrigatorio: false },
  { chave: "resposta_banco", etapa: 2, nivel: "operacao", origem: "escritorio", simples: "Resposta do banco", tecnico: "Manifestação da instituição financeira ou decurso do prazo de 15 dias", obrigatorio: false },

  // ---------- ETAPA 3 — LAUDOS ----------
  {
    chave: "matricula", etapa: 3, nivel: "familia", origem: "cliente",
    simples: "Matrícula do imóvel", tecnico: "Matrícula atualizada do Registro de Imóveis",
    cond: (r) => r.terra === "propria" || r.terra === "ambos",
  },
  {
    chave: "arrendamento", etapa: 3, nivel: "familia", origem: "cliente",
    simples: "Contrato de arrendamento ou parceria", tecnico: "Contrato de arrendamento rural / parceria agrícola vigente",
    cond: (r) => r.terra === "arrendada" || r.terra === "ambos",
  },
  { chave: "car", etapa: 3, nivel: "familia", origem: "cliente", simples: "CAR (cadastro ambiental)", tecnico: "Cadastro Ambiental Rural ativo — pode ser obtido no acesso gov.br" },
  { chave: "imposto_renda", etapa: 3, nivel: "pessoa", origem: "cliente", simples: "Imposto de renda dos últimos 3 anos", tecnico: "DIRPF dos 3 últimos exercícios — pode ser obtido no acesso gov.br" },
  { chave: "notas_venda", etapa: 3, nivel: "familia", origem: "cliente", simples: "Notas de venda da produção (3 anos)", tecnico: "Notas fiscais de comercialização da produção dos últimos 3 anos" },
  { chave: "notas_insumos", etapa: 3, nivel: "familia", origem: "cliente", simples: "Notas de compra de insumos da safra da perda", tecnico: "Notas fiscais de insumos da safra objeto da frustração" },
  { chave: "fotos_videos", etapa: 3, nivel: "familia", origem: "cliente", simples: "Fotos e vídeos da lavoura", tecnico: "Registro fotográfico/audiovisual da perda — ou declaração do cliente de que não possui" },
  {
    chave: "decreto", etapa: 3, nivel: "familia", origem: "cliente",
    simples: "Decreto de emergência ou calamidade do município", tecnico: "Decreto municipal de situação de emergência/estado de calamidade",
    cond: (r) => r.evento_climatico,
  },
  {
    chave: "apolice", etapa: 3, nivel: "operacao", origem: "cliente",
    simples: "Apólice do seguro ou comprovante do PROAGRO", tecnico: "Apólice de seguro agrícola ou comprovante de adesão ao PROAGRO",
    cond: (r) => r.seguro,
  },
  {
    chave: "notas_laticinio", etapa: 3, nivel: "familia", origem: "cliente",
    simples: "Notas do laticínio", tecnico: "Notas/recibos de entrega de leite ao laticínio",
    cond: (r) => r.atividades.includes("leite"),
  },
  {
    chave: "ficha_sanitaria", etapa: 3, nivel: "familia", origem: "cliente",
    simples: "Ficha sanitária do rebanho / GTA", tecnico: "Cadastro sanitário do rebanho e Guias de Trânsito Animal",
    cond: (r) => r.atividades.includes("gado_corte"),
  },
  {
    chave: "caf_dap", etapa: 3, nivel: "pessoa", origem: "cliente",
    simples: "CAF (antiga DAP)", tecnico: "Cadastro Nacional da Agricultura Familiar (CAF), antiga DAP",
    cond: (r) => r.enquadramento === "pronaf",
  },
  { chave: "laudo_perda", etapa: 3, nivel: "familia", origem: "escritorio", simples: "Laudo de perda", tecnico: "Laudo técnico de frustração de safra (MCR 2.6.4)", obrigatorio: false },
  { chave: "laudo_capacidade", etapa: 3, nivel: "familia", origem: "escritorio", simples: "Laudo de capacidade de pagamento", tecnico: "Laudo de capacidade de pagamento e projeção de fluxo de caixa", obrigatorio: false },

  // ---------- ETAPA 4 — AÇÃO JUDICIAL ----------
  {
    chave: "hipossuficiencia", etapa: 4, nivel: "pessoa", origem: "cliente",
    simples: "Declaração de hipossuficiência", tecnico: "Declaração de hipossuficiência para justiça gratuita",
    cond: (r) => r.justica_gratuita,
  },
  {
    chave: "ctps", etapa: 4, nivel: "pessoa", origem: "cliente",
    simples: "Carteira de trabalho", tecnico: "CTPS (física ou digital)",
    cond: (r) => r.justica_gratuita,
  },
  {
    chave: "holerites", etapa: 4, nivel: "pessoa", origem: "cliente",
    simples: "Holerites (se houver)", tecnico: "Contracheques dos últimos meses, se houver vínculo",
    obrigatorio: false,
    cond: (r) => r.justica_gratuita,
  },
  {
    chave: "extratos_3m", etapa: 4, nivel: "pessoa", origem: "cliente",
    simples: "Extratos bancários dos últimos 3 meses", tecnico: "Extratos de todas as contas dos 3 meses anteriores",
    cond: (r) => r.justica_gratuita,
  },

  // ---------- ETAPA 5 — EXECUÇÃO / GARANTIAS (paralela ao pedido ao banco) ----------
  {
    chave: "exec_processo_dados", etapa: 5, nivel: "operacao", origem: "escritorio",
    simples: "Número do processo, vara e sistema", tecnico: "Número CNJ, vara/comarca e sistema (PROJUDI, eproc, PJe)",
    cond: (r) => tiposAtivos(r.processos).length > 0,
  },
  {
    chave: "exec_autos", etapa: 5, nivel: "operacao", origem: "escritorio",
    simples: "Cópia integral dos autos", tecnico: "Cópia integral dos autos do processo em curso",
    cond: (r) => tiposAtivos(r.processos).length > 0,
  },
  {
    chave: "exec_titulo", etapa: 5, nivel: "operacao", origem: "cliente",
    simples: "Título cobrado: cédula/CCB que o banco usou", tecnico: "Título executivo apresentado pelo banco (CCB/cédula rural)",
    cond: (r) => tiposAtivos(r.processos).length > 0,
  },
  {
    chave: "exec_planilha", etapa: 5, nivel: "operacao", origem: "cliente",
    simples: "Planilha de cálculo do débito apresentada pelo banco", tecnico: "Memória de cálculo do débito juntada pela instituição financeira",
    cond: (r) => tiposAtivos(r.processos).length > 0,
  },
  {
    chave: "exec_citacao", etapa: 5, nivel: "pessoa", origem: "escritorio",
    simples: "Situação da citação", tecnico: "Não citado / citado — se citado, data da juntada do mandado cumprido",
    cond: (r) => tiposAtivos(r.processos).length > 0,
  },
  {
    chave: "exec_avalistas", etapa: 5, nivel: "operacao", origem: "escritorio",
    simples: "Avalistas e coobrigados cobrados", tecnico: "Relação de avalistas/coobrigados no polo passivo e situação da citação de cada um",
    cond: (r) => tiposAtivos(r.processos).length > 0,
  },
  {
    chave: "exec_negociacao", etapa: 5, nivel: "operacao", origem: "cliente",
    simples: "Provas de negociação com o banco", tecnico: "E-mails, mensagens, propostas e aprovações de prorrogação trocadas com o banco",
    cond: (r) => tiposAtivos(r.processos).length > 0,
  },
  {
    chave: "exec_pagamentos", etapa: 5, nivel: "operacao", origem: "cliente",
    simples: "Comprovantes de pagamentos já feitos", tecnico: "Comprovantes de amortizações e pagamentos realizados na operação",
    cond: (r) => tiposAtivos(r.processos).length > 0,
  },
  {
    chave: "exec_monitoramento", etapa: 5, nivel: "operacao", origem: "escritorio",
    simples: "Cadastrar titulares e avalistas no acompanhamento de intimações",
    tecnico: "Após a habilitação nos autos: incluir as partes como monitoradas no acompanhamento de intimações (registra quem fez e quando)",
    cond: (r) => tiposAtivos(r.processos).length > 0,
  },
  {
    chave: "exec_bens_penhorados", etapa: 5, nivel: "familia", origem: "escritorio",
    simples: "Bens penhorados ou arrestados", tecnico: "Relação dos bens penhorados/arrestados e respectivos autos",
    cond: (r) => r.processos?.includes("execucao"),
  },
  {
    chave: "exec_auto_apreensao", etapa: 5, nivel: "operacao", origem: "cliente",
    simples: "Auto de apreensão e documento do bem", tecnico: "Auto de busca e apreensão cumprido e documento do bem apreendido",
    cond: (r) => r.processos?.includes("busca_apreensao"),
  },
  {
    chave: "exec_notificacao_cartorio", etapa: 5, nivel: "familia", origem: "cliente",
    simples: "Notificação do cartório e prazo para purgar a mora",
    tecnico: "Intimação do Registro de Imóveis (Lei 9.514) com o prazo de purgação da mora",
    cond: (r) => r.processos?.includes("consolidacao"),
  },
  {
    chave: "exec_matricula_onus_consolidacao", etapa: 5, nivel: "familia", origem: "cliente",
    simples: "Matrícula atualizada com ônus (consolidação)", tecnico: "Matrícula atualizada com a averbação da consolidação/alienação fiduciária",
    cond: (r) => r.processos?.includes("consolidacao"),
  },
  {
    chave: "exec_garantias", etapa: 5, nivel: "familia", origem: "cliente",
    simples: "Matrícula com ônus ou documento do bem alienado",
    tecnico: "Matrícula atualizada com ônus reais ou documento do bem dado em garantia/alienado",
    cond: (r) => tiposAtivos(r.processos).length > 0,
  },
  {
    chave: "exec_verificar", etapa: 5, nivel: "familia", origem: "escritorio",
    simples: "Verificar processos e cobranças em nome dos titulares",
    tecnico: "Pesquisa processual e de cobranças em nome dos titulares — prazo de 2 dias úteis; ao verificar, atualizar a resposta",
    cond: (r) => (r.processos || []).includes("nao_sei"),
  },
];


/** Itens da etapa 3 que também valem para a etapa 4 sem serem pedidos de novo. */
export const REAPROVEITADOS_ETAPA4 = ["imposto_renda", "notas_venda"];

/** Entrada urgente: só estes itens aparecem primeiro; o resto fica recolhido. */
export const CHECKLIST_URGENCIA = [
  "procuracao",
  "doc_identidade",
  "autorizacao_govbr",
  "registrato",
  "identificacao_operacao",
];

/** O Registrato é o que identifica as operações quando o cliente não tem os contratos. */
export const PRIORITARIO_URGENCIA = "registrato";

export const TEXTO_GOVBR =
  "Vamos precisar acessar seu gov.br junto com você, para puxar o relatório de dívidas do Banco Central. " +
  "Sua conta precisa estar no nível prata ou ouro. Na hora, você recebe um código no celular e nos passa. " +
  "A gente não guarda sua senha.";

export const MODULOS_OPCIONAIS = [
  { key: "garantias_execucao", label: "Garantias e execução", desc: "Bens alienados, matrícula com ônus, notificação de consolidação." },
  { key: "mp_1376", label: "MP 1.376 — linha de composição", desc: "Documentos específicos da linha de composição de dívidas." },
  { key: "recuperacao_judicial", label: "Recuperação judicial", desc: "Documentos do rito de recuperação judicial do produtor." },
] as const;

export type Titular = { id: string; nome: string };
export type OperacaoRef = { id: string; label: string };

export type ItemGerado = {
  chave: string;
  etapa: number;
  nivel: NivelItem;
  origem: OrigemItem;
  obrigatorio: boolean;
  nome_simples: string;
  documento: string;
  titular_cliente_id: string | null;
  titular_nome: string | null;
  operacao_id: string | null;
  operacao_label: string | null;
  ordem: number;
};

/** Expande o template nos itens concretos de uma família. */
export function gerarItens(
  respostas: RespostasOnboarding,
  titulares: Titular[],
  operacoes: OperacaoRef[],
  etapas: number[] = [1, 2, 3, 4, 5],
): ItemGerado[] {
  const out: ItemGerado[] = [];
  let ordem = 0;
  for (const tpl of ITENS_TEMPLATE) {
    if (!etapas.includes(tpl.etapa)) continue;
    const base = {
      chave: tpl.chave,
      etapa: tpl.etapa,
      nivel: tpl.nivel,
      origem: tpl.origem,
      obrigatorio: tpl.obrigatorio !== false,
      nome_simples: tpl.simples,
      documento: tpl.tecnico,
    };
    if (tpl.nivel === "pessoa") {
      for (const t of titulares) {
        const p = respostas.pessoas?.[t.id] || PESSOA_PADRAO;
        if (tpl.cond && !tpl.cond(respostas, p)) continue;
        out.push({ ...base, titular_cliente_id: t.id, titular_nome: t.nome, operacao_id: null, operacao_label: null, ordem: ordem++ });
      }
    } else if (tpl.nivel === "operacao") {
      if (tpl.cond && !tpl.cond(respostas)) continue;
      for (const o of operacoes) {
        out.push({ ...base, titular_cliente_id: null, titular_nome: null, operacao_id: o.id, operacao_label: o.label, ordem: ordem++ });
      }
    } else {
      if (tpl.cond && !tpl.cond(respostas)) continue;
      out.push({ ...base, titular_cliente_id: null, titular_nome: null, operacao_id: null, operacao_label: null, ordem: ordem++ });
    }
  }
  return out;
}
