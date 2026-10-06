ALTER TABLE public.mkt_lancamentos_diarios
  ADD COLUMN IF NOT EXISTS follow_ups integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ligacoes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negocios_recuperados integer NOT NULL DEFAULT 0;