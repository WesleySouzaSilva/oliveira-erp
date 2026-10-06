ALTER TABLE public.operacoes_credito
  ADD COLUMN IF NOT EXISTS juizo_conferencia text,
  ADD COLUMN IF NOT EXISTS juizo_conferido_em timestamptz,
  ADD COLUMN IF NOT EXISTS juizo_obs text;