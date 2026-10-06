import { lerTudo } from "@/lib/lerTudo";
import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { normNome } from "@/lib/situacaoCliente";
import { garantiaPrioritaria } from "@/lib/garantias";
import { ROTULO_NUMERO_INVALIDO } from "@/lib/numeroOperacao";

export const MODALIDADES = [
  "Custeio",
  "Investimento",
  "Pronaf",
  "Pronamp",
  "Moderfrota",
  "CDC",
  "Consórcio",
  "Capital de giro",
  "Outro",
] as const;

export interface OperacaoCredito {
  id: string;
  cliente_id: string | null;
  banco: string;
  numero: string;
  modalidade: string;
  vence_em: string | null;
  saldo_devedor: number | null;
  responsavel: string | null;
  notificado_em: string | null;
  protocolo_ref: string | null;
  dispensar_alerta: boolean;
  dispensa_motivo: string | null;
  /** Etiqueta informativa da natureza do crédito (ex.: CDC, CCB pessoal). Não tira do radar. */
  natureza_credito?: string | null;
  created_at?: string;
  updated_at?: string;
  cliente_nome?: string | null;
  cliente_situacao?: string | null;
  grupo?: string | null;
  titular_nome?: string | null;
  titular_a_definir?: boolean;
  data_conferida?: boolean;
  status_conferencia?: StatusConferencia;
  /** Voltou de um arquivamento por duplicata: fica no radar, mas sem tarefa no ADVBOX até alguém confirmar. */
  restaurada_conferir?: boolean;
  origem_arquivo?: string | null;
  trecho?: string | null;
  laudo_status?: string | null;
  pronta_protocolar?: boolean;
  pronta_em?: string | null;
  /** Processo ou cobrança em andamento contra o cliente nesta operação. */
  execucao_ativa?: boolean;
  execucao_tipo?: string | null;
  /** Via de urgência: entrou com o vencimento em cima, sem contrato e sem tempo de laudo. */
  entrada_urgente?: boolean;
  urgencia_em?: string | null;
  protocolo_urgencia?: boolean;
  protocolo_faltava?: string[] | null;
  protocolo_por_cpf?: boolean | null;
  pendencia_completar?: boolean;
  pendencia_prazo?: string | null;
  decisao_vencida?: string | null;
  decisao_obs?: string | null;
  decisao_em?: string | null;
  /** Número veio com o CPF do titular na importação: precisa ser conferido na cédula. */
  numero_invalido?: boolean;
  numero_anterior?: string | null;
  /** De onde veio a linha: cadastro do radar ou a base de contratos já existente. */
  origem?: "operacao" | "contrato";
  /** Estratégia atual (só o Willian muda). */
  estrategia?: string | null;
  estrategia_em?: string | null;
  /** Operação marcada como "precisa de laudo". */
  precisa_laudo?: boolean;
  /** Tipos de garantia cadastrados nesta operação. */
  garantias_tipos?: string[];
  tem_avalista?: boolean;
  /** Situação do banco neste cliente. Só contratado entra no radar. */
  escopo?: EscopoBanco;
  /** Saiu do radar para a aba Histórico (vencida há mais de um ano, sem movimento). */
  historico_em?: string | null;
  historico_motivo?: string | null;
  /** Voltou do histórico por decisão de alguém: a regra automática não a leva de novo. */
  historico_manual?: boolean;
  /** Mesma operação cadastrada em outro cliente. */
  duplicata_de?: string | null;
  duplicata_status?: "suspeita" | "confirmada" | "descartada" | null;
  duplicata_motivo?: string | null;
  /** Protocolo feito depois do vencimento: cliente já inadimplente na data. */
  protocolo_atraso?: boolean;
  /** Processo do ADVBOX vinculado a esta operação. */
  advbox_lawsuits_id?: string | null;
  /** Conferência do processo judicial: "na_acao" | "fora_da_acao". */
  juizo_conferencia?: string | null;
  juizo_conferido_em?: string | null;
  juizo_obs?: string | null;
  /** Marcado à mão como ação judicial, com o número do processo. */
  juizo_manual?: boolean | null;
  juizo_processo_numero?: string | null;
  /** Número da operação conforme consta no pedido da ação. */
  juizo_operacao_na_inicial?: string | null;
}

