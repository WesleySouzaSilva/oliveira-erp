ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS risco text,
  ADD COLUMN IF NOT EXISTS honorarios_valor numeric;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_risco_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_risco_check CHECK (risco IS NULL OR risco IN ('alto','medio','baixo'));