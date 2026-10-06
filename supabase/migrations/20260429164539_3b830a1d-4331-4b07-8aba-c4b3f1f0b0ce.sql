ALTER TABLE public.atividades_clientes
  ADD COLUMN IF NOT EXISTS anexos_urls text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS anexos_nomes text[] DEFAULT '{}'::text[];