/** Situação do banco na relação com o cliente. */
export type EscopoBanco = "contratado" | "fora_escopo" | "a_contratar";

export const LABEL_ESCOPO: Record<EscopoBanco, string> = {
  contratado: "Contratado",
  fora_escopo: "Conhecido, fora do contrato",
  a_contratar: "A contratar — proposta em aberto",
};

export type StatusConferencia = "radar" | "historico" | "sem_vencimento" | "a_digitar";

/** Contratos com data passada há mais de 90 dias saem do radar e viram histórico a conferir. */
export const DIAS_HISTORICO = 90;

export const MOTIVO_CONFERENCIA: Record<Exclude<StatusConferencia, "radar">, string> = {
  historico: "Venceu há mais de 90 dias — histórico",
  sem_vencimento: "Sem data de vencimento",
  a_digitar: "PDF escaneado — a digitar",
};

export const RADAR_REFRESH_EVENT = "radar:refresh";

export function notifyRadarChanged() {
  window.dispatchEvent(new CustomEvent(RADAR_REFRESH_EVENT));
}

export const ANO_MIN = 2015;
export const ANO_MAX = 2045;

/** Data plausível para uma operação de crédito (ano entre 2015 e 2045). */
export function dataPlausivel(vence_em?: string | null): boolean {
  if (!vence_em) return false;
  const ano = Number(vence_em.split("-")[0]);
  return Number.isFinite(ano) && ano >= ANO_MIN && ano <= ANO_MAX;
}

