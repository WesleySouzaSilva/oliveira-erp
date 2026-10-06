ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS situacao_motivo text,
  ADD COLUMN IF NOT EXISTS situacao_alterada_por uuid,
  ADD COLUMN IF NOT EXISTS situacao_alterada_em timestamptz;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_situacao_check;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_situacao_check
  CHECK (situacao IN ('ativo','encerrado','rescindido','fora_do_escopo'));

CREATE INDEX IF NOT EXISTS idx_clientes_situacao ON public.clientes (situacao);