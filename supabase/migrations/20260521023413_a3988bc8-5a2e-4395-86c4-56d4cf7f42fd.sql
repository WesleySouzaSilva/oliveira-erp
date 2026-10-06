ALTER TABLE public.mkt_lancamentos_diarios
  ADD COLUMN IF NOT EXISTS follow_ups_ligacao integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_ups_mensagem integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clientes_resgatados_followup integer NOT NULL DEFAULT 0;