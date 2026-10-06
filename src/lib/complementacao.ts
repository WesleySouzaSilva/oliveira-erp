/**
 * COMPLEMENTAÇÃO do pedido administrativo.
 *
 * Quando entra operação nova num titular + banco que já tem pedido protocolado,
 * a saída não é um pedido novo: é a complementação daquele mesmo pedido.
 */

import { formatDataBR, diasDesde, type NotificacaoBanco } from "@/lib/notificacoesBanco";
import { somaDiasUteis, diaUtilAnterior, proximoDiaUtil, type Calendario } from "@/lib/diasUteis";
import type { OperacaoCredito } from "@/hooks/useOperacoesCredito";

/** Resposta registrada há mais de 90 dias reabre a via do pedido novo. */
export const DIAS_RESPOSTA_VELHA = 90;

/** A partir deste peso sobre a dívida do banco, o laudo precisa ser retificado antes. */
export const PESO_TRAVA_LAUDO = 0.1;

export const CANAIS_COMPLEMENTACAO: { value: string; label: string; exigeProtocolo?: boolean }[] = [
  { value: "consumidor_gov_mesma", label: "Mesma reclamação Consumidor.gov" },
  { value: "consumidor_gov_nova", label: "Nova reclamação Consumidor.gov", exigeProtocolo: true },
  { value: "email_mesmo_fio", label: "E-mail (mesmo fio)" },
  { value: "agencia", label: "Protocolo na agência" },
];

export const labelCanalComplementacao = (v?: string | null) =>
  CANAIS_COMPLEMENTACAO.find((c) => c.value === v)?.label ?? "—";

export const exigeNovoProtocolo = (canal?: string | null) =>
  !!CANAIS_COMPLEMENTACAO.find((c) => c.value === canal)?.exigeProtocolo;

/** Banco genérico não identifica a instituição: não vale para complementar. */
const BANCOS_GENERICOS = ["cresol", "sicredi", "sicoob", "unicred", "cresol baser", "sistema cresol"];
export const bancoGenerico = (banco?: string | null) =>
  BANCOS_GENERICOS.includes((banco || "").trim().toLowerCase().replace(/\s+/g, " "));

/**
 * O caminho é complementação quando há protocolo vivo no mesmo titular + banco
 * (instituição singular) e a resposta, se houver, é recente.
 */
export function cabeComplementacao(
  ficha: NotificacaoBanco | null,
  banco: string,
  ultimaComplementacao?: string | null,
): boolean {
  if (!ficha?.protocolo_data) return false;
  if (ficha.estado === "encerrada") return false;
  if (bancoGenerico(banco)) return false;
  // Conta do último evento do pedido: resposta do banco ou complementação.
  const eventos = [ficha.resposta_data, ultimaComplementacao].filter(Boolean) as string[];
  const ultimo = eventos.sort().pop() ?? null;
  const d = diasDesde(ultimo);
  if (d != null && d > DIAS_RESPOSTA_VELHA) return false;
  return true;
}

/** Operação já coberta por algum protocolo não volta para a lista de seleção. */
export const operacaoCoberta = (o: OperacaoCredito, cobertasNoHistorico: Set<string>) =>
  !!o.notificado_em || !!o.protocolo_ref || cobertasNoHistorico.has(o.numero) || cobertasNoHistorico.has(o.id);

export interface PrazosComplementacao {
  /** Prazo da tarefa: vencimento − 3 dias úteis (ou hoje + 2 dias úteis, se vencida). */
  prazoTarefa: string;
  /** Prazo fatal: o próprio vencimento (ou hoje + 2 dias úteis, se vencida). */
  prazoFatal: string;
  vencida: boolean;
}

export function prazosComplementacao(
  vencimento: string | null,
  hoje: string,
  cal: Calendario,
): PrazosComplementacao {
  const vencida = !vencimento || vencimento < hoje;
  if (vencida) {
    const d = somaDiasUteis(hoje, 2, cal);
    return { prazoTarefa: d, prazoFatal: d, vencida: true };
  }
  return {
    prazoTarefa: somaDiasUteis(vencimento, -3, cal),
    prazoFatal: diaUtilAnterior(vencimento, cal),
    vencida: false,
  };
}

