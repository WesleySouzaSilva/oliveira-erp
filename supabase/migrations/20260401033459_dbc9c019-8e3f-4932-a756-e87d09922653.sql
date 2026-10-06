
-- Add deleted_at column to key tables
ALTER TABLE public.laudos ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.contratos_vencimentos ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.peticoes ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Partial indexes for active records (most queries filter deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_laudos_active ON public.laudos (organizacao_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_processos_active ON public.processos (organizacao_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_active ON public.clientes (organizacao_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contratos_active ON public.contratos_vencimentos (organizacao_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_peticoes_active ON public.peticoes (organizacao_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_movimentacoes_active ON public.movimentacoes (processo_id) WHERE deleted_at IS NULL;

-- Create a soft_delete helper function
CREATE OR REPLACE FUNCTION public.soft_delete(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = now() WHERE id = $1', _table) USING _id;
END;
$$;
