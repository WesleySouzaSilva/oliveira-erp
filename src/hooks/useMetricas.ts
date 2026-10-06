import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Nicho } from "./useMetricasCalc";

export function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

export function isFutureDate(ymd: string) {
  return ymd > todayYMD();
}

export async function registrarTentativaDataFutura(
  data_tentada: string,
  contexto: string,
  pagina?: string,
) {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user?.id) return;
    const { data: m } = await supabase
      .from("membros")
      .select("organizacao_id")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (!m?.organizacao_id) return;
    await supabase.from("mkt_tentativas_data_futura").insert({
      organizacao_id: m.organizacao_id,
      user_id: u.user.id,
      data_tentada,
      contexto,
      pagina: pagina ?? null,
    });
  } catch {
    /* silencioso: nunca quebra UX */
  }
}

export interface LancamentoDiario {
  id?: string;
  data: string;
  nicho: Nicho;
  closer_id: string | null;
  sdr_id: string | null;
  investimento: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  leads_pagos: number;
  leads_organicos: number;
  investimento_organico: number;
  impressoes_organico: number;
  alcance_organico: number;
  cliques_organico: number;
  leads_qualificados_sdr: number;
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  propostas_enviadas: number;
  contratos_fechados: number;
  receita_fechada: number;
  contratos_perdidos: number;
  motivo_perda_principal: string | null;
  follow_ups: number;
  ligacoes: number;
  negocios_recuperados: number;
  follow_ups_ligacao: number;
  follow_ups_mensagem: number;
  clientes_resgatados_followup: number;
  sdr_ligacoes_realizadas: number;
  sdr_ligacoes_atendidas: number;
  leads_desqualificados_sdr: number;
  observacoes: string | null;
}

export interface LeadOrganico {
  id?: string;
  data: string;
  nicho: Nicho;
  origem_tipo: string;
  quantidade: number;
  indicado_por: string | null;
  observacoes: string | null;
}

export interface MetaMensal {
  id?: string;
  mes: number;
  ano: number;
  nicho: Nicho;
  meta_investimento: number;
  meta_leads_pagos: number;
  meta_leads_organicos: number;
  meta_contratos: number;
  meta_receita: number;
}

export interface MetaIndividual {
  id?: string;
  membro_user_id: string;
  mes: number;
  ano: number;
  meta_receita: number;
  meta_contratos: number;
  meta_leads_qualificados: number;
  meta_reunioes_realizadas: number;
  meta_valor_total_contratos: number;
  meta_supermeta_valor_total: number;
  pct_entrada: number;
  comissao_nao_bateu: number;
  comissao_bateu: number;
  comissao_supermeta: number;
  meta_credenciados?: number;
}

const emptyLancamento = (data: string, nicho: Nicho): LancamentoDiario => ({
  data,
  nicho,
  closer_id: null,
  sdr_id: null,
  investimento: 0,
  impressoes: 0,
  alcance: 0,
  cliques: 0,
  leads_pagos: 0,
  leads_organicos: 0,
  investimento_organico: 0,
  impressoes_organico: 0,
  alcance_organico: 0,
  cliques_organico: 0,
  leads_qualificados_sdr: 0,
  reunioes_agendadas: 0,
  reunioes_realizadas: 0,
  propostas_enviadas: 0,
  contratos_fechados: 0,
  receita_fechada: 0,
  contratos_perdidos: 0,
  motivo_perda_principal: null,
  follow_ups: 0,
  ligacoes: 0,
  negocios_recuperados: 0,
  follow_ups_ligacao: 0,
  follow_ups_mensagem: 0,
  clientes_resgatados_followup: 0,
  sdr_ligacoes_realizadas: 0,
  sdr_ligacoes_atendidas: 0,
  leads_desqualificados_sdr: 0,
  observacoes: null,
});

