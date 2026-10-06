import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser } from "@/hooks/usePortalUser";

/**
 * Dados do PORTAL DO CLIENTE (agro). Tudo aqui passa pelo JWT do usuário do
 * portal: a RLS garante que só volta o que é do próprio cliente e o que a
 * equipe liberou (visivel_cliente). Nenhuma query recebe cliente_id do
 * front como filtro de segurança; ele é só cache key.
 */
const db = supabase as any;

export type PortalProcesso = {
  id: string;
  numero_processo: string | null;
  fase_atual: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PortalAndamento = {
  id: string;
  processo_id: string;
  data: string;
  descricao: string;
  tipo: string | null;
  created_at: string;
};

export type PortalContrato = {
  id: string;
  banco: string | null;
  numero_contrato: string | null;
  primeiro_vencimento: string | null;
  vencimento_proxima_parcela: string | null;
  vencimento_ultima_parcela: string | null;
  valor_parcela: number | null;
  valor_total_operacao: number | null;
  parcelas_vencidas: boolean;   // tem parcela em atraso
  protocolo_realizado: boolean;
  data_notificacao: string | null;
  resolvido: boolean;
  updated_at: string;
};

export type ChamadoTipo = "pos_venda" | "banco" | "documento" | "duvida";
export type ChamadoStatus = "aberto" | "em_andamento" | "aguardando_cliente" | "resolvido";

export type PortalChamado = {
  id: string;
  cliente_id: string;
  tipo: ChamadoTipo;
  titulo: string;
  descricao: string | null;
  banco: string | null;
  processo_id: string | null;
  contrato_id: string | null;
  status: ChamadoStatus;
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  responsavel_id: string | null;
  ultima_mensagem_em: string;
  resolvido_em: string | null;
  created_at: string;
};

export type ChamadoAnexo = { path: string; nome: string; tamanho: number; tipo: string };

export type PortalChamadoMensagem = {
  id: string;
  chamado_id: string;
  autor_id: string;
  autor_tipo: "cliente" | "equipe" | "olivia";
  conteudo: string;
  anexos: ChamadoAnexo[];
  created_at: string;
};

export type PortalAtendimento = {
  id: string;
  titulo: string | null;
  origem: string;
  tipo_contato: string | null;
  status: string;
  relatorio_cliente: string | null;
  created_at: string;
};

export type PortalAcordo = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  data_vencimento: string;
  concluida: boolean;
  observacoes: string | null;
  created_at: string;
};

export type PortalNotificacao = {
  id: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  created_at: string;
};

/** Fases do processo interno (1 a 5) traduzidas para o cliente. */
export const FASE_LABEL: Record<string, string> = {
  "1": "Análise técnica (laudo)",
  "2": "Notificação ao banco",
  "3": "Aguardando resposta do banco",
  "4": "Ação judicial",
  "5": "Encerrado",
};
export function faseLabel(fase: string | number | null | undefined): string | null {
  if (fase === null || fase === undefined || fase === "") return null;
  return FASE_LABEL[String(fase)] || String(fase);
}

export const CHAMADO_TIPO_LABEL: Record<ChamadoTipo, string> = {
  pos_venda: "Pós-venda",
  banco: "Atualização do banco",
  documento: "Envio de documento",
  duvida: "Dúvida",
};

export const CHAMADO_STATUS_LABEL: Record<ChamadoStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando você",
  resolvido: "Resolvido",
};

/** Situação do contrato calculada só com dados objetivos (nunca o texto livre interno). */
export function situacaoContrato(c: PortalContrato): { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" } {
  if (c.resolvido) return { label: "Renegociado", tone: "success" };
  if (c.parcelas_vencidas) return { label: "Parcela em atraso", tone: "danger" };
  if (c.protocolo_realizado) return { label: "Pedido protocolado no banco", tone: "info" };
  if (c.vencimento_proxima_parcela) {
    const dias = diasAte(c.vencimento_proxima_parcela);
    if (dias !== null && dias < 0) return { label: "Parcela vencida", tone: "danger" };
    if (dias !== null && dias <= 30) return { label: `Vence em ${dias} dia(s)`, tone: "warning" };
  }
  return { label: "Em dia", tone: "success" };
}

