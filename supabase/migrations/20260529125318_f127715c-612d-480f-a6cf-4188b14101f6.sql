ALTER TABLE public.mkt_lancamentos_diarios
  ADD COLUMN IF NOT EXISTS sdr_ligacoes_realizadas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sdr_ligacoes_atendidas integer NOT NULL DEFAULT 0;