export function useLancamento(
  data: string,
  nicho: Nicho,
  closerId: string | null = null,
  sdrId: string | null = null,
) {
  const [lancamento, setLancamento] = useState<LancamentoDiario>(emptyLancamento(data, nicho));
  const [existing, setExisting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("mkt_lancamentos_diarios")
      .select("*")
      .eq("data", data)
      .eq("nicho", nicho);
    q = closerId ? q.eq("closer_id", closerId) : q.is("closer_id", null);
    q = sdrId ? q.eq("sdr_id", sdrId) : q.is("sdr_id", null);
    const { data: row } = await q.maybeSingle();
    if (row) {
      setLancamento({ ...emptyLancamento(data, nicho), ...(row as any) });
      setExisting(true);
    } else {
      setLancamento({
        ...emptyLancamento(data, nicho),
        closer_id: closerId,
        sdr_id: sdrId,
      });
      setExisting(false);
    }
    setLoading(false);
  }, [data, nicho, closerId, sdrId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (isFutureDate(data)) {
      await registrarTentativaDataFutura(data, closerId || sdrId ? "comercial" : "marketing", "lancamento");
      throw new Error("Não é permitido lançar números para datas futuras.");
    }
    const { data: user } = await supabase.auth.getUser();
    const payload: any = {
      ...lancamento,
      closer_id: closerId,
      sdr_id: sdrId,
      user_id: user.user?.id,
    };
    delete payload.id;
    // O índice único cobre (org, data, nicho, closer_id, sdr_id) com COALESCE para nulls.
    // Como onConflict do PostgREST não suporta expressão, fazemos manual: update se existir, senão insert.
    let q = supabase
      .from("mkt_lancamentos_diarios")
      .select("id")
      .eq("data", data)
      .eq("nicho", nicho);
    q = closerId ? q.eq("closer_id", closerId) : q.is("closer_id", null);
    q = sdrId ? q.eq("sdr_id", sdrId) : q.is("sdr_id", null);
    const { data: existingRow } = await q.maybeSingle();
    if (existingRow?.id) {
      const { error } = await supabase
        .from("mkt_lancamentos_diarios")
        .update(payload)
        .eq("id", existingRow.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("mkt_lancamentos_diarios")
        .insert(payload);
      if (error) throw error;
    }
    await load();
  };

  return { lancamento, setLancamento, existing, loading, save, reload: load };
}

export function useLancamentosPeriodo(inicio: string, fim: string, nichos?: Nicho[]) {
  const [rows, setRows] = useState<LancamentoDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("mkt_lancamentos_diarios")
        .select("*")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: true });
      if (nichos && nichos.length > 0) q = q.in("nicho", nichos);
      const { data } = await q;
      if (!cancel) {
        setRows((data as any) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [inicio, fim, JSON.stringify(nichos), reloadKey]);

  return { rows, loading, refetch: () => setReloadKey((k) => k + 1) };
}

export function useOrganicosPeriodo(inicio: string, fim: string, nichos?: Nicho[]) {
  const [rows, setRows] = useState<LeadOrganico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("mkt_leads_organicos_origem")
        .select("*")
        .gte("data", inicio)
        .lte("data", fim);
      if (nichos && nichos.length > 0) q = q.in("nicho", nichos);
      const { data } = await q;
      if (!cancel) {
        setRows((data as any) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [inicio, fim, JSON.stringify(nichos)]);

  return { rows, loading };
}

export function useOrganicosDia(data: string, nicho: Nicho) {
  const [rows, setRows] = useState<LeadOrganico[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: result } = await supabase
      .from("mkt_leads_organicos_origem")
      .select("*")
      .eq("data", data)
      .eq("nicho", nicho);
    setRows((result as any) || []);
    setLoading(false);
  }, [data, nicho]);

  useEffect(() => {
    load();
  }, [load]);

  const saveOrigem = async (origem_tipo: string, quantidade: number, indicado_por: string | null, observacoes: string | null) => {
    const { data: user } = await supabase.auth.getUser();
    const payload: any = {
      data,
      nicho,
      origem_tipo,
      quantidade,
      indicado_por,
      observacoes,
      user_id: user.user?.id,
    };
    const { error } = await supabase
      .from("mkt_leads_organicos_origem")
      .upsert(payload, { onConflict: "organizacao_id,data,nicho,origem_tipo" });
    if (error) throw error;
    await load();
  };

  return { rows, loading, saveOrigem, reload: load };
}

export function useMetas(mes: number, ano: number) {
  const [metas, setMetas] = useState<MetaMensal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mkt_metas_mensais")
      .select("*")
      .eq("mes", mes)
      .eq("ano", ano);
    setMetas((data as any) || []);
    setLoading(false);
  }, [mes, ano]);

  useEffect(() => {
    load();
  }, [load]);

  const saveMeta = async (m: MetaMensal) => {
    const { data: user } = await supabase.auth.getUser();
    const payload: any = { ...m, user_id: user.user?.id };
    delete payload.id;
    const { error } = await supabase
      .from("mkt_metas_mensais")
      .upsert(payload, { onConflict: "organizacao_id,mes,ano,nicho" });
    if (error) throw error;
    await load();
  };

  return { metas, loading, saveMeta, reload: load };
}

export function useMetasHistorico(limit = 12) {
  const [rows, setRows] = useState<MetaMensal[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("mkt_metas_mensais")
        .select("*")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(limit * 3);
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, [limit]);
  return { rows, loading };
}

export function useMetasIndividuais(mes: number, ano: number) {
  const [rows, setRows] = useState<MetaIndividual[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mkt_metas_individuais")
      .select("*")
      .eq("mes", mes)
      .eq("ano", ano);
    setRows((data as any) || []);
    setLoading(false);
  }, [mes, ano]);

  useEffect(() => {
    load();
  }, [load]);

  const saveMetaInd = async (m: MetaIndividual) => {
    const { data: user } = await supabase.auth.getUser();
    const payload: any = { ...m, user_id: user.user?.id };
    delete payload.id;
    const { error } = await supabase
      .from("mkt_metas_individuais")
      .upsert(payload, { onConflict: "organizacao_id,membro_user_id,mes,ano" });
    if (error) throw error;
    await load();
  };

  const removeMetaInd = async (id: string) => {
    const { error } = await supabase.from("mkt_metas_individuais").delete().eq("id", id);
    if (error) throw error;
    await load();
  };

  return { rows, loading, saveMetaInd, removeMetaInd, reload: load };
}