/** Dias restantes até o vencimento (negativo = já venceu). Sem data = Infinity. */
export function diasRestantes(vence_em: string | null | undefined): number {
  if (!vence_em) return Number.POSITIVE_INFINITY;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = vence_em.split("-").map(Number);
  const alvo = new Date(y, (m || 1) - 1, d || 1);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

const SELECT = "id, cliente_id, banco, numero, numero_invalido, numero_anterior, restaurada_conferir, modalidade, vence_em, saldo_devedor, responsavel, notificado_em, protocolo_ref, protocolo_atraso, dispensar_alerta, dispensa_motivo, natureza_credito, grupo, titular_nome, titular_a_definir, data_conferida, status_conferencia, origem_arquivo, trecho, laudo_status, pronta_protocolar, pronta_em, execucao_ativa, execucao_tipo, entrada_urgente, urgencia_em, protocolo_urgencia, protocolo_faltava, protocolo_por_cpf, pendencia_completar, pendencia_prazo, decisao_vencida, decisao_obs, decisao_em, estrategia, estrategia_em, precisa_laudo, advbox_lawsuits_id, historico_em, historico_motivo, historico_manual, duplicata_de, duplicata_status, duplicata_motivo, juizo_conferencia, juizo_conferido_em, juizo_obs, juizo_manual, juizo_processo_numero, juizo_operacao_na_inicial, created_at, updated_at, clientes(nome, situacao)";

function mapRow(row: any): OperacaoCredito {
  return {
    ...row,
    banco: row.banco || "—",
    numero: row.numero_invalido ? ROTULO_NUMERO_INVALIDO : row.numero || "—",
    modalidade: row.modalidade || "—",
    status_conferencia: (row.status_conferencia || "radar") as StatusConferencia,
    cliente_nome: row.clientes?.nome ?? null,
    cliente_situacao: row.clientes?.situacao ?? "ativo",
  };
}

function mapContrato(row: any): OperacaoCredito {
  return {
    id: row.id,
    cliente_id: null,
    banco: row.banco || "—",
    numero: row.numero_contrato || "—",
    modalidade: "Contrato (parcela)",
    vence_em: row.vencimento_proxima_parcela,
    saldo_devedor: row.valor_total_operacao ?? row.valor_parcela ?? null,
    responsavel: row.responsavel_gestao ?? null,
    notificado_em: row.data_notificacao ?? null,
    protocolo_ref: row.canal_notificacao ?? null,
    dispensar_alerta: !!row.resolvido,
    dispensa_motivo: row.motivo_resolucao ?? null,
    cliente_nome: row.nome_cliente ?? null,
    data_conferida: true,
    laudo_status: "nao_avaliado",
    pronta_protocolar: false,
    status_conferencia:
      row.vencimento_proxima_parcela && diasRestantes(row.vencimento_proxima_parcela) < -DIAS_HISTORICO
        ? "historico"
        : "radar",
    origem: "contrato",
  };
}

interface Options {
  /** Quando informado, carrega somente as operações desse cliente (inclusive protocoladas). */
  clienteId?: string | null;
  /** Radar: somente pendentes (sem protocolo e sem dispensa). */
  somentePendentes?: boolean;
  /** Inclui a base de contratos de vencimentos já existente (padrão: sim quando não é por cliente). */
  incluirContratos?: boolean;
}

/** Chave compartilhada do radar: todas as telas/cartões usam o mesmo cache. */
export const OPERACOES_KEY = "operacoes-credito";

const pendente = (o: OperacaoCredito) => !o.notificado_em && !o.dispensar_alerta;

/**
 * Carrega a base completa (todas as operações e, fora da ficha do cliente, os contratos).
 * Os recortes "somente pendentes" e "sem contratos" são aplicados em memória, com o mesmo
 * critério das consultas antigas, para que várias chamadas na mesma tela dividam uma leitura.
 */
async function carregarOperacoes(clienteId: string | null): Promise<OperacaoCredito[]> {
    const usarContratos = !clienteId;
    const montarOps = () => {
      let query: any = supabase.from("operacoes_credito").select(SELECT).is("deleted_at", null).order("vence_em", { ascending: true });
      if (clienteId) query = query.eq("cliente_id", clienteId);
      return query;
    };
    const montarContratos = () => {
      let q: any = supabase
        .from("contratos_vencimentos")
        .select("id, nome_cliente, banco, numero_contrato, vencimento_proxima_parcela, valor_parcela, valor_total_operacao, responsavel_gestao, data_notificacao, canal_notificacao, resolvido, motivo_resolucao")
        .is("deleted_at", null)
        .not("vencimento_proxima_parcela", "is", null);
      return q;
    };

    const [ops, contratos, clientesRes] = await Promise.all([
      lerTudo(montarOps),
      usarContratos ? lerTudo(montarContratos) : Promise.resolve({ data: [], error: null } as any),
      lerTudo(() => supabase.from("clientes").select("id, nome, situacao, grupo, responsavel_pos_venda").is("deleted_at", null)),
    ]);

    if (ops.error || contratos.error) toast.error("Erro ao carregar operações de crédito");

    const clientes = (((clientesRes as any)?.data as any[]) || []);

    // Nome de quem cuida do cliente (herdado pela operação).
    const userIds = Array.from(
      new Set(clientes.map((c) => c.responsavel_pos_venda).filter(Boolean)),
    ) as string[];
    const nomePorUser = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles_publico").select("id, nome").in("id", userIds);
      (profs || []).forEach((p: any) => nomePorUser.set(p.id, p.nome || ""));
    }
    const respDoCliente = (c: any) =>
      (c.responsavel_pos_venda && nomePorUser.get(c.responsavel_pos_venda)) || null;
    const respPorId = new Map<string, string | null>(clientes.map((c) => [c.id, respDoCliente(c)]));
    const respPorNome = new Map<string, string | null>();
    clientes.forEach((c) => {
      const k = normNome(c.nome || "");
      if (k && !respPorNome.get(k)) respPorNome.set(k, respDoCliente(c));
    });
    // Operação com "titular a definir" herda o responsável do grupo (todos do grupo têm o mesmo dono).
    const respPorGrupo = new Map<string, string | null>();
    clientes.forEach((c) => {
      const g = normNome(c.grupo || "");
      const r = respDoCliente(c);
      if (g && r && (c.situacao || "ativo") === "ativo" && !respPorGrupo.get(g)) respPorGrupo.set(g, r);
    });

    // Clientes fora da carteira (encerrado/rescindido/fora do escopo) saem do radar,
    // mas as operações continuam existindo na ficha deles.
    const nomesInativos = new Set(
      clientes.filter((c) => (c.situacao || "ativo") !== "ativo").map((c) => normNome(c.nome || "")).filter(Boolean),
    );

    // Escopo contratado por titular + banco. Sem registro, vale a regra antiga:
    // o banco conta como contratado (não some do radar por falta de marcação).
    const { data: escopoRows } = await supabase
      .from("cliente_banco_escopo")
      .select("cliente_id, banco, escopo");
    const idPorNome = new Map<string, string>();
    clientes.forEach((c) => {
      const k = normNome(c.nome || "");
      if (k && !idPorNome.has(k)) idPorNome.set(k, c.id);
    });
    const escopoPorChave = new Map<string, EscopoBanco>();
    ((escopoRows as any[]) || []).forEach((e) => {
      escopoPorChave.set(`${e.cliente_id}|${normNome(e.banco || "")}`, e.escopo as EscopoBanco);
    });
    const escopoDe = (o: OperacaoCredito): EscopoBanco => {
      const cid = o.cliente_id || idPorNome.get(normNome(o.cliente_nome || "")) || "";
      return escopoPorChave.get(`${cid}|${normNome(o.banco || "")}`) ?? "contratado";
    };


    const lista = [
      ...((ops.data as any[]) || []).map(mapRow),
      ...((contratos.data as any[]) || []).map(mapContrato),
    ]
      .map((o) => ({
        ...o,
        escopo: escopoDe(o),
        responsavel:
          (o.cliente_id ? respPorId.get(o.cliente_id) : null) ??
          respPorNome.get(normNome(o.cliente_nome || "")) ??
          respPorGrupo.get(normNome(o.grupo || "")) ??
          o.responsavel,
      }))
      .filter((o) => {
        if (clienteId) return true;
        // Só banco contratado entra no radar e gera tarefa.
        if (o.escopo !== "contratado") return false;
        if (o.cliente_situacao && o.cliente_situacao !== "ativo") return false;
        return !nomesInativos.has(normNome(o.cliente_nome || ""));
      })
      .sort((a, b) => (a.vence_em || "9999").localeCompare(b.vence_em || "9999"));

    // Garantias e avalistas das operações listadas (etiquetas e ordem de prioridade).
    const idsOps = lista.filter((o) => o.origem !== "contrato").map((o) => o.id);
    const tiposPorOp = new Map<string, string[]>();
    const comAval = new Set<string>();
    if (idsOps.length) {
      const [gar, ava] = await Promise.all([
        supabase.from("operacao_garantias").select("operacao_id, tipo").in("operacao_id", idsOps),
        supabase.from("operacao_avalistas").select("operacao_id").in("operacao_id", idsOps),
      ]);
      ((gar.data as any[]) || []).forEach((g) => {
        const arr = tiposPorOp.get(g.operacao_id) || [];
        arr.push(g.tipo);
        tiposPorOp.set(g.operacao_id, arr);
      });
      ((ava.data as any[]) || []).forEach((a) => comAval.add(a.operacao_id));
    }
    const comGarantias = lista
      .map((o) => ({
        ...o,
        garantias_tipos: tiposPorOp.get(o.id) || [],
        tem_avalista: comAval.has(o.id),
      }))
      // Mesma data de vencimento: garantia forte (AF, HIP, REC) aparece primeiro.
      .sort((a, b) => {
        const d = (a.vence_em || "9999").localeCompare(b.vence_em || "9999");
        if (d !== 0) return d;
        const pa = garantiaPrioritaria(a.garantias_tipos) ? 0 : 1;
        const pb = garantiaPrioritaria(b.garantias_tipos) ? 0 : 1;
        return pa - pb;
      });

    return comGarantias;
}

