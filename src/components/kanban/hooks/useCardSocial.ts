import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Comentario {
  id: string;
  autor_id: string;
  autor_nome?: string | null;
  conteudo: string;
  created_at: string;
}

export interface Atividade {
  id: string;
  autor_id: string | null;
  autor_nome?: string | null;
  tipo: string;
  dados: any;
  created_at: string;
}

export interface Anexo {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number;
  tipo: string | null;
  created_at: string;
}

async function enrichWithAuthors<T extends { autor_id: string | null }>(rows: T[]): Promise<(T & { autor_nome?: string | null })[]> {
  const ids = [...new Set(rows.map((r) => r.autor_id).filter(Boolean) as string[])];
  if (!ids.length) return rows;
  const { data } = await supabase.from("profiles_publico").select("id, nome").in("id", ids);
  const map = new Map((data ?? []).map((p: any) => [p.id, p.nome]));
  return rows.map((r) => ({ ...r, autor_nome: r.autor_id ? map.get(r.autor_id) ?? null : null }));
}

// =========== Comentários ===========
export function useComentarios(processoId: string | null) {
  return useQuery({
    queryKey: ["kanban", "comentarios", processoId],
    enabled: !!processoId,
    queryFn: async (): Promise<Comentario[]> => {
      const { data, error } = await supabase
        .from("kanban_card_comentarios")
        .select("id, autor_id, conteudo, created_at")
        .eq("processo_id", processoId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return await enrichWithAuthors((data ?? []) as any);
    },
  });
}

export function useComentarioMutations(processoId: string | null, orgId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["kanban", "comentarios", processoId] });
    qc.invalidateQueries({ queryKey: ["kanban", "atividades", processoId] });
    qc.invalidateQueries({ queryKey: ["kanban", "card-counts", orgId] });
  };

  const add = useMutation({
    mutationFn: async (conteudo: string) => {
      if (!processoId || !orgId || !user?.id) throw new Error("Sem contexto");
      const { error } = await supabase.from("kanban_card_comentarios").insert({
        processo_id: processoId,
        organizacao_id: orgId,
        autor_id: user.id,
        conteudo,
      });
      if (error) throw error;
      // atividade
      await supabase.from("kanban_card_atividades").insert({
        processo_id: processoId,
        organizacao_id: orgId,
        autor_id: user.id,
        tipo: "comentou",
        dados: { preview: conteudo.slice(0, 140) },
      });
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kanban_card_comentarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}

// =========== Atividades ===========
export function useAtividades(processoId: string | null) {
  return useQuery({
    queryKey: ["kanban", "atividades", processoId],
    enabled: !!processoId,
    queryFn: async (): Promise<Atividade[]> => {
      const { data, error } = await supabase
        .from("kanban_card_atividades")
        .select("id, autor_id, tipo, dados, created_at")
        .eq("processo_id", processoId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return await enrichWithAuthors((data ?? []) as any);
    },
  });
}

export async function logAtividade(
  processoId: string,
  orgId: string,
  autorId: string,
  tipo: string,
  dados: Record<string, any> = {},
) {
  await supabase.from("kanban_card_atividades").insert({
    processo_id: processoId,
    organizacao_id: orgId,
    autor_id: autorId,
    tipo,
    dados,
  });
}

// =========== Anexos ===========
const BUCKET = "cliente-drive";

export function useAnexos(processoId: string | null) {
  return useQuery({
    queryKey: ["kanban", "anexos", processoId],
    enabled: !!processoId,
    queryFn: async (): Promise<Anexo[]> => {
      const { data, error } = await supabase
        .from("kanban_card_anexos")
        .select("id, nome_arquivo, storage_path, tamanho_bytes, tipo, created_at")
        .eq("processo_id", processoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Anexo[];
    },
  });
}

export function useAnexoMutations(processoId: string | null, orgId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["kanban", "anexos", processoId] });
    qc.invalidateQueries({ queryKey: ["kanban", "atividades", processoId] });
    qc.invalidateQueries({ queryKey: ["kanban", "card-counts", orgId] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!processoId || !orgId || !user?.id) throw new Error("Sem contexto");
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `kanban/${processoId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("kanban_card_anexos").insert({
        processo_id: processoId,
        organizacao_id: orgId,
        autor_id: user.id,
        nome_arquivo: file.name,
        storage_path: path,
        tamanho_bytes: file.size,
        tipo: file.type || null,
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
      await supabase.from("kanban_card_atividades").insert({
        processo_id: processoId,
        organizacao_id: orgId,
        autor_id: user.id,
        tipo: "anexou",
        dados: { nome: file.name, tamanho: file.size },
      });
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (anexo: Anexo) => {
      await supabase.storage.from(BUCKET).remove([anexo.storage_path]);
      const { error } = await supabase.from("kanban_card_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const download = async (anexo: Anexo) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(anexo.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return { upload, remove, download };
}

// =========== Contadores agregados (para badges nos cards) ===========
export interface CardCounts {
  comentarios: number;
  anexos: number;
}

export function useAllCardCounts(orgId: string | null) {
  return useQuery({
    queryKey: ["kanban", "card-counts", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Map<string, CardCounts>> => {
      const [c, a] = await Promise.all([
        supabase.from("kanban_card_comentarios").select("processo_id"),
        supabase.from("kanban_card_anexos").select("processo_id"),
      ]);
      const map = new Map<string, CardCounts>();
      const bump = (id: string, key: keyof CardCounts) => {
        const cur = map.get(id) ?? { comentarios: 0, anexos: 0 };
        cur[key] += 1;
        map.set(id, cur);
      };
      (c.data ?? []).forEach((r: any) => bump(r.processo_id, "comentarios"));
      (a.data ?? []).forEach((r: any) => bump(r.processo_id, "anexos"));
      return map;
    },
  });
}