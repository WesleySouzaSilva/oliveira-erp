/**
 * LIMPEZA DA FILA DE VENCIDAS.
 *
 * Cada operação vencida recebe a mesma classificação, e a fila aparece separada
 * por situação — nunca tudo junto.
 */

import { normTexto } from "@/lib/varredura";
import type { OperacaoCredito } from "@/hooks/useOperacoesCredito";

export type SituacaoVencida = "coberta" | "em_atraso" | "conferir_pasta" | "em_juizo" | "sem_prova";

export const LABEL_SITUACAO: Record<SituacaoVencida, string> = {
  coberta: "Coberta — protocolo até o vencimento",
  em_atraso: "Em atraso — protocolo depois do vencimento",
  conferir_pasta: "Conferir pasta — documento sem número",
  em_juizo: "Em juízo — a conferir",
  sem_prova: "Sem prova — decisão do Willian",
};

export const EXPLICA_SITUACAO: Record<SituacaoVencida, string> = {
  coberta: "Há pedido do mesmo titular e banco protocolado até a data do vencimento. Dar baixa tira do radar como protocolada em tempo.",
  em_atraso:
    "O pedido foi protocolado depois do vencimento: o cliente já estava inadimplente na data, e isso muda a estratégia (a MP 1.376 trava em inadimplência).",
  conferir_pasta: "Há documento de pedido na pasta do cliente, mas ninguém digitou o número do protocolo.",
  em_juizo:
    "Há ação judicial com este banco (número CNJ, tipo de ação judicial, registro na ficha do cliente ou marcação manual). Abrir processo no ADVBOX para lançar tarefa NÃO conta. A operação continua no placar até alguém confirmar que ela está no pedido da ação.",
  sem_prova: "Nenhuma evidência de pedido. A saída é decisão do Willian, operação por operação.",
};

/** Aviso fixo mostrado em toda operação que caiu em "em juízo". */
export const AVISO_EM_JUIZO =
  "há ação judicial com este banco — conferir se esta operação está no pedido da ação antes de protocolar pedido administrativo";

export const OBS_FORA_DA_ACAO =
  "Conferido: a operação NÃO está no pedido da ação. Pode caber aditamento da inicial, em vez de pedido novo.";

/** Marca de acompanhamento da operação protocolada fora do prazo. */
export const MARCA_EM_ATRASO = "protocolado após o vencimento — cliente já inadimplente na data";

/**
 * Idade, sozinha, NUNCA arquiva nada. Contrato vencido é caso a trabalhar.
 * "Vencida há mais de um ano" é só etiqueta de ordenação na fila.
 */
export const DIAS_ANTIGA = 365;

/** Saídas da fila de decisão (só o Willian decide). */
export const SAIDAS_SEM_PROVA = [
  { value: "cabe_pedido", label: "Ainda cabe pedido", ajuda: "Cria peticionamento urgente." },
  { value: "perdeu_prazo", label: "Perdeu o prazo — avaliar ação", ajuda: "Abre a régua de próximo passo." },
  { value: "nao_existe", label: "Operação não existe mais / quitada", ajuda: "Arquiva com motivo." },
] as const;

export interface ProtocoloConhecido {
  /** Data do protocolo (ISO). */
  data: string;
  referencia: string | null;
  origem: string;
}

export const chavePar = (titular: string, banco: string) => `${normTexto(titular)}|${normTexto(banco)}`;

export const titularDaOperacao = (o: OperacaoCredito) =>
  o.cliente_nome || o.titular_nome || o.grupo || "Titular a definir";

/** A operação já saiu do radar por histórico ou por ser duplicata confirmada. */
export const foraDoRadar = (o: OperacaoCredito) =>
  !!o.historico_em || o.duplicata_status === "confirmada";

/** Processo judicial já conhecido para o par cliente + banco. */
export interface ProcessoJuizo {
  /** Número do processo (CNJ) ou "a conferir". */
  numero: string | null;
  /** Tipo de ação: revisional, execução, busca e apreensão, consolidação… */
  tipo: string | null;
  /** Data de distribuição (ISO), quando conhecida. */
  distribuicao: string | null;
  /** De onde veio: ADVBOX, ficha do cliente ou marcação manual. */
  origem: string;
  advbox_lawsuits_id?: string | null;
  /** Registro veio da ficha do cliente (execução, busca e apreensão, consolidação). */
  daFicha?: boolean;
  /** Alguém marcou à mão, informando o número do processo. */
  manual?: boolean;
}

/**
 * Processo no ADVBOX existe para TODO par cliente + banco, só para lançar
 * tarefa. Por isso, só vale como ação judicial quando há número CNJ, tipo de
 * ação judicial, registro na ficha do cliente ou marcação manual.
 */
const RE_CNJ = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;

