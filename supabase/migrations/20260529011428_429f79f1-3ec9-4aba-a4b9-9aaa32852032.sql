ALTER TABLE public.pos_venda_onboardings
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS area_hectares numeric,
  ADD COLUMN IF NOT EXISTS bancos text[] DEFAULT '{}'::text[];