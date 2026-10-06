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

export interface Mensagem {
  id: string;
  conversa_id: string;
  organizacao_id: string;
  autor_id: string;
  conteudo: string;
  anexos: any[];
  mencoes: string[];
  editada_em: string | null;
  excluida_em: string | null;
  created_at: string;
}

export function useMensagens(conversaId: string | null) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!conversaId) { setMensagens([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("mensagens")
      .select("*")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true })
      .limit(500);
    setMensagens((data || []) as any);
    setLoading(false);
  }, [conversaId]);

  useEffect(() => { load(); }, [load]);

  // realtime
  useEffect(() => {
    if (!conversaId) return;
    const channel = supabase
      .channel(`msgs-${conversaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens", filter: `conversa_id=eq.${conversaId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversaId, load]);

  const enviar = async (params: {
    organizacao_id: string;
    conteudo: string;
    anexos?: any[];
    mencoes?: string[];
  }) => {
    if (!user || !conversaId) return;
    const conteudo = params.conteudo.trim();
    if (!conteudo) return;
    const { error } = await supabase.from("mensagens").insert({
      conversa_id: conversaId,
      organizacao_id: params.organizacao_id,
      autor_id: user.id,
      conteudo,
      anexos: params.anexos || [],
      mencoes: params.mencoes || [],
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[mensageria:enviar]", { code: error.code, message: error.message, details: error.details, hint: error.hint, conversaId });
      if (isRlsError(error)) {
        toast.error("Sem permissão para enviar mensagem nesta conversa (RLS).");
      } else {
        toast.error(error.message || "Falha ao enviar mensagem");
      }
      throw error;
    }
  };

  const excluir = async (id: string) => {
    const { error } = await supabase
      .from("mensagens")
      .update({ excluida_em: new Date().toISOString(), conteudo: "[mensagem removida]" })
      .eq("id", id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[mensageria:excluir]", { code: error.code, message: error.message, id });
      if (isRlsError(error)) {
        toast.error("Sem permissão para excluir esta mensagem (RLS).");
      } else {
        toast.error(error.message || "Falha ao excluir mensagem");
      }
    }
  };

  return { mensagens, loading, enviar, excluir, reload: load };
}