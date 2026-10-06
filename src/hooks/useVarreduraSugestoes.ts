import { lerTudo } from "@/lib/lerTudo";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { normTexto, ORIGEM_VARREDURA, type SugestaoAgrupada } from "@/lib/varredura";
import { notifyRadarChanged } from "@/hooks/useOperacoesCredito";

export interface SugestaoVarredura {
  id: string;
  tipo: "instituicao" | "protocolo";
  responsavel: string | null;
  cliente_nome: string;
  cliente_id: string | null;
  valor: string | null;
  codigo: string | null;
  data: string | null;
  vezes: number;
  arquivo: string | null;
  variantes: string[];
  status: "pendente" | "aplicada" | "descartada";
  operacao_id: string | null;
  aplicado_nome: string | null;
  aplicado_em: string | null;
}

export function useVarreduraSugestoes(tipo?: "instituicao" | "protocolo") {
  const { user } = useAuth();
  const [sugestoes, setSugestoes] = useState<SugestaoVarredura[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    let q = supabase.from("varredura_sugestoes").select("*").order("cliente_nome");
    if (tipo) q = q.eq("tipo", tipo);
    const { data, error } = await q;
    if (error) toast.error("Erro ao carregar as sugestões da varredura");
    setSugestoes(((data as any[]) || []) as SugestaoVarredura[]);
    setLoading(false);
  }, [user, tipo]);

  useEffect(() => {
    load();
  }, [load]);

  /** Importa o CSV já agrupado — tudo como sugestão pendente. */
  const importar = useCallback(
    async (grupos: SugestaoAgrupada[]) => {
      const { data: clientes } = await lerTudo(() => supabase.from("clientes").select("id, nome").is("deleted_at", null));
      const porNome = new Map<string, string>();
      (clientes || []).forEach((c: any) => porNome.set(normTexto(c.nome || ""), c.id));
      const linhas = grupos.map((g) => ({
        tipo: g.tipo,
        responsavel: g.responsavel || null,
        cliente_nome: g.cliente,
        cliente_id: porNome.get(normTexto(g.cliente)) ?? null,
        valor: g.valor,
        codigo: g.codigo || null,
        data: g.data,
        vezes: g.vezes,
        arquivo: g.arquivo || null,
        variantes: g.variantes,
        status: "pendente",
      }));
      const { error } = await supabase.from("varredura_sugestoes").insert(linhas as any);
      if (error) {
        toast.error("Erro ao gravar as sugestões");
        return false;
      }
      toast.success(`${linhas.length} sugestões importadas`);
      await load();
      return true;
    },
    [load],
  );

  /** Aplica uma sugestão de instituição na operação escolhida (quem aplica confirma a cédula). */
  const aplicarInstituicao = useCallback(
    async (sugestao: SugestaoVarredura, operacaoId: string, quem: string) => {
      const { error } = await supabase
        .from("operacoes_credito")
        .update({ banco: sugestao.valor } as any)
        .eq("id", operacaoId);
      if (error) {
        toast.error("Erro ao aplicar a instituição");
        return false;
      }
      await supabase
        .from("varredura_sugestoes")
        .update({
          status: "aplicada",
          operacao_id: operacaoId,
          aplicado_em: new Date().toISOString(),
          aplicado_por: user?.id ?? null,
          aplicado_nome: quem,
        } as any)
        .eq("id", sugestao.id);
      await supabase.from("audit_log").insert({
        tabela: "operacoes_credito",
        registro_id: operacaoId,
        acao: "varredura_instituicao",
        user_id: user?.id ?? null,
        dados_novos: {
          origem: ORIGEM_VARREDURA,
          instituicao: sugestao.valor,
          codigo: sugestao.codigo,
          arquivo: sugestao.arquivo,
          conferido_por: quem,
        },
      } as any);
      notifyRadarChanged();
      toast.success("Instituição aplicada e conferência registrada");
      await load();
      return true;
    },
    [load, user],
  );

  /** Aplica uma sugestão de protocolo: preenche data e referência da operação. */
  const aplicarProtocolo = useCallback(
    async (sugestao: SugestaoVarredura, operacaoId: string, quem: string) => {
      if (!sugestao.data) {
        toast.error("Sugestão sem data de protocolo");
        return false;
      }
      const { error } = await supabase
        .from("operacoes_credito")
        .update({ notificado_em: sugestao.data, protocolo_ref: sugestao.valor } as any)
        .eq("id", operacaoId);
      if (error) {
        toast.error("Erro ao aplicar o protocolo");
        return false;
      }
      await supabase
        .from("varredura_sugestoes")
        .update({
          status: "aplicada",
          operacao_id: operacaoId,
          aplicado_em: new Date().toISOString(),
          aplicado_por: user?.id ?? null,
          aplicado_nome: quem,
        } as any)
        .eq("id", sugestao.id);
      await supabase.from("audit_log").insert({
        tabela: "operacoes_credito",
        registro_id: operacaoId,
        acao: "varredura_protocolo",
        user_id: user?.id ?? null,
        dados_novos: {
          origem: ORIGEM_VARREDURA,
          protocolo: sugestao.valor,
          data: sugestao.data,
          arquivo: sugestao.arquivo,
          conferido_por: quem,
        },
      } as any);
      notifyRadarChanged();
      toast.success("Protocolo aplicado");
      await load();
      return true;
    },
    [load, user],
  );

  const descartar = useCallback(
    async (id: string, motivo: string) => {
      await supabase
        .from("varredura_sugestoes")
        .update({ status: "descartada", descartado_motivo: motivo } as any)
        .eq("id", id);
      await load();
    },
    [load],
  );

  /**
   * Confirma a sugestão no PAR cliente + banco: a notificação já foi gravada como
   * protocolada pela tela; aqui só marcamos a sugestão e registramos a conferência.
   */
  const confirmarNoPar = useCallback(
    async (sugestao: SugestaoVarredura, banco: string, operacoesIds: string[], quem: string) => {
      await supabase
        .from("varredura_sugestoes")
        .update({
          status: "aplicada",
          operacao_id: operacoesIds[0] ?? null,
          aplicado_em: new Date().toISOString(),
          aplicado_por: user?.id ?? null,
          aplicado_nome: quem,
        } as any)
        .eq("id", sugestao.id);
      await supabase.from("audit_log").insert({
        tabela: "varredura_sugestoes",
        registro_id: sugestao.id,
        acao: "protocolo_confirmado_no_par",
        user_id: user?.id ?? null,
        dados_novos: {
          origem: ORIGEM_VARREDURA,
          cliente: sugestao.cliente_nome,
          banco,
          protocolo: sugestao.valor,
          data: sugestao.data,
          arquivo: sugestao.arquivo,
          operacoes: operacoesIds,
          conferido_por: quem,
        },
      } as any);
      notifyRadarChanged();
      await load();
      return true;
    },
    [load, user],
  );

  return {
    sugestoes,
    loading,
    reload: load,
    importar,
    aplicarInstituicao,
    aplicarProtocolo,
    confirmarNoPar,
    descartar,
  };
}
