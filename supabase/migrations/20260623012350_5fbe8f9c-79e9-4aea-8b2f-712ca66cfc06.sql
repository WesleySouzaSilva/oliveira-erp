ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nps integer,
  ADD COLUMN IF NOT EXISTS responsavel_pos_venda uuid;