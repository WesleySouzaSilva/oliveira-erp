import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

function isRlsError(err: any): boolean {
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.code === "42501" ||
    msg.includes("row-level security") ||
    msg.includes("violates row-level security") ||
    msg.includes("permission denied")
  );
}

function logErro(escopo: string, err: any, extra?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.error(`[mensageria:${escopo}]`, {
    code: err?.code,
    message: err?.message,
    details: err?.details,
    hint: err?.hint,
    ...extra,
  });
}

export interface Conversa {
  id: string;
  organizacao_id: string;
  tipo: "direta" | "grupo";
  titulo: string | null;
  criada_por: string;
  cliente_id: string | null;
  laudo_id: string | null;
  processo_id: string | null;
  ultima_mensagem_em: string;
  ultima_mensagem_preview: string | null;
  created_at: string;
  membros?: { user_id: string; ultima_leitura_em: string; papel: string }[];
  nao_lidas?: number;
}

export function useConversas(filter?: { clienteId?: string | null }) {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    // 1) pega conversas onde sou membro ativo
    const { data: memberships } = await supabase
      .from("conversa_membros")
      .select("conversa_id, ultima_leitura_em")
      .eq("user_id", user.id)
      .is("saiu_em", null);

    const ids = (memberships || []).map((m) => m.conversa_id);
    if (ids.length === 0) {
      setConversas([]);
      setLoading(false);
      return;
    }

    let q = supabase
      .from("conversas")
      .select("*")
      .in("id", ids)
      .order("ultima_mensagem_em", { ascending: false });
    if (filter?.clienteId) q = q.eq("cliente_id", filter.clienteId);

    const { data: convs } = await q;
    if (!convs) { setConversas([]); setLoading(false); return; }

    // membros
    const { data: todosMembros } = await supabase
      .from("conversa_membros")
      .select("conversa_id, user_id, papel, ultima_leitura_em")
      .in("conversa_id", ids)
      .is("saiu_em", null);

    // contagem não-lidas: mensagens criadas após minha última leitura
    const myReadMap = new Map((memberships || []).map((m) => [m.conversa_id, m.ultima_leitura_em]));
    const naoLidasPorConv: Record<string, number> = {};
    await Promise.all(
      convs.map(async (c) => {
        const since = myReadMap.get(c.id);
        if (!since) return;
        const { count } = await supabase
          .from("mensagens")
          .select("id", { count: "exact", head: true })
          .eq("conversa_id", c.id)
          .gt("created_at", since)
          .neq("autor_id", user.id);
        naoLidasPorConv[c.id] = count || 0;
      })
    );

    const enriched: Conversa[] = (convs as any[]).map((c) => ({
      ...c,
      membros: (todosMembros || []).filter((m) => m.conversa_id === c.id),
      nao_lidas: naoLidasPorConv[c.id] || 0,
    }));
    setConversas(enriched);
    setLoading(false);
  }, [user?.id, filter?.clienteId]);

  useEffect(() => { load(); }, [load]);

  // realtime — recarrega quando algo muda em conversas
  useEffect(() => {
    if (!user) return;
    const channelName = `conversas-rt-${user.id}-${filter?.clienteId ?? "all"}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversa_membros", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, filter?.clienteId, load]);

  const criarConversa = async (params: {
    organizacao_id: string;
    tipo: "direta" | "grupo";
    titulo?: string;
    membrosUserIds: string[];
    cliente_id?: string | null;
    laudo_id?: string | null;
    processo_id?: string | null;
  }) => {
    if (!user) throw new Error("não autenticado");
    const { data: conv, error } = await supabase
      .from("conversas")
      .insert({
        organizacao_id: params.organizacao_id,
        tipo: params.tipo,
        titulo: params.titulo ?? null,
        criada_por: user.id,
        cliente_id: params.cliente_id ?? null,
        laudo_id: params.laudo_id ?? null,
        processo_id: params.processo_id ?? null,
      })
      .select()
      .single();
    if (error) {
      logErro("criarConversa.insert", error, { params });
      if (isRlsError(error)) {
        toast.error("Sem permissão para criar conversa nesta organização (RLS).");
      }
      throw error;
    }

    const ids = Array.from(new Set([user.id, ...params.membrosUserIds]));
    const rows = ids.map((uid) => ({
      conversa_id: conv.id,
      user_id: uid,
      papel: uid === user.id ? "admin" : "membro",
    }));
    const { error: e2 } = await supabase.from("conversa_membros").insert(rows);
    if (e2) {
      logErro("criarConversa.membros", e2, { conversa_id: conv.id, ids });
      if (isRlsError(e2)) {
        toast.error("Conversa criada mas falhou ao adicionar membros (RLS).");
      }
      throw e2;
    }
    await load();
    return conv.id as string;
  };

  const marcarComoLida = async (conversaId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("conversa_membros")
      .update({ ultima_leitura_em: new Date().toISOString() })
      .eq("conversa_id", conversaId)
      .eq("user_id", user.id);
    if (error) { logErro("marcarComoLida", error, { conversaId }); return; }
    // atualização otimista: zera contador local sem refazer o load completo
    setConversas((prev) => prev.map((c) => (c.id === conversaId ? { ...c, nao_lidas: 0 } : c)));
  };

  const totalNaoLidas = conversas.reduce((s, c) => s + (c.nao_lidas || 0), 0);

  return { conversas, loading, criarConversa, marcarComoLida, reload: load, totalNaoLidas };
}
// Hook leve para criar conversa sem assinar realtime nem carregar lista.
// Útil em diálogos que só precisam da ação de criação.
export function useCriarConversa() {
  const { user } = useAuth();

  const criarConversa = async (params: {
    organizacao_id: string;
    tipo: "direta" | "grupo";
    titulo?: string;
    membrosUserIds: string[];
    cliente_id?: string | null;
    laudo_id?: string | null;
    processo_id?: string | null;
  }) => {
    if (!user) throw new Error("não autenticado");
    const { data: conv, error } = await supabase
      .from("conversas")
      .insert({
        organizacao_id: params.organizacao_id,
        tipo: params.tipo,
        titulo: params.titulo ?? null,
        criada_por: user.id,
        cliente_id: params.cliente_id ?? null,
        laudo_id: params.laudo_id ?? null,
        processo_id: params.processo_id ?? null,
      })
      .select()
      .single();
    if (error) {
      logErro("useCriarConversa.insert", error, { params });
      if (isRlsError(error)) {
        toast.error("Sem permissão para criar conversa nesta organização (RLS).");
      }
      throw error;
    }

    const ids = Array.from(new Set([user.id, ...params.membrosUserIds]));
    const rows = ids.map((uid) => ({
      conversa_id: conv.id,
      user_id: uid,
      papel: uid === user.id ? "admin" : "membro",
    }));
    const { error: e2 } = await supabase.from("conversa_membros").insert(rows);
    if (e2) {
      logErro("useCriarConversa.membros", e2, { conversa_id: conv.id, ids });
      if (isRlsError(e2)) {
        toast.error("Conversa criada mas falhou ao adicionar membros (RLS).");
      }
      throw e2;
    }
    return conv.id as string;
  };

  return { criarConversa };
}
