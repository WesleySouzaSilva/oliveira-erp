/**
 * Acompanhamento da notificação extrajudicial — unidade: TITULAR + BANCO.
 * O dono do acompanhamento é o responsável da CARTEIRA do cliente.
 */

export type EstadoNotificacao =
  | "em_preparo"
  | "protocolada"
  | "aguardando_resposta"
  | "respondida"
  | "decidida"
  | "encerrada";

export const ESTADOS: { value: EstadoNotificacao; label: string }[] = [
  { value: "em_preparo", label: "Em preparo" },
  { value: "protocolada", label: "Protocolada" },
  { value: "aguardando_resposta", label: "Aguardando resposta" },
  { value: "respondida", label: "Respondida" },
  { value: "decidida", label: "Decidida" },
  { value: "encerrada", label: "Encerrada" },
];

export const labelEstado = (v?: string | null) =>
  ESTADOS.find((e) => e.value === v)?.label ?? "Em preparo";

export const CANAIS: { value: string; label: string }[] = [
  { value: "consumidor_gov", label: "consumidor.gov" },
  { value: "email", label: "E-mail" },
  { value: "agencia", label: "Agência" },
  { value: "carta", label: "Carta" },
  { value: "outro", label: "Outro" },
];

export const labelCanal = (v?: string | null) =>
  CANAIS.find((c) => c.value === v)?.label ?? "—";

export const RESULTADOS: { value: string; label: string }[] = [
  { value: "deferida", label: "Deferida" },
  { value: "negada", label: "Negada" },
  { value: "evasiva", label: "Evasiva" },
  { value: "pediu_documento", label: "Pediu documento" },
];

export const labelResultado = (v?: string | null) =>
  RESULTADOS.find((r) => r.value === v)?.label ?? "—";

export const CANAIS_CONTATO: { value: string; label: string }[] = [
  { value: "telefone", label: "Telefone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "presencial", label: "Presencial" },
  { value: "email", label: "E-mail" },
  { value: "outro", label: "Outro" },
];

export interface PrazosConfig {
  prazo_consumidor_gov: number;
  prazo_outros_canais: number;
  dias_sem_resposta: number;
  dias_silencio: number;
  dias_contato_cliente: number;
}

export const PRAZOS_PADRAO: PrazosConfig = {
  prazo_consumidor_gov: 10,
  prazo_outros_canais: 7,
  dias_sem_resposta: 15,
  dias_silencio: 30,
  dias_contato_cliente: 30,
};

export interface NotificacaoBanco {
  id: string;
  cliente_id: string | null;
  titular_nome: string;
  banco: string;
  responsavel: string | null;
  estado: EstadoNotificacao;
  protocolo_data: string | null;
  protocolo_canal: string | null;
  protocolo_ref: string | null;
  cobranca_prazo: string | null;
  resposta_data: string | null;
  resposta_resultado: string | null;
  resposta_anexo: string | null;
  contador_desde: string | null;
  silencio_banco: boolean;
  ultimo_contato_cliente: string | null;
  decisao: string | null;
  decisao_motivo: string | null;
  decisao_em: string | null;
  observacao: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Complementação de um pedido já protocolado: o pedido é o mesmo, o evento é novo. */
export interface ComplementacaoNotificacao {
  id: string;
  notificacao_id: string;
  data: string;
  canal: string | null;
  referencia: string | null;
  arquivo: string | null;
  operacoes: string[];
  observacao: string | null;
  registrado_nome: string | null;
  created_at?: string;
}

export const formatDataBR = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export const somaDias = (iso: string, dias: number) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + dias);
  return dt.toISOString().slice(0, 10);
};

export const diasDesde = (iso?: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((hoje.getTime() - dt.getTime()) / 86_400_000);
};

/** Prazo da cobrança de retorno conforme o canal usado no protocolo. */
export const prazoCobranca = (canal: string | null, data: string, cfg: PrazosConfig) =>
  somaDias(data, canal === "consumidor_gov" ? cfg.prazo_consumidor_gov : cfg.prazo_outros_canais);

/** Resposta evasiva ou pedindo documento conta como resposta, mas reabre o contador. */
export const reabreContador = (resultado?: string | null) =>
  resultado === "evasiva" || resultado === "pediu_documento";

/** Dias parados: desde o último marco (contador, resposta ou protocolo). */
export const diasParados = (n: NotificacaoBanco) =>
  diasDesde(n.contador_desde || n.resposta_data || n.protocolo_data || n.created_at?.slice(0, 10)) ?? 0;

export interface RequisitoAjuizamento {
  label: string;
  ok: boolean;
  detalhe?: string;
}

export interface ProximoPasso {
  sugestao: string | null;
  motivo: string;
  faltando: string[];
  requisitos: RequisitoAjuizamento[];
  litisconsorcio: boolean;
}

export interface ContextoProximoPasso {
  /** Vencimento mais próximo das operações do titular naquele banco. */
  vencimentoMaisProximo: string | null;
  /** Vencimento em até 30 dias em qualquer operação daquele titular+banco. */
  venceEm30: boolean;
  laudoPerdaPronto: boolean;
  laudoCapacidadePronto: boolean;
  pedidoAnexado: boolean;
  comprovanteAnexado: boolean;
  /** Outros bancos do mesmo cliente já em situação de ajuizar. */
  outrosBancosProntos: number;
}

