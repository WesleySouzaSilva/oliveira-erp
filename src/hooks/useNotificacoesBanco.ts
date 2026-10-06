import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  diasParados,
  hojeISO,
  prazoCobranca,
  PRAZOS_PADRAO,
  type NotificacaoBanco,
  type PrazosConfig,
  type ContextoProximoPasso,
  type ComplementacaoNotificacao,
} from "@/lib/notificacoesBanco";
import { useOperacoesCredito, diasRestantes, dataPlausivel, type OperacaoCredito } from "@/hooks/useOperacoesCredito";

export interface ItemNotificacao {
  /** null quando a ficha ainda não existe no banco (estado "em preparo" derivado das operações). */
  id: string | null;
  cliente_id: string | null;
  titular_nome: string;
  banco: string;
  responsavel: string | null;
  ficha: NotificacaoBanco | null;
  estado: NotificacaoBanco["estado"];
  operacoes: OperacaoCredito[];
  vencimentoMaisProximo: string | null;
  venceEm30: boolean;
  dias_parados: number;
  ultimo_contato: string | null;
  contatos: number;
  /** Pedido original + complementações, em ordem. */
  complementacoes: ComplementacaoNotificacao[];
}

const titularDe = (o: OperacaoCredito) =>
  o.cliente_nome || o.titular_nome || o.grupo || "Titular a definir";

