
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Immutable wrapper so it can be used in indexes/expressions
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

-- Normaliza: remove acentos, minúsculas, e remove pontuação comum
CREATE OR REPLACE FUNCTION public.normalize_search(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(regexp_replace(public.f_unaccent(coalesce($1,'')), '[^a-zA-Z0-9 ]', '', 'g'))
$$;

-- Indexes para acelerar buscas normalizadas
CREATE INDEX IF NOT EXISTS idx_clientes_nome_norm ON public.clientes (public.normalize_search(nome));
CREATE INDEX IF NOT EXISTS idx_contratos_venc_nome_norm ON public.contratos_vencimentos (public.normalize_search(nome_cliente));