export const DECISOES: { value: string; label: string }[] = [
  { value: "acao_alongamento", label: "Ação direta de alongamento" },
  { value: "cautelar", label: "Cautelar antecedente" },
  { value: "cumprir_documento", label: "Cumprir o pedido de documento" },
  { value: "litisconsorcio", label: "Ação única em litisconsórcio" },
  { value: "aguardar", label: "Aguardar mais" },
  { value: "encerrar", label: "Encerrar o acompanhamento" },
];

export const labelDecisao = (v?: string | null) =>
  DECISOES.find((d) => d.value === v)?.label ?? "—";

/** Sugestão do próximo passo + semáforo dos requisitos. A decisão é sempre do Willian. */
export function proximoPasso(
  n: NotificacaoBanco,
  ctx: ContextoProximoPasso,
  cfg: PrazosConfig = PRAZOS_PADRAO,
): ProximoPasso {
  const parados = diasParados(n);
  const silencio = n.estado !== "respondida" && !!n.protocolo_data && parados >= cfg.dias_silencio;

  const protocoloAntes =
    !!n.protocolo_data && !!ctx.vencimentoMaisProximo
      ? n.protocolo_data <= ctx.vencimentoMaisProximo
      : false;

  const requisitos: RequisitoAjuizamento[] = [
    {
      label: "Pedido protocolado antes do vencimento",
      ok: protocoloAntes,
      detalhe: n.protocolo_data
        ? `protocolado em ${formatDataBR(n.protocolo_data)}${ctx.vencimentoMaisProximo ? ` · vencimento ${formatDataBR(ctx.vencimentoMaisProximo)}` : ""}`
        : "sem data de protocolo",
    },
    { label: "Laudo de perda pronto", ok: ctx.laudoPerdaPronto },
    { label: "Laudo de capacidade de pagamento pronto", ok: ctx.laudoCapacidadePronto },
    { label: "Cópia do pedido e comprovante de envio anexados", ok: ctx.pedidoAnexado && ctx.comprovanteAnexado },
    {
      label: "Resposta do banco anexada",
      ok: n.estado !== "respondida" || !!n.resposta_anexo,
      detalhe: n.estado !== "respondida" ? "não se aplica (sem resposta)" : undefined,
    },
  ];

  const faltando = requisitos.filter((r) => !r.ok).map((r) => r.label);

  let sugestao: string | null = null;
  let motivo = "";
  if (n.resposta_resultado === "negada") {
    sugestao = "acao_alongamento";
    motivo = "O banco negou expressamente: cabe ação direta de alongamento.";
  } else if (n.resposta_resultado === "evasiva") {
    sugestao = ctx.venceEm30 ? "acao_alongamento" : "cautelar";
    motivo = ctx.venceEm30
      ? "Resposta evasiva e operação vencendo em até 30 dias: ação direta."
      : "Resposta evasiva: cautelar para compelir resposta.";
  } else if (n.resposta_resultado === "pediu_documento") {
    sugestao = "cumprir_documento";
    motivo = "O banco pediu documento: cumprir e reiniciar o contador.";
  } else if (n.resposta_resultado === "deferida") {
    sugestao = "encerrar";
    motivo = "Pedido deferido: segue pela via administrativa.";
  } else if (silencio) {
    sugestao = "cautelar";
    motivo = `Silêncio do banco há ${parados} dias: cautelar antecedente para compelir resposta.`;
  }

  const litisconsorcio = ctx.outrosBancosProntos > 0 && sugestao !== null && sugestao !== "encerrar";
  if (litisconsorcio) {
    motivo += ` Este cliente tem mais ${ctx.outrosBancosProntos} banco(s) em situação de ajuizar: considere ação única em litisconsórcio.`;
  }

  return { sugestao, motivo, faltando, requisitos, litisconsorcio };
}

/** Mensagem pronta para mandar ao produtor. */
export function textoParaCliente(n: NotificacaoBanco): string {
  const nome = (n.titular_nome || "").split(" ")[0] || "";
  const abre = `Olá${nome ? `, ${nome}` : ""}! Atualização do seu pedido junto ao ${n.banco}:`;
  if (n.estado === "em_preparo")
    return `${abre}\nEstamos preparando o pedido de prorrogação para envio ao banco. Assim que protocolarmos, aviso você.`;
  if (n.estado === "protocolada" || n.estado === "aguardando_resposta") {
    const base = `${abre}\nO pedido foi protocolado em ${formatDataBR(n.protocolo_data)} por ${labelCanal(n.protocolo_canal)}${n.protocolo_ref ? ` (referência ${n.protocolo_ref})` : ""}.`;
    return `${base}\nPróximo passo: aguardamos a resposta do banco. Se não houver retorno, cobramos e, se necessário, entramos na Justiça para garantir seu direito.`;
  }
  if (n.estado === "respondida") {
    const res = labelResultado(n.resposta_resultado).toLowerCase();
    return `${abre}\nO banco respondeu em ${formatDataBR(n.resposta_data)}: resposta ${res}.\nPróximo passo: nossa equipe jurídica está avaliando a melhor medida e te aviso da decisão.`;
  }
  if (n.estado === "decidida")
    return `${abre}\nDefinimos o próximo passo: ${labelDecisao(n.decisao)}.\nVamos te manter informado a cada andamento.`;
  return `${abre}\nO acompanhamento deste pedido foi encerrado.${n.observacao ? ` ${n.observacao}` : ""}`;
}

/** Nome genérico não serve para abrir processo; aqui serve só para agrupar. */
export const chaveNotificacao = (titular: string, banco: string) =>
  `${titular.trim().toLowerCase()}|${banco.trim().toLowerCase()}`;