export function useOperacoesCredito({ clienteId, somentePendentes, incluirContratos }: Options = {}) {
  const usarContratos = incluirContratos ?? !clienteId;
  const { user } = useAuth();
  const qc = useQueryClient();
  const chave = [OPERACOES_KEY, user?.id ?? null, clienteId ?? null];
  const { data, isLoading, refetch } = useQuery({
    queryKey: chave,
    queryFn: () => carregarOperacoes(clienteId ?? null),
    enabled: !!user,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  const operacoes = useMemo(() => {
    let l = data ?? [];
    if (!usarContratos) l = l.filter((o) => o.origem !== "contrato");
    if (somentePendentes) l = l.filter(pendente);
    return l;
  }, [data, usarContratos, somentePendentes]);
  const loading = !user || isLoading;

  const load = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: [OPERACOES_KEY] });
    window.addEventListener(RADAR_REFRESH_EVENT, handler);
    return () => window.removeEventListener(RADAR_REFRESH_EVENT, handler);
  }, [qc]);

  const {
    vencidas,
    ate30,
    entre31e60,
    proximas,
    listaVencidas,
    lista0a30,
    lista31a60,
    listaDataInvalida,
    listaAConferir,
    listaExecucao,
    listaUrgentes,
    listaPendenciaDoc,
  } = useMemo(() => {
      const todasAbertas = operacoes.filter((o) => !o.notificado_em && !o.dispensar_alerta);
      // Operação com processo ou cobrança ativa fica numa seção própria, no topo do radar.
      const emExecucao = todasAbertas.filter((o) => o.execucao_ativa);
      const abertas = todasAbertas.filter((o) => !o.execucao_ativa);
      const aConferir = abertas.filter((o) => (o.status_conferencia || "radar") !== "radar");
      const pendentes = abertas.filter((o) => (o.status_conferencia || "radar") === "radar");
      const invalidas = pendentes.filter((o) => !dataPlausivel(o.vence_em)).map((op) => ({ op, dias: NaN }));
      const comDias = pendentes
        .filter((o) => dataPlausivel(o.vence_em))
        .map((o) => ({ op: o, dias: diasRestantes(o.vence_em as string) }))
        .sort((a, b) => {
          if (a.dias !== b.dias) return a.dias - b.dias;
          // Mesmo dia: alienação fiduciária, hipoteca e recebíveis na frente.
          return (
            (garantiaPrioritaria(a.op.garantias_tipos) ? 0 : 1) -
            (garantiaPrioritaria(b.op.garantias_tipos) ? 0 : 1)
          );
        });

      const lVencidas = comDias.filter((x) => x.dias < 0);
      const l0a30 = comDias.filter((x) => x.dias >= 0 && x.dias <= 30);
      const l31a60 = comDias.filter((x) => x.dias > 30 && x.dias <= 60);

      return {
        vencidas: lVencidas.length,
        ate30: l0a30.length,
        entre31e60: l31a60.length,
        proximas: comDias,
        listaVencidas: lVencidas,
        lista0a30: l0a30,
        lista31a60: l31a60,
        listaDataInvalida: invalidas,
        listaAConferir: aConferir,
        listaExecucao: emExecucao,
        // Entradas urgentes ainda sem protocolo e pendências de documentação em aberto.
        listaUrgentes: todasAbertas
          .filter((o) => o.entrada_urgente)
          .sort((a, b) => (a.vence_em || "9999").localeCompare(b.vence_em || "9999")),
        listaPendenciaDoc: operacoes
          .filter((o) => o.pendencia_completar)
          .sort((a, b) => (a.pendencia_prazo || "9999").localeCompare(b.pendencia_prazo || "9999")),
      };
    }, [operacoes]);

  return {
    operacoes,
    loading,
    reload: load,
    vencidas,
    ate30,
    entre31e60,
    proximas,
    listaVencidas,
    lista0a30,
    lista31a60,
    listaDataInvalida,
    listaAConferir,
    listaExecucao,
    listaUrgentes,
    listaPendenciaDoc,
  };
}
