
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.olivia_conhecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  categoria text NOT NULL DEFAULT 'geral',
  titulo text,
  fonte text,
  conteudo text NOT NULL,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX olivia_conhecimento_org_idx ON public.olivia_conhecimento(organizacao_id);
CREATE INDEX olivia_conhecimento_categoria_idx ON public.olivia_conhecimento(categoria);
CREATE INDEX olivia_conhecimento_embedding_idx
  ON public.olivia_conhecimento USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.olivia_conhecimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read knowledge in their orgs"
ON public.olivia_conhecimento FOR SELECT TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Admins can insert knowledge"
ON public.olivia_conhecimento FOR INSERT TO authenticated
WITH CHECK (
  organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
  AND user_id = auth.uid()
  AND public.is_admin_in_org(auth.uid(), organizacao_id)
);

CREATE POLICY "Admins can update knowledge"
ON public.olivia_conhecimento FOR UPDATE TO authenticated
USING (public.is_admin_in_org(auth.uid(), organizacao_id))
WITH CHECK (public.is_admin_in_org(auth.uid(), organizacao_id));

CREATE POLICY "Admins can delete knowledge"
ON public.olivia_conhecimento FOR DELETE TO authenticated
USING (public.is_admin_in_org(auth.uid(), organizacao_id));

CREATE TRIGGER trg_olivia_conhecimento_updated
BEFORE UPDATE ON public.olivia_conhecimento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.match_olivia_conhecimento(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_categoria text DEFAULT NULL,
  filter_org uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  categoria text,
  titulo text,
  fonte text,
  conteudo text,
  tags text[],
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    k.id, k.categoria, k.titulo, k.fonte, k.conteudo, k.tags, k.metadata,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.olivia_conhecimento k
  WHERE k.embedding IS NOT NULL
    AND k.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND (filter_org IS NULL OR k.organizacao_id = filter_org)
    AND (filter_categoria IS NULL OR k.categoria = filter_categoria)
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.match_olivia_conhecimento(vector, int, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_olivia_conhecimento(vector, int, text, uuid) TO authenticated;
