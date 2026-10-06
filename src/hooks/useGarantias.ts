import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Avalista, Garantia } from "@/lib/garantias";
import { notifyRadarChanged } from "@/hooks/useOperacoesCredito";

/** Garantias e avalistas de UMA operação. */
export function useGarantiasOperacao(operacaoId?: string | null) {
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [avalistas, setAvalistas] = useState<Avalista[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!operacaoId) {
      setGarantias([]);
      setAvalistas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [g, a] = await Promise.all([
      supabase.from("operacao_garantias").select("*").eq("operacao_id", operacaoId).order("created_at"),
      supabase.from("operacao_avalistas").select("*").eq("operacao_id", operacaoId).order("created_at"),
    ]);
    if (g.error || a.error) toast.error("Erro ao carregar garantias da operação");
    setGarantias((g.data as any[]) || []);
    setAvalistas((a.data as any[]) || []);
    setLoading(false);
  }, [operacaoId]);

  useEffect(() => {
    load();
  }, [load]);

  const salvarGarantia = async (g: Partial<Garantia> & { operacao_id: string }) => {
    const payload = {
      operacao_id: g.operacao_id,
      tipo: g.tipo,
      grau: g.grau || null,
      descricao: g.descricao || null,
      identificacao: g.identificacao || null,
      valor_avaliacao: g.valor_avaliacao ?? null,
      onde_registrada: g.onde_registrada || null,
      situacao: g.situacao || "gravado",
      observacao: g.observacao || null,
    };
    const { error } = g.id
      ? await supabase.from("operacao_garantias").update(payload as any).eq("id", g.id)
      : await supabase.from("operacao_garantias").insert(payload as any);
    if (error) {
      toast.error("Não foi possível salvar a garantia", { description: error.message });
      return false;
    }
    toast.success(g.id ? "Garantia atualizada" : "Garantia adicionada");
    await load();
    notifyRadarChanged();
    return true;
  };

  const removerGarantia = async (id: string) => {
    const { error } = await supabase.from("operacao_garantias").delete().eq("id", id);
    if (error) return toast.error("Não foi possível remover", { description: error.message });
    await load();
    notifyRadarChanged();
  };

  const salvarAvalista = async (a: Partial<Avalista> & { operacao_id: string }) => {
    const payload = {
      operacao_id: a.operacao_id,
      pessoa_id: a.pessoa_id || null,
      nome: (a.nome || "").trim(),
      cpf: a.cpf || null,
      conjuge_anuiu: a.conjuge_anuiu || "nao_se_aplica",
      observacao: a.observacao || null,
    };
    if (!payload.nome) {
      toast.error("Informe o nome do avalista");
      return false;
    }
    const { error } = a.id
      ? await supabase.from("operacao_avalistas").update(payload as any).eq("id", a.id)
      : await supabase.from("operacao_avalistas").insert(payload as any);
    if (error) {
      toast.error("Não foi possível salvar o avalista", { description: error.message });
      return false;
    }
    toast.success(a.id ? "Avalista atualizado" : "Avalista adicionado");
    await load();
    notifyRadarChanged();
    return true;
  };

  const removerAvalista = async (id: string) => {
    const { error } = await supabase.from("operacao_avalistas").delete().eq("id", id);
    if (error) return toast.error("Não foi possível remover", { description: error.message });
    await load();
    notifyRadarChanged();
  };

  return { garantias, avalistas, loading, reload: load, salvarGarantia, removerGarantia, salvarAvalista, removerAvalista };
}

/** Troca de estratégia com histórico obrigatório (quem, quando e por quê). */
export async function mudarEstrategia(opts: {
  operacaoId: string;
  de: string | null;
  para: string;
  motivo: string;
  nome?: string | null;
}) {
  const motivo = opts.motivo.trim();
  if (motivo.length < 5) {
    toast.error("Escreva o motivo da mudança de estratégia");
    return false;
  }
  const { error } = await supabase
    .from("operacoes_credito")
    .update({ estrategia: opts.para, estrategia_em: new Date().toISOString() } as any)
    .eq("id", opts.operacaoId);
  if (error) {
    toast.error("Não foi possível mudar a estratégia", { description: error.message });
    return false;
  }
  await supabase.from("operacao_estrategia_hist").insert({
    operacao_id: opts.operacaoId,
    de: opts.de,
    para: opts.para,
    motivo,
    alterado_por_nome: opts.nome || null,
  } as any);
  toast.success("Estratégia atualizada");
  notifyRadarChanged();
  return true;
}

export interface EstrategiaHist {
  id: string;
  de: string | null;
  para: string;
  motivo: string;
  alterado_por_nome: string | null;
  created_at: string;
}

export function useEstrategiaHistorico(operacaoId?: string | null) {
  const [historico, setHistorico] = useState<EstrategiaHist[]>([]);
  useEffect(() => {
    if (!operacaoId) return setHistorico([]);
    supabase
      .from("operacao_estrategia_hist")
      .select("id, de, para, motivo, alterado_por_nome, created_at")
      .eq("operacao_id", operacaoId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setHistorico((data as any[]) || []));
  }, [operacaoId]);
  return historico;
}

/** Em quais operações a pessoa aparece como avalista. */
export function useAvaisDaPessoa(pessoaId?: string | null, cpf?: string | null) {
  const [avais, setAvais] = useState<any[]>([]);
  useEffect(() => {
    if (!pessoaId && !cpf) return setAvais([]);
    const run = async () => {
      let q = supabase
        .from("operacao_avalistas")
        .select("id, nome, cpf, conjuge_anuiu, operacao_id, operacoes_credito(id, banco, numero, vence_em, saldo_devedor, cliente_id, clientes(nome))");
      q = pessoaId ? q.eq("pessoa_id", pessoaId) : q.eq("cpf", cpf as string);
      const { data } = await q;
      setAvais((data as any[]) || []);
    };
    run();
  }, [pessoaId, cpf]);
  return avais;
}
