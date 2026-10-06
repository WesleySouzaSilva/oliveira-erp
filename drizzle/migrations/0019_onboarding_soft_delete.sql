ALTER TABLE public.pos_venda_onboardings
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_motivo text;

CREATE INDEX IF NOT EXISTS idx_pvo_deleted_at ON public.pos_venda_onboardings (deleted_at);