ALTER TABLE public.atividades_clientes ADD COLUMN IF NOT EXISTS banco text;
CREATE INDEX IF NOT EXISTS idx_atividades_banco ON public.atividades_clientes(banco);