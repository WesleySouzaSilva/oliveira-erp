import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "sonner";

export interface Lead {
  id: string;
  organizacao_id: string;
  responsavel_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  origem: string;
  etapa_funil: string;
  valor_estimado: number | null;
  motivo_perda: string | null;
  observacoes: string | null;
  data_entrada: string;
  data_conversao_sql: string | null;
  data_reuniao: string | null;
  data_proposta: string | null;
  data_fechamento: string | null;
  created_at: string;
  updated_at: string;
}

export interface Atividade {
  id: string;
  lead_id: string;
  organizacao_id: string;
  responsavel_id: string;
  tipo: string;
  descricao: string | null;
  resultado: string | null;
  duracao_minutos: number | null;
  data_atividade: string;
  created_at: string;
}

export interface MetaComercial {
  id: string;
  organizacao_id: string;
  responsavel_id: string;
  titulo: string;
  descricao: string | null;
  tipo_meta: string;
  valor_alvo: number;
  valor_atual: number;
  periodo_inicio: string;
  periodo_fim: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const ETAPAS_FUNIL = ["mql", "sql", "reuniao", "proposta", "fechamento", "perdido"] as const;
const ORIGENS = ["google", "indicacao", "redes_sociais", "site", "evento", "outro"] as const;
const TIPOS_ATIVIDADE = ["ligacao", "reuniao_video", "reuniao_presencial", "email", "whatsapp", "follow_up"] as const;
const TIPOS_META = ["leads", "reunioes", "propostas", "fechamentos", "receita"] as const;

export { ETAPAS_FUNIL, ORIGENS, TIPOS_ATIVIDADE, TIPOS_META };

export type UserRole = "admin" | "comercial" | "marketing" | "other";

export function useComercial() {
  const { user } = useAuth();
  const { orgId, members } = useOrgMembers();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [metas, setMetas] = useState<MetaComercial[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine user role for this module
  const COMERCIAL_ROLES = ["comercial", "closer", "sdr", "social_seller"];
  const MARKETING_ROLES = ["marketing", "gerente_marketing", "criacao", "copywriter", "social_media"];

  const userRole: UserRole = (() => {
    if (!user || !members.length) return "other";
    const membro = members.find(m => m.user_id === user.id);
    if (!membro) return "other";
    if (membro.papel === "admin") return "admin";
    if (COMERCIAL_ROLES.includes(membro.papel)) return "comercial";
    if (MARKETING_ROLES.includes(membro.papel)) return "marketing";
    if (membro.papel === "coordenador") return "admin"; // coord sees all
    return "other";
  })();

  const canViewComercial = userRole === "admin" || userRole === "comercial";
  const canViewMarketing = userRole === "admin" || userRole === "marketing";
  const canManage = userRole === "admin" || userRole === "comercial";

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    const leadsRes = await supabase.from("comercial_leads").select("*").eq("organizacao_id", orgId).order("created_at", { ascending: false });
    if (leadsRes.data) setLeads(leadsRes.data as Lead[]);

    if (canViewComercial) {
      const [ativRes, metasRes] = await Promise.all([
        supabase.from("comercial_atividades").select("*").eq("organizacao_id", orgId).order("data_atividade", { ascending: false }),
        supabase.from("comercial_metas").select("*").eq("organizacao_id", orgId).order("periodo_fim", { ascending: true }),
      ]);
      if (ativRes.data) setAtividades(ativRes.data as Atividade[]);
      if (metasRes.data) setMetas(metasRes.data as MetaComercial[]);
    }
    setLoading(false);
  }, [orgId, canViewComercial]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createLead = async (data: Partial<Lead>) => {
    if (!user || !orgId) return;
    const { error } = await supabase.from("comercial_leads").insert({
      ...data,
      organizacao_id: orgId,
      responsavel_id: user.id,
    } as any);
    if (error) { toast.error("Erro ao criar lead"); console.error(error); return; }
    toast.success("Lead criado!");
    fetchData();
  };

  const updateLead = async (id: string, data: Partial<Lead>) => {
    const { error } = await supabase.from("comercial_leads").update(data as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar lead"); console.error(error); return; }
    toast.success("Lead atualizado!");
    fetchData();
  };

  const createAtividade = async (data: Partial<Atividade>) => {
    if (!user || !orgId) return;
    const { error } = await supabase.from("comercial_atividades").insert({
      ...data,
      organizacao_id: orgId,
      responsavel_id: user.id,
    } as any);
    if (error) { toast.error("Erro ao registrar atividade"); console.error(error); return; }
    toast.success("Atividade registrada!");
    fetchData();
  };

  const createMeta = async (data: Partial<MetaComercial>) => {
    if (!user || !orgId) return;
    const { error } = await supabase.from("comercial_metas").insert({
      ...data,
      organizacao_id: orgId,
      created_by: user.id,
      responsavel_id: data.responsavel_id || user.id,
    } as any);
    if (error) { toast.error("Erro ao criar meta"); console.error(error); return; }
    toast.success("Meta criada!");
    fetchData();
  };

  const updateMeta = async (id: string, data: Partial<MetaComercial>) => {
    const { error } = await supabase.from("comercial_metas").update(data as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar meta"); console.error(error); return; }
    toast.success("Meta atualizada!");
    fetchData();
  };

  // Metrics
  const getMetrics = useCallback(() => {
    const byEtapa = (etapa: string) => leads.filter(l => l.etapa_funil === etapa).length;
    const totalLeads = leads.length;
    const mqls = byEtapa("mql");
    const sqls = byEtapa("sql");
    const reunioes = byEtapa("reuniao");
    const propostas = byEtapa("proposta");
    const fechamentos = byEtapa("fechamento");
    const perdidos = byEtapa("perdido");

    const valorTotal = leads
      .filter(l => l.etapa_funil === "fechamento")
      .reduce((s, l) => s + (l.valor_estimado || 0), 0);

    const ticketMedio = fechamentos > 0 ? valorTotal / fechamentos : 0;
    const taxaConversao = totalLeads > 0 ? ((fechamentos / totalLeads) * 100) : 0;

    const ligacoes = atividades.filter(a => a.tipo === "ligacao").length;
    const reunioesVideo = atividades.filter(a => a.tipo === "reuniao_video").length;
    const reunioesPresencial = atividades.filter(a => a.tipo === "reuniao_presencial").length;

    const porOrigem = ORIGENS.map(o => ({
      origem: o,
      count: leads.filter(l => l.origem === o).length,
    }));

    const funilData = [
      { etapa: "MQL", count: mqls + sqls + reunioes + propostas + fechamentos },
      { etapa: "SQL", count: sqls + reunioes + propostas + fechamentos },
      { etapa: "Reunião", count: reunioes + propostas + fechamentos },
      { etapa: "Proposta", count: propostas + fechamentos },
      { etapa: "Fechamento", count: fechamentos },
    ];

    return {
      totalLeads, mqls, sqls, reunioes, propostas, fechamentos, perdidos,
      valorTotal, ticketMedio, taxaConversao,
      ligacoes, reunioesVideo, reunioesPresencial,
      porOrigem, funilData,
    };
  }, [leads, atividades]);

  return {
    leads, atividades, metas, loading,
    createLead, updateLead, createAtividade, createMeta, updateMeta,
    getMetrics, orgId, userRole, canViewComercial, canViewMarketing, canManage,
    members,
  };
}