export function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const alvo = new Date(iso.slice(0, 10) + "T12:00:00");
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export function usePortalCliente() {
  const portal = usePortalUser();
  const clienteId = portal.status === "portal_cliente" ? portal.clienteId : null;
  const enabled = !!clienteId;
  const qc = useQueryClient();

  const cliente = useQuery({
    queryKey: ["portal", "cliente", clienteId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, email, telefone, municipio, uf, nome_propriedade, cultura_principal")
        .eq("id", clienteId!)
        .maybeSingle();
      return data;
    },
  });

  const processos = useQuery({
    queryKey: ["portal", "processos", clienteId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("processos")
        .select("id, numero_processo, fase_atual, created_at, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      return (data || []) as PortalProcesso[];
    },
  });

  // Últimos andamentos liberados, de todos os processos do cliente (RLS filtra).
  const andamentosRecentes = useQuery({
    queryKey: ["portal", "andamentos-recentes", clienteId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("processo_andamentos")
        .select("id, processo_id, data, descricao, tipo, created_at")
        .order("data", { ascending: false })
        .limit(12);
      return (data || []) as PortalAndamento[];
    },
  });

  const contratos = useQuery({
    queryKey: ["portal", "contratos", clienteId],
    enabled,
    queryFn: async () => {
      const { data } = await db
        .from("portal_cliente_contratos_view")
        .select("*")
        .order("vencimento_proxima_parcela", { ascending: true, nullsFirst: false });
      return (data || []) as PortalContrato[];
    },
  });

  const chamados = useQuery({
    queryKey: ["portal", "chamados", clienteId],
    enabled,
    queryFn: async () => {
      const { data } = await db
        .from("portal_chamados")
        .select("*")
        .order("ultima_mensagem_em", { ascending: false });
      return (data || []) as PortalChamado[];
    },
  });

  const atendimentos = useQuery({
    queryKey: ["portal", "atendimentos", clienteId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("portal_cliente_atendimentos_view")
        .select("id, titulo, origem, tipo_contato, status, relatorio_cliente, created_at")
        .order("created_at", { ascending: false });
      return (data || []) as PortalAtendimento[];
    },
  });

  const acordos = useQuery({
    queryKey: ["portal", "acordos", clienteId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("portal_cliente_acordos_view")
        .select("id, titulo, descricao, status, data_vencimento, concluida, observacoes, created_at")
        .order("data_vencimento", { ascending: true });
      return (data || []) as PortalAcordo[];
    },
  });

  const notificacoes = useQuery({
    queryKey: ["portal", "notificacoes", clienteId],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notificacoes_sistema")
        .select("id, mensagem, tipo, lida, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data || []) as PortalNotificacao[];
    },
  });

  const invalidar = (chave?: string) =>
    qc.invalidateQueries({ queryKey: chave ? ["portal", chave] : ["portal"] });

  return {
    portal,
    clienteId,
    cliente,
    processos,
    andamentosRecentes,
    contratos,
    chamados,
    atendimentos,
    acordos,
    notificacoes,
    invalidar,
  };
}

export function useChamado(chamadoId: string | undefined) {
  const chamado = useQuery({
    queryKey: ["portal", "chamado", chamadoId],
    enabled: !!chamadoId,
    queryFn: async () => {
      const { data } = await db.from("portal_chamados").select("*").eq("id", chamadoId).maybeSingle();
      return (data || null) as PortalChamado | null;
    },
  });
  const mensagens = useQuery({
    queryKey: ["portal", "chamado-mensagens", chamadoId],
    enabled: !!chamadoId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await db
        .from("portal_chamado_mensagens")
        .select("*")
        .eq("chamado_id", chamadoId)
        .order("created_at", { ascending: true });
      return (data || []) as PortalChamadoMensagem[];
    },
  });
  return { chamado, mensagens };
}

/** Sobe anexos no bucket privado. Caminho: <cliente_id>/<chamado_id>/<ts>-<nome>. */
export async function uploadAnexosChamado(
  clienteId: string,
  chamadoId: string,
  files: File[],
): Promise<ChamadoAnexo[]> {
  const out: ChamadoAnexo[] = [];
  for (const f of files) {
    const safe = f.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${clienteId}/${chamadoId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("portal-anexos").upload(path, f, {
      contentType: f.type || undefined,
      upsert: false,
    });
    if (error) throw new Error(`Falha ao enviar "${f.name}": ${error.message}`);
    out.push({ path, nome: f.name, tamanho: f.size, tipo: f.type });
  }
  return out;
}

export async function urlAnexo(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("portal-anexos").createSignedUrl(path, 60 * 10);
  return data?.signedUrl || null;
}
