import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVerComo } from "@/lib/verComo";

export interface InfoAlvo { papel: string; is_ceo: boolean; areas: string[]; grupoModulos: string[] | null }

const cache = new Map<string, Promise<InfoAlvo | null>>();

async function carregar(uid: string): Promise<InfoAlvo | null> {
  const { data: m } = await (supabase as any).from("membros")
    .select("papel, is_ceo, areas, permission_group_id").eq("user_id", uid).limit(1).maybeSingle();
  if (!m) return null;
  let grupoModulos: string[] | null = null;
  if (m.permission_group_id) {
    const { data: g } = await supabase.from("permission_groups").select("modulos").eq("id", m.permission_group_id).maybeSingle();
    grupoModulos = ((g as any)?.modulos as string[]) ?? [];
  }
  return { papel: m.papel || "agronomo", is_ceo: !!m.is_ceo, areas: m.areas || [], grupoModulos };
}

/**
 * Papel, CEO, áreas e grupo da pessoa vista no modo "ver como". Lido com as
 * permissões do próprio admin (RLS atual); se não puder ler, volta null e a
 * interface simplesmente mostra menos. Sem o modo, não consulta nada.
 */
export function useVerComoAlvo() {
  const alvo = useVerComo();
  const [info, setInfo] = useState<{ uid: string; v: InfoAlvo | null } | null>(null);
  useEffect(() => {
    if (!alvo?.user_id) return;
    const uid = alvo.user_id;
    if (!cache.has(uid)) cache.set(uid, carregar(uid).catch(() => null));
    let vivo = true;
    cache.get(uid)!.then((v) => { if (vivo) setInfo({ uid, v }); });
    return () => { vivo = false; };
  }, [alvo?.user_id]);
  const pronto = !!alvo && info?.uid === alvo.user_id;
  return { alvo, info: pronto ? info!.v : null, loading: !!alvo && !pronto };
}
