import { useState, useEffect, useMemo } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Contrato {
  id: string;
  nome_cliente: string;
  banco: string | null;
  numero_contrato: string | null;
  vencimento_proxima_parcela: string | null;
  primeiro_vencimento: string | null;
  vencimento_ultima_parcela: string | null;
  valor_parcela: number | null;
  valor_total_operacao: number | null;
  parcelas_vencidas: boolean | null;
  possui_laudo: boolean | null;
  data_limite_protocolo: string | null;
  protocolo_realizado: boolean | null;
  notificado_antes_vencimento: boolean | null;
  data_notificacao: string | null;
  canal_notificacao: string | null;
  responsavel_gestao: string | null;
  status_prazo: string | null;
  observacoes: string | null;
  resolvido?: boolean;
  motivo_resolucao?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DuplicateGroup {
  key: string;
  nome_cliente: string;
  numero_contrato: string | null;
  banco: string | null;
  items: Contrato[];
}

const normalizeKeyPart = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const buildContratoKey = (data: {
  nome_cliente?: string | null;
  numero_contrato?: string | null;
  banco?: string | null;
  vencimento_proxima_parcela?: string | null;
  valor_total_operacao?: number | null;
}) => {
  const nome = normalizeKeyPart(data.nome_cliente);
  if (!nome) return "";

  const numero = normalizeKeyPart(data.numero_contrato);
  const banco = normalizeKeyPart(data.banco);

  if (numero) {
    return `num|${nome}|${numero}|${banco || "-"}`;
  }

  const vencimento = (data.vencimento_proxima_parcela || "").trim();
  const total = data.valor_total_operacao != null ? Number(data.valor_total_operacao).toFixed(2) : "";
  return `fallback|${nome}|${banco || "-"}|${vencimento}|${total}`;
};

export function useVencimentosData() {
  const { user } = useAuth();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContratos = async () => {
    if (!user) return;

    const { data, error } = await lerTudo(() => supabase
      .from("contratos_vencimentos")
      .select("*")
      .is("deleted_at", null)
      .order("vencimento_proxima_parcela", { ascending: true }));

    if (data) setContratos(data as Contrato[]);
    if (error) toast.error("Erro ao carregar contratos");
    setLoading(false);
  };

  useEffect(() => {
    loadContratos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    const groups = new Map<string, Contrato[]>();

    for (const contrato of contratos) {
      const key = buildContratoKey(contrato);
      if (!key) continue;
      const items = groups.get(key) || [];
      items.push(contrato);
      groups.set(key, items);
    }

    return Array.from(groups.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => {
        const sortedItems = [...items].sort((a, b) => {
          const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
          const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
          return dateB - dateA;
        });

        return {
          key,
          nome_cliente: sortedItems[0].nome_cliente,
          numero_contrato: sortedItems[0].numero_contrato,
          banco: sortedItems[0].banco,
          items: sortedItems,
        };
      });
  }, [contratos]);

  const duplicateExtrasCount = useMemo(
    () => duplicateGroups.reduce((acc, group) => acc + Math.max(group.items.length - 1, 0), 0),
    [duplicateGroups]
  );

  const bancos = useMemo(() => {
    const set = new Set(contratos.map((c) => c.banco).filter(Boolean));
    return Array.from(set).sort();
  }, [contratos]);

  return {
    contratos,
    setContratos,
    loading,
    loadContratos,
    duplicateGroups,
    duplicateExtrasCount,
    bancos,
  };
}
