-- FASE A — Vínculo ADVBOX (manual) e tabela de andamentos (pronta p/ Fase B)

-- 1) Colunas em processos
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS numero_processo text,
  ADD COLUMN IF NOT EXISTS advbox_lawsuit_id text,
  ADD COLUMN IF NOT EXISTS advbox_vinculado_em timestamptz,
  ADD COLUMN IF NOT EXISTS advbox_vinculado_por uuid;

CREATE INDEX IF NOT EXISTS idx_processos_advbox_lawsuit_id
  ON public.processos(advbox_lawsuit_id) WHERE advbox_lawsuit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_processos_org_advbox_lawsuit
  ON public.processos(organizacao_id, advbox_lawsuit_id)
  WHERE advbox_lawsuit_id IS NOT NULL;

-- 2) Tabela processo_andamentos (Fase B vai popular via service_role)
CREATE TABLE IF NOT EXISTS public.processo_andamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  advbox_lawsuit_id text NOT NULL,
  advbox_movement_id text NOT NULL,
  data date NOT NULL,
  descricao text NOT NULL,
  tipo text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem text NOT NULL DEFAULT 'advbox',
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_andamentos_org_movement UNIQUE (organizacao_id, advbox_movement_id)
);

CREATE INDEX IF NOT EXISTS idx_andamentos_processo_data
  ON public.processo_andamentos(processo_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_andamentos_lawsuit
  ON public.processo_andamentos(advbox_lawsuit_id);

-- GRANTs (sem anon; só leitura para authenticated; escrita só service_role)
GRANT SELECT ON public.processo_andamentos TO authenticated;
GRANT ALL ON public.processo_andamentos TO service_role;

ALTER TABLE public.processo_andamentos ENABLE ROW LEVEL SECURITY;

-- Política única: SELECT por organização. Sem INSERT/UPDATE/DELETE para authenticated.
CREATE POLICY "andamentos_select_org"
ON public.processo_andamentos
FOR SELECT
TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));