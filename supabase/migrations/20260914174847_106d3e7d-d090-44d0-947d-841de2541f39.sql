ALTER TABLE public.operacoes_credito
  ALTER COLUMN vence_em DROP NOT NULL,
  ALTER COLUMN banco DROP NOT NULL,
  ALTER COLUMN modalidade DROP NOT NULL,
  ALTER COLUMN cliente_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS grupo text,
  ADD COLUMN IF NOT EXISTS titular_nome text,
  ADD COLUMN IF NOT EXISTS titular_a_definir boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_conferida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_conferida_por uuid,
  ADD COLUMN IF NOT EXISTS data_conferida_em timestamptz,
  ADD COLUMN IF NOT EXISTS status_conferencia text NOT NULL DEFAULT 'radar',
  ADD COLUMN IF NOT EXISTS origem_arquivo text,
  ADD COLUMN IF NOT EXISTS trecho text;

ALTER TABLE public.operacoes_credito
  DROP CONSTRAINT IF EXISTS operacoes_credito_status_conferencia_check;
ALTER TABLE public.operacoes_credito
  ADD CONSTRAINT operacoes_credito_status_conferencia_check
  CHECK (status_conferencia IN ('radar','historico','sem_vencimento','a_digitar'));

ALTER TABLE public.operacoes_credito
  DROP CONSTRAINT IF EXISTS operacoes_credito_radar_exige_data;
ALTER TABLE public.operacoes_credito
  ADD CONSTRAINT operacoes_credito_radar_exige_data
  CHECK (status_conferencia <> 'radar' OR vence_em IS NOT NULL);

ALTER TABLE public.operacoes_credito
  DROP CONSTRAINT IF EXISTS operacoes_credito_cliente_ou_grupo;
ALTER TABLE public.operacoes_credito
  ADD CONSTRAINT operacoes_credito_cliente_ou_grupo
  CHECK (cliente_id IS NOT NULL OR (titular_a_definir AND grupo IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_operacoes_credito_status ON public.operacoes_credito (organizacao_id, status_conferencia);

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS grupo text,
  ADD COLUMN IF NOT EXISTS triado_em timestamptz,
  ADD COLUMN IF NOT EXISTS triagem_origem text,
  ADD COLUMN IF NOT EXISTS grafias_alternativas text[];

CREATE INDEX IF NOT EXISTS idx_clientes_grupo ON public.clientes (organizacao_id, grupo);