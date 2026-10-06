ALTER TABLE public.empresas_consultoria
  ADD COLUMN IF NOT EXISTS nps int CHECK (nps IS NULL OR (nps BETWEEN 0 AND 10)),
  ADD COLUMN IF NOT EXISTS responsavel_pos_venda uuid,
  ADD COLUMN IF NOT EXISTS risco text CHECK (risco IS NULL OR risco IN ('baixo','medio','alto')),
  ADD COLUMN IF NOT EXISTS ultimo_contato date;

CREATE INDEX IF NOT EXISTS idx_empresas_consultoria_resp_posvenda ON public.empresas_consultoria(responsavel_pos_venda);