export function useNotificacoesBanco() {
  const { user } = useAuth();
  const { operacoes, loading: loadingOps, reload: reloadOps } = useOperacoesCredito();
  const [fichas, setFichas] = useState<NotificacaoBanco[]>([]);
  const [contatos, setContatos] = useState<{ notificacao_id: string; data: string }[]>([]);
  const [complementacoes, setComplementacoes] = useState<ComplementacaoNotificacao[]>([]);
  const [config, setConfig] = useState<PrazosConfig>(PRAZOS_PADRAO);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [f, c, cfg, comp] = await Promise.all([
      supabase.from("notificacoes_banco").select("*").order("updated_at", { ascending: false }),
      supabase.from("notificacao_contatos").select("notificacao_id, data").order("data", { ascending: false }),
      supabase.from("notificacao_config").select("*").maybeSingle(),
      supabase.from("notificacao_complementacoes").select("*").order("data", { ascending: true }),
    ]);
    if (f.error) toast.error("Erro ao carregar as notificações");
    setFichas(((f.data as any[]) || []) as NotificacaoBanco[]);
    setContatos(((c.data as any[]) || []) as any);
    setComplementacoes(((comp.data as any[]) || []) as ComplementacaoNotificacao[]);
    if (cfg.data) setConfig(cfg.data as any as PrazosConfig);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const itens = useMemo<ItemNotificacao[]>(() => {
    const chave = (t: string, b: string) => `${t.trim().toLowerCase()}|${b.trim().toLowerCase()}`;
    const porChave = new Map<string, ItemNotificacao>();

    // Grupos titular + banco a partir das operações ativas.
    operacoes
      // Banco ainda não identificado não vira ficha: primeiro o mapeamento digita a cédula.
      .filter((o) => !o.dispensar_alerta && !!o.banco && o.banco !== "—")
      .forEach((o) => {
        const titular = titularDe(o);
        const k = chave(titular, o.banco);
        const item =
          porChave.get(k) ||
          ({
            id: null,
            cliente_id: o.cliente_id,
            titular_nome: titular,
            banco: o.banco,
            responsavel: o.responsavel,
            ficha: null,
            estado: "em_preparo",
            operacoes: [],
            vencimentoMaisProximo: null,
            venceEm30: false,
            dias_parados: 0,
            ultimo_contato: null,
            contatos: 0,
            complementacoes: [],
          } as ItemNotificacao);
        item.operacoes.push(o);
        if (!item.cliente_id && o.cliente_id) item.cliente_id = o.cliente_id;
        if (!item.responsavel && o.responsavel) item.responsavel = o.responsavel;
        porChave.set(k, item);
      });

    // Fichas já gravadas (inclusive de operações que saíram do radar).
    fichas.forEach((f) => {
      const k = chave(f.titular_nome, f.banco);
      const item = porChave.get(k);
      if (item) {
        item.id = f.id;
        item.ficha = f;
        item.estado = f.estado;
        item.responsavel = f.responsavel || item.responsavel;
        item.cliente_id = f.cliente_id || item.cliente_id;
      } else {
        porChave.set(k, {
          id: f.id,
          cliente_id: f.cliente_id,
          titular_nome: f.titular_nome,
          banco: f.banco,
          responsavel: f.responsavel,
          ficha: f,
          estado: f.estado,
          operacoes: [],
          vencimentoMaisProximo: null,
          venceEm30: false,
          dias_parados: 0,
          ultimo_contato: null,
          contatos: 0,
          complementacoes: [],
        });
      }
    });

    const ultimoPorFicha = new Map<string, string>();
    const totalPorFicha = new Map<string, number>();
    contatos.forEach((c) => {
      if (!ultimoPorFicha.has(c.notificacao_id)) ultimoPorFicha.set(c.notificacao_id, c.data);
      totalPorFicha.set(c.notificacao_id, (totalPorFicha.get(c.notificacao_id) || 0) + 1);
    });

    const complPorFicha = new Map<string, ComplementacaoNotificacao[]>();
    complementacoes.forEach((c) => {
      complPorFicha.set(c.notificacao_id, [...(complPorFicha.get(c.notificacao_id) ?? []), c]);
    });


    return Array.from(porChave.values())
      .map((i) => {
        const datas = i.operacoes
          .map((o) => o.vence_em)
          .filter((d): d is string => !!d && dataPlausivel(d))
          .sort();
        const venc = datas[0] ?? null;
        return {
          ...i,
          vencimentoMaisProximo: venc,
          venceEm30: datas.some((d) => {
            const r = diasRestantes(d);
            return r >= 0 && r <= 30;
          }),
          dias_parados: i.ficha ? diasParados(i.ficha) : 0,
          ultimo_contato: (i.id && ultimoPorFicha.get(i.id)) || i.ficha?.ultimo_contato_cliente || null,
          contatos: (i.id && totalPorFicha.get(i.id)) || 0,
          complementacoes: (i.id && complPorFicha.get(i.id)) || [],
        };
      })
      .sort(
        (a, b) =>
          (b.dias_parados || 0) - (a.dias_parados || 0) ||
          a.titular_nome.localeCompare(b.titular_nome),
      );
  }, [operacoes, fichas, contatos, complementacoes]);

  /** Garante a ficha no banco (cria em preparo quando ainda não existe). */
  const garantirFicha = useCallback(
    async (item: ItemNotificacao): Promise<string | null> => {
      if (item.id) return item.id;
      const { data, error } = await supabase
        .from("notificacoes_banco")
        .insert({
          cliente_id: item.cliente_id,
          titular_nome: item.titular_nome,
          banco: item.banco,
          responsavel: item.responsavel,
          estado: "em_preparo",
          created_by: user?.id ?? null,
        } as any)
        .select("id")
        .single();
      if (error) {
        toast.error("Não foi possível abrir a ficha da notificação");
        return null;
      }
      return data.id as string;
    },
    [user],
  );

  const pendencia = useCallback(async (titulo: string, descricao: string) => {
    await supabase.from("advbox_pendencias").insert({ tipo: "notificacao", titulo, descricao, status: "pendente" } as any);
  }, []);

  /** Registra o protocolo: exige data, canal e referência. */
  const registrarProtocolo = useCallback(
    async (
      item: ItemNotificacao,
      dados: { data: string; canal: string; referencia: string },
    ) => {
      const id = await garantirFicha(item);
      if (!id) return false;
      const cobranca = prazoCobranca(dados.canal, dados.data, config);
      const { error } = await supabase
        .from("notificacoes_banco")
        .update({
          estado: "protocolada",
          protocolo_data: dados.data,
          protocolo_canal: dados.canal,
          protocolo_ref: dados.referencia,
          cobranca_prazo: cobranca,
          contador_desde: dados.data,
          silencio_banco: false,
          resposta_data: null,
          resposta_resultado: null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) {
        toast.error("Erro ao registrar o protocolo");
        return false;
      }
      // Protocolo tira a operação do radar.
      const idsOps = item.operacoes.filter((o) => o.origem !== "contrato").map((o) => o.id);
      if (idsOps.length)
        await supabase
          .from("operacoes_credito")
          .update({ notificado_em: dados.data, protocolo_ref: dados.referencia } as any)
          .in("id", idsOps);
      await pendencia(
        "Avisar o cliente do protocolo",
        `${item.titular_nome} — ${item.banco}: protocolado em ${dados.data}. Responsável da carteira: ${item.responsavel || "a definir"}.`,
      );
      toast.success("Protocolo registrado — a cobrança de retorno entra em " + cobranca);
      await Promise.all([load(), reloadOps()]);
      return true;
    },
    [config, garantirFicha, load, pendencia, reloadOps],
  );

  /**
   * Registra uma COMPLEMENTAÇÃO do pedido já protocolado: a notificação continua
   * a mesma e ganha um evento próprio, com data, canal e referência.
   */
  const registrarComplementacao = useCallback(
    async (
      item: ItemNotificacao,
      dados: {
        data: string;
        canal: string;
        referencia: string;
        arquivo?: string | null;
        operacoes: string[];
        observacao?: string | null;
        nome?: string | null;
        novo_protocolo?: string | null;
        prazo_tarefa?: string | null;
        prazo_fatal?: string | null;
        responsavel_protocolo?: string | null;
        participante?: string | null;
      },
    ) => {
      const id = await garantirFicha(item);
      if (!id) return false;
      const { error } = await supabase.from("notificacao_complementacoes").insert({
        notificacao_id: id,
        data: dados.data,
        canal: dados.canal,
        referencia: dados.referencia,
        arquivo: dados.arquivo || null,
        operacoes: dados.operacoes,
        observacao:
          [dados.observacao, dados.novo_protocolo ? `Nova reclamação: ${dados.novo_protocolo}` : null]
            .filter(Boolean)
            .join(" · ") || null,
        registrado_por: user?.id ?? null,
        registrado_nome: dados.nome || null,
      } as any);
      if (error) {
        toast.error("Erro ao registrar a complementação");
        return false;
      }
      // O contador de resposta do banco reinicia na data da complementação.
      const cobranca = prazoCobranca(dados.canal, dados.data, config);
      await supabase
        .from("notificacoes_banco")
        .update({
          estado: item.ficha?.estado === "respondida" ? "aguardando_resposta" : (item.ficha?.estado ?? "protocolada"),
          cobranca_prazo: cobranca,
          contador_desde: dados.data,
          silencio_banco: false,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      // As operações cobertas saem do radar de peticionamento.
      const cobertas = item.operacoes
        .filter((o) => dados.operacoes.includes(o.numero || "") || dados.operacoes.includes(o.id))
        .map((o) => o.id);
      if (cobertas.length)
        await supabase
          .from("operacoes_credito")
          .update({ notificado_em: dados.data, protocolo_ref: dados.referencia } as any)
          .in("id", cobertas);
      // Acompanhamento para quem protocola, com o SLA da complementação.
      await pendencia(
        `Acompanhar complementação — ${item.titular_nome} / ${item.banco}`,
        `Complementação protocolada em ${dados.data} (${dados.referencia}). ` +
          `Responsável pelo protocolo: ${dados.responsavel_protocolo || "a definir"}; ` +
          `participante (monta os dados): ${dados.participante || "a definir"}. ` +
          `Prazo da tarefa ${dados.prazo_tarefa || "—"} · prazo fatal ${dados.prazo_fatal || "—"}. ` +
          `Cobrar retorno do banco em ${cobranca}.`,
      );
      toast.success(`Complementação registrada — cobrança de retorno em ${cobranca}`);
      await Promise.all([load(), reloadOps()]);
      return true;
    },
    [config, garantirFicha, load, pendencia, reloadOps, user],
  );

  /** Trava do laudo: operação nova pesada demais pede retificação antes de complementar. */
  const pedirRetificacaoLaudo = useCallback(
    async (dados: { item: ItemNotificacao; peso: number; prazo: string; operacoes: string[] }) => {
      const pct = `${(dados.peso * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
      await pendencia(
        `Retificar laudo de capacidade — ${dados.item.titular_nome} / ${dados.item.banco}`,
        `Para o Lucas Zimmermann. Prazo ${dados.prazo}. Motivo: operação nova representa ${pct} da dívida no banco. ` +
          `Operações: ${dados.operacoes.join(", ")}. A complementação fica bloqueada até o laudo estar entregue.`,
      );
      toast.success("Tarefa de retificação do laudo criada para o Lucas");
      return true;
    },
    [pendencia],
  );



  /** Registra a resposta do banco: exige o resultado. */
  const registrarResposta = useCallback(
    async (
      item: ItemNotificacao,
      dados: { data: string; resultado: string; anexo?: string | null },
    ) => {
      const id = await garantirFicha(item);
      if (!id) return false;
      const reabre = dados.resultado === "evasiva" || dados.resultado === "pediu_documento";
      const { error } = await supabase
        .from("notificacoes_banco")
        .update({
          estado: "respondida",
          resposta_data: dados.data,
          resposta_resultado: dados.resultado,
          resposta_anexo: dados.anexo || null,
          contador_desde: reabre ? dados.data : dados.data,
          silencio_banco: false,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) {
        toast.error("Erro ao registrar a resposta");
        return false;
      }
      await pendencia(
        "Avisar o cliente da resposta",
        `${item.titular_nome} — ${item.banco}: resposta ${dados.resultado} em ${dados.data}.`,
      );
      toast.success(reabre ? "Resposta registrada — contador reiniciado" : "Resposta registrada");
      await load();
      return true;
    },
    [garantirFicha, load, pendencia],
  );

  const registrarContato = useCallback(
    async (item: ItemNotificacao, dados: { data: string; canal: string; resumo: string; nome: string }) => {
      const id = await garantirFicha(item);
      if (!id) return false;
      const { error } = await supabase.from("notificacao_contatos").insert({
        notificacao_id: id,
        data: dados.data,
        canal: dados.canal,
        resumo: dados.resumo,
        registrado_por: user?.id ?? null,
        registrado_nome: dados.nome,
      } as any);
      if (error) {
        toast.error("Erro ao registrar o contato");
        return false;
      }
      await supabase
        .from("notificacoes_banco")
        .update({ ultimo_contato_cliente: dados.data } as any)
        .eq("id", id);
      toast.success("Contato registrado");
      await load();
      return true;
    },
    [garantirFicha, load, user],
  );

  const registrarDecisao = useCallback(
    async (
      item: ItemNotificacao,
      dados: { decisao: string; motivo: string; sugestao: string | null; nome: string },
    ) => {
      const id = await garantirFicha(item);
      if (!id) return false;
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from("notificacoes_banco")
        .update({
          estado: dados.decisao === "encerrar" ? "encerrada" : "decidida",
          decisao: dados.decisao,
          decisao_motivo: dados.motivo,
          decisao_em: agora,
          decisao_por: user?.id ?? null,
          updated_at: agora,
        } as any)
        .eq("id", id);
      if (error) {
        toast.error("Erro ao gravar a decisão");
        return false;
      }
      await supabase.from("notificacao_decisoes").insert({
        notificacao_id: id,
        decisao: dados.decisao,
        motivo: dados.motivo,
        sugestao: dados.sugestao,
        decidido_por: user?.id ?? null,
        decidido_nome: dados.nome,
      } as any);
      if (dados.decisao === "acao_alongamento" || dados.decisao === "cautelar" || dados.decisao === "litisconsorcio") {
        await pendencia(
          "Protocolo judicial — ação de alongamento",
          `${item.titular_nome} — ${item.banco}: ${dados.decisao}. Abrir a etapa 4 do onboarding (checklist da ação) e mover a fase no ADVBOX para 2865138 (Elaborar Ação Judicial).`,
        );
      }
      toast.success("Decisão registrada");
      await load();
      return true;
    },
    [garantirFicha, load, pendencia, user],
  );

  const salvarConfig = useCallback(
    async (novo: PrazosConfig, organizacaoId: string) => {
      const { error } = await supabase
        .from("notificacao_config")
        .upsert({ organizacao_id: organizacaoId, ...novo, updated_at: new Date().toISOString() } as any);
      if (error) {
        toast.error("Só administradores podem mudar os prazos");
        return false;
      }
      setConfig(novo);
      toast.success("Prazos salvos");
      return true;
    },
    [],
  );

  /** Contexto usado pela sugestão do próximo passo. */
  const contextoDe = useCallback(
    (item: ItemNotificacao): ContextoProximoPasso => {
      const laudoPronto = item.operacoes.some((o) =>
        ["pronto", "laudo_completo_entregue"].includes(o.laudo_status || ""),
      );
      const notaPronta = item.operacoes.some((o) =>
        ["pronto", "laudo_completo_entregue", "nota_preliminar_entregue"].includes(o.laudo_status || ""),
      );
      const outros = itens.filter(
        (i) =>
          i !== item &&
          i.titular_nome === item.titular_nome &&
          (i.ficha?.resposta_resultado === "negada" || i.ficha?.silencio_banco || (i.dias_parados >= config.dias_silencio && !!i.ficha?.protocolo_data)),
      ).length;
      return {
        vencimentoMaisProximo: item.vencimentoMaisProximo,
        venceEm30: item.venceEm30,
        laudoPerdaPronto: laudoPronto,
        laudoCapacidadePronto: notaPronta,
        pedidoAnexado: !!item.ficha?.protocolo_ref,
        comprovanteAnexado: !!item.ficha?.protocolo_ref,
        outrosBancosProntos: outros,
      };
    },
    [itens, config],
  );

  return {
    itens,
    config,
    loading: loading || loadingOps,
    reload: load,
    registrarProtocolo,
    registrarComplementacao,
    pedirRetificacaoLaudo,
    registrarResposta,
    registrarContato,
    registrarDecisao,
    salvarConfig,
    contextoDe,
    hoje: hojeISO(),
  };
}
