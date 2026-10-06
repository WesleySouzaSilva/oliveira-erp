ALTER TABLE public.atendimentos_notas
  ADD COLUMN IF NOT EXISTS cliente_id uuid NULL REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atendimentos_notas_cliente
  ON public.atendimentos_notas(cliente_id) WHERE cliente_id IS NOT NULL;