/** Prazo da retificação do laudo: 5 dias úteis antes da complementação. */
export const prazoRetificacaoLaudo = (prazoComplementacao: string, hoje: string, cal: Calendario) => {
  const d = somaDiasUteis(prazoComplementacao, -5, cal);
  return d <= hoje ? proximoDiaUtil(hoje, cal) : d;
};

/** Peso das operações novas sobre o saldo total do titular naquele banco. */
export function pesoNoBanco(novas: OperacaoCredito[], todasDoBanco: OperacaoCredito[]): number {
  const soma = (l: OperacaoCredito[]) => l.reduce((s, o) => s + (Number(o.saldo_devedor) || 0), 0);
  const total = soma(todasDoBanco);
  if (!total) return 0;
  return soma(novas) / total;
}

export const percentBR = (p: number) => `${(p * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const moedaBR = (v?: number | null) =>
  v == null ? "não informado" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

/** Quem PROTOCOLA: carteira da Fernanda e da Vitória → Vitória; demais → Willian. */
export function quemProtocola(responsavelCarteira?: string | null): string {
  const r = (responsavelCarteira || "").toLowerCase();
  return r.includes("vit") || r.includes("fernanda") ? "Vitória" : "Willian";
}

/** Quem MAPEIA (participante): carteira da Fernanda e da Vitória → Fernanda; demais → Maycon. */
export function quemMapeia(responsavelCarteira?: string | null): string {
  const r = (responsavelCarteira || "").toLowerCase();
  return r.includes("vit") || r.includes("fernanda") ? "Fernanda" : "Maycon";
}

export interface DadosTexto {
  titular: string;
  banco: string;
  protocoloData: string | null;
  protocoloRef: string | null;
  protocoloCanal: string | null;
  operacoes: OperacaoCredito[];
  /** Vencimento proposto por operação (prorrogação pedida). */
  vencimentoProposto: Record<string, string>;
}

/** Texto pronto para copiar — só texto, sem arquivo. */
export function textoComplementacao(d: DadosTexto): string {
  const linhas = d.operacoes.map((o) => {
    const prop = d.vencimentoProposto[o.id];
    return [
      `• Operação ${o.numero || "número a conferir"}`,
      `natureza: ${o.modalidade || "não informada"}`,
      `saldo: ${moedaBR(o.saldo_devedor)}`,
      `vencimento atual: ${formatDataBR(o.vence_em)}`,
      `vencimento proposto: ${prop ? formatDataBR(prop) : "a definir conforme laudo de capacidade"}`,
    ].join(" — ");
  });

  return [
    `À ${d.banco}`,
    "",
    `Ref.: Complementação do pedido administrativo de alongamento de dívida rural — ${d.titular}` +
      (d.protocoloRef ? ` — protocolo ${d.protocoloRef}` : "") +
      (d.protocoloData ? ` (protocolado em ${formatDataBR(d.protocoloData)})` : " (data do original a confirmar)"),
    "",
    `Na qualidade de procuradores de ${d.titular}, e em complementação ao pedido administrativo já protocolado` +
      `${d.protocoloRef ? ` sob a referência ${d.protocoloRef}` : ""}, informamos a existência das operações abaixo,` +
      " junto a essa mesma instituição, que integram o mesmo pedido de prorrogação:",
    "",
    ...linhas,
    "",
    "Requer-se, com fundamento no Manual de Crédito Rural (item 2.6.9) e na frustração de receita comprovada" +
      " no laudo técnico já apresentado, a PRORROGAÇÃO das operações acima, com a suspensão da exigibilidade" +
      " dos respectivos vencimentos enquanto pendente a análise, mantendo-se o mesmo protocolo de origem.",
    "",
    "Aguardamos resposta formal no prazo regulamentar.",
  ].join("\n");
}
