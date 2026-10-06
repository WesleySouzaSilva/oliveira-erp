ALTER TABLE public.analises_contratos
  ADD COLUMN IF NOT EXISTS arquivo_hash text,
  ADD COLUMN IF NOT EXISTS citacoes jsonb;
CREATE INDEX IF NOT EXISTS idx_analises_contratos_hash ON public.analises_contratos (operador_id, arquivo_hash);