const TIPOS_JUDICIAIS = [
  "ALONGAMENTO",
  "EXECUCAO",
  "BUSCA E APREENS",
  "BUSCA_APREENS",
  "MONITORIA",
  "CAUTELAR",
  "EMBARGOS",
  "CONSOLIDACAO",
  "REVISIONAL",
  "ORDINARIA",
  "LIMINAR",
  "OBRIGACAO DE FAZER",
];

const TIPOS_ADMINISTRATIVOS = ["ADMINISTRATIV", "CONSUMIDOR", "NOTIFICACAO", "PEDIDO", "EXTRAJUDICIAL"];

export const temCnj = (numero?: string | null) => !!numero && RE_CNJ.test(numero.replace(/\s/g, ""));

export const tipoJudicial = (tipo?: string | null) => {
  if (!tipo) return false;
  const t = normTexto(tipo);
  if (TIPOS_ADMINISTRATIVOS.some((a) => t.includes(a))) return false;
  return TIPOS_JUDICIAIS.some((j) => t.includes(j));
};

export type MotivoJuizo = "cnj" | "tipo" | "ficha" | "manual";

/** Por que este processo conta como ação judicial — null quando não conta. */
export function motivoJuizo(p: ProcessoJuizo): MotivoJuizo | null {
  if (p.manual) return "manual";
  if (temCnj(p.numero)) return "cnj";
  if (tipoJudicial(p.tipo)) return "tipo";
  if (p.daFicha) return "ficha";
  return null;
}

export const ehProcessoJudicial = (p: ProcessoJuizo) => motivoJuizo(p) !== null;

export const LABEL_MOTIVO_JUIZO: Record<MotivoJuizo, string> = {
  cnj: "número CNJ no processo",
  tipo: "tipo de ação judicial",
  ficha: "registro na ficha do cliente",
  manual: "marcado à mão",
};

export interface ClassificacaoVencida {
  operacao: OperacaoCredito;
  situacao: SituacaoVencida;
  /** Protocolo do par usado na classificação (coberta / em atraso). */
  protocolo: ProtocoloConhecido | null;
  /** Documentos de pedido encontrados na pasta do cliente. */
  documentos: string[];
  /** Tudo que existe para o par cliente + banco, inclusive cadastro administrativo. */
  processos: ProcessoJuizo[];
  /** Só o que conta como ação judicial pelo critério novo. */
  judiciais: ProcessoJuizo[];
  /** Por que entrou em "em juízo" — null quando não entrou. */
  motivoJuizo: MotivoJuizo | null;
  diasVencida: number;
}

export interface EntradaClassificacao {
  /** Protocolos por par titular + banco. */
  protocolos: Map<string, ProtocoloConhecido[]>;
  /** Documentos de pedido por cliente (nome normalizado ou id). */
  documentos: Map<string, string[]>;
  /** Processos por par titular + banco e, quando for da ficha, por cliente. */
  processos: Map<string, ProcessoJuizo[]>;
  hoje: string;
}

const diffDias = (de: string, ate: string) =>
  Math.round((new Date(`${ate}T00:00:00`).getTime() - new Date(`${de}T00:00:00`).getTime()) / 86_400_000);

export function classificarVencida(o: OperacaoCredito, ctx: EntradaClassificacao): ClassificacaoVencida {
  const venc = o.vence_em as string;
  const doPar = ctx.protocolos.get(chavePar(titularDaOperacao(o), o.banco)) ?? [];
  const ateVencimento = doPar.filter((p) => p.data <= venc).sort((a, b) => b.data.localeCompare(a.data))[0];
  const posterior = doPar.filter((p) => p.data > venc).sort((a, b) => a.data.localeCompare(b.data))[0];
  const docs =
    (o.cliente_id && ctx.documentos.get(o.cliente_id)) ||
    ctx.documentos.get(normTexto(titularDaOperacao(o))) ||
    [];

  // Processos: do par titular + banco (ADVBOX) e da ficha do cliente
  // (execução, busca e apreensão, consolidação de imóvel).
  const procs = [
    ...(ctx.processos.get(chavePar(titularDaOperacao(o), o.banco)) ?? []),
    ...((o.cliente_id && ctx.processos.get(o.cliente_id)) ?? []),
  ];

  // Marcação manual do próprio registro da operação.
  if (o.juizo_manual && o.juizo_processo_numero)
    procs.push({
      numero: o.juizo_processo_numero,
      tipo: "Ação informada à mão",
      distribuicao: null,
      origem: "marcado à mão",
      manual: true,
    });

  // Só conta como ação judicial o que passa no critério (CNJ, tipo judicial,
  // ficha do cliente ou marcação manual). Cadastro administrativo do ADVBOX não.
  const judiciais = procs.filter(ehProcessoJudicial);
  const ordem: MotivoJuizo[] = ["cnj", "tipo", "ficha", "manual"];
  const motivo =
    ordem.find((m) => judiciais.some((p) => motivoJuizo(p) === m)) ?? null;

  // Quem já conferiu e disse que a operação NÃO está na ação volta para a decisão.
  const conferidaFora = o.juizo_conferencia === "fora_da_acao";

  const situacao: SituacaoVencida = ateVencimento
    ? "coberta"
    : posterior
      ? "em_atraso"
      : docs.length > 0
        ? "conferir_pasta"
        : judiciais.length > 0 && !conferidaFora
          ? "em_juizo"
          : "sem_prova";

  return {
    operacao: o,
    situacao,
    protocolo: ateVencimento ?? posterior ?? null,
    documentos: docs,
    processos: procs,
    judiciais,
    motivoJuizo: situacao === "em_juizo" ? motivo : null,
    diasVencida: diffDias(venc, ctx.hoje),
  };
}

/**
 * Parcelas da mesma operação: linhas do mesmo cliente e banco com o mesmo
 * número (normalizado). Sem número, cada linha é ela mesma — "sem número"
 * nunca conta como igual.
 */
export interface ParcelasDaOperacao {
  /** Vencimento da última parcela conhecida. */
  vencimentoFinal: string;
  /** Existe parcela com vencimento no futuro. */
  temParcelaFutura: boolean;
}

const chaveParcela = (o: OperacaoCredito) => {
  const num = numeroNormalizado(o.numero);
  if (!num) return `id|${o.id}`;
  return `${normTexto(titularDaOperacao(o))}|${normTexto(o.banco || "")}|${num}`;
};

/** Mapa id da operação → vencimento final e se há parcela futura. */
export function mapaParcelas(ops: OperacaoCredito[], hoje: string): Map<string, ParcelasDaOperacao> {
  const grupos = new Map<string, OperacaoCredito[]>();
  ops.forEach((o) => {
    const k = chaveParcela(o);
    grupos.set(k, [...(grupos.get(k) ?? []), o]);
  });
  const saida = new Map<string, ParcelasDaOperacao>();
  grupos.forEach((lista) => {
    const datas = lista.map((o) => o.vence_em).filter((d): d is string => !!d);
    const final = datas.sort().slice(-1)[0] ?? "";
    const futura = datas.some((d) => d >= hoje);
    lista.forEach((o) => saida.set(o.id, { vencimentoFinal: final || (o.vence_em as string), temParcelaFutura: futura }));
  });
  return saida;
}

/**
 * Etiqueta de ordenação: vencida há mais de um ano. NÃO arquiva, NÃO tira do
 * radar — só ajuda a colocar as mais antigas no topo da fila.
 */
export const ehAntiga = (c: ClassificacaoVencida) => c.diasVencida > DIAS_ANTIGA;



/** Nome de arquivo que indica pedido administrativo sem número digitado. */
const PISTAS_DOC = ["PEDIDO", "RECLAMACAO", "PROTOCOLO", "ADMINISTRATIV", "CONSUMIDOR", "NOTIFICACAO"];
export const arquivoDePedido = (nome: string) => {
  const n = normTexto(nome);
  return PISTAS_DOC.some((p) => n.includes(p));
};

/** Número que não identifica nada: em branco, traço ou "sem número". */
const numeroVazio = (n?: string | null) => {
  if (!n) return true;
  const t = normTexto(n);
  return t === "" || t === "-" || t.includes("SEM NUMERO");
};
/** Só os dígitos do número, para comparar grafias diferentes do mesmo contrato. */
export const numeroNormalizado = (n?: string | null) =>
  numeroVazio(n) ? "" : (n as string).replace(/\D/g, "") || normTexto(n as string);
/** Nome do arquivo de origem, sem o caminho. */
export const arquivoOrigem = (o: OperacaoCredito) =>
  (o.origem_arquivo || "").replace(/^.*[\\/]/, "").trim();

/**
 * Duplicata só quando o número (normalizado) é igual ou quando é o MESMO arquivo
 * de origem gravado duas vezes. "Sem número" e "sem vencimento" nunca contam como
 * iguais, e vencimento igual sozinho não basta. Na dúvida fica ativa, como
 * "possível duplicata - conferir".
 */
export function acharDuplicatas(ops: OperacaoCredito[]): OperacaoCredito[][] {
  const porChave = new Map<string, OperacaoCredito[]>();
  const add = (k: string, o: OperacaoCredito) => porChave.set(k, [...(porChave.get(k) ?? []), o]);
  ops.forEach((o) => {
    const num = numeroNormalizado(o.numero);
    if (num) return add(`num|${num}`, o);
    const arq = arquivoOrigem(o);
    if (arq) add(`arq|${normTexto(arq)}`, o);
  });
  const vistos = new Set<string>();
  const grupos: OperacaoCredito[][] = [];
  porChave.forEach((lista) => {
    if (lista.length < 2) return;
    const chave = lista
      .map((o) => o.id)
      .sort()
      .join("|");
    if (vistos.has(chave)) return;
    vistos.add(chave);
    grupos.push(lista);
  });
  return grupos;
}

