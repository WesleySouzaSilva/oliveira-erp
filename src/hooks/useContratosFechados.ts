import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ContratoFechado {
  id?: string;
  organizacao_id?: string;
  created_by?: string;
  nicho: string;
  produto: string | null;
  closer_id: string | null;
  sdr_id: string | null;
  data_venda: string;
  data_pagamento: string | null;
  mes_referencia?: string | null;
  tempo_fechamento_dias?: number | null;
  plataforma: string | null;
  cliente_nome: string;
  cliente_contato: string | null;
  cliente_estado: string | null;
  valor_total: number;
  valor_entrada: number;
  num_parcelas: number;
  valor_parcela: number;
  valor_recebido: number;
  porcentagem_final?: number;
  forma_pagamento: string | null;
  tipo_pagamento: string | null;
  via_credenciado: boolean;
  credenciado_nome: string | null;
  observacoes: string | null;
}

export interface ContratosFiltros {
  nicho?: string;
  mes?: number;
  ano?: number;
  closerId?: string;
  sdrId?: string;
  busca?: string;
}

export function useContratosFechados(filtros: ContratosFiltros = {}) {
  const [rows, setRows] = useState<ContratoFechado[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("mkt_contratos_fechados" as any).select("*").order("data_venda", { ascending: false });
    if (filtros.nicho) q = q.eq("nicho", filtros.nicho);
    if (filtros.closerId) q = q.eq("closer_id", filtros.closerId);
    if (filtros.sdrId) q = q.eq("sdr_id", filtros.sdrId);
    if (filtros.ano && filtros.mes) {
      const inicio = `${filtros.ano}-${String(filtros.mes).padStart(2, "0")}-01`;
      const fimDate = new Date(filtros.ano, filtros.mes, 0);
      const fim = fimDate.toISOString().slice(0, 10);
      q = q.gte("data_venda", inicio).lte("data_venda", fim);
    } else if (filtros.ano) {
      q = q.gte("data_venda", `${filtros.ano}-01-01`).lte("data_venda", `${filtros.ano}-12-31`);
    }
    const { data, error } = await q;
    if (error) console.error(error);
    let result = (data as any[]) || [];
    if (filtros.mes && !filtros.ano) {
      // Filtra pelo mês em qualquer ano (no cliente)
      result = result.filter((r) => {
        const d = new Date(r.data_venda);
        return d.getMonth() + 1 === filtros.mes;
      });
    }
    if (filtros.busca) {
      const b = filtros.busca.toLowerCase();
      result = result.filter(
        (r) =>
          (r.cliente_nome || "").toLowerCase().includes(b) ||
          (r.produto || "").toLowerCase().includes(b) ||
          (r.cliente_contato || "").toLowerCase().includes(b),
      );
    }
    setRows(result as any);
    setLoading(false);
  }, [filtros.nicho, filtros.mes, filtros.ano, filtros.closerId, filtros.sdrId, filtros.busca]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (c: ContratoFechado) => {
    const { data: user } = await supabase.auth.getUser();
    const { data: membro } = await supabase
      .from("membros")
      .select("organizacao_id")
      .eq("user_id", user.user!.id)
      .maybeSingle();
    const payload: any = {
      ...c,
      organizacao_id: membro?.organizacao_id,
      created_by: user.user!.id,
    };
    delete payload.mes_referencia;
    delete payload.tempo_fechamento_dias;
    delete payload.porcentagem_final;
    if (c.id) {
      delete payload.id;
      delete payload.created_by;
      const { error } = await supabase.from("mkt_contratos_fechados" as any).update(payload).eq("id", c.id);
      if (error) throw error;
    } else {
      delete payload.id;
      const { error } = await supabase.from("mkt_contratos_fechados" as any).insert(payload);
      if (error) throw error;
    }
    await load();
  };

  const saveMany = async (lista: ContratoFechado[]) => {
    const { data: user } = await supabase.auth.getUser();
    const { data: membro } = await supabase
      .from("membros")
      .select("organizacao_id")
      .eq("user_id", user.user!.id)
      .maybeSingle();
    const payloads = lista.map((c) => {
      const p: any = {
        ...c,
        organizacao_id: membro?.organizacao_id,
        created_by: user.user!.id,
      };
      delete p.id;
      delete p.mes_referencia;
      delete p.tempo_fechamento_dias;
      delete p.porcentagem_final;
      return p;
    });
    const { error } = await supabase.from("mkt_contratos_fechados" as any).insert(payloads);
    if (error) throw error;
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("mkt_contratos_fechados" as any).delete().eq("id", id);
    if (error) throw error;
    await load();
  };

  return { rows, loading, save, saveMany, remove, reload: load };
}