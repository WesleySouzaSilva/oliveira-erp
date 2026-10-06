ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS advbox_customers_id text;
ALTER TABLE public.operacoes_credito ADD COLUMN IF NOT EXISTS advbox_lawsuits_id text;
ALTER TABLE public.operacoes_credito ADD COLUMN IF NOT EXISTS advbox_titular_customers_id text;

CREATE TABLE IF NOT EXISTS public.advbox_reconciliacao (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  fase text not null default 'A',
  resumo jsonb not null default '{}'::jsonb,
  detalhe jsonb not null default '{}'::jsonb
);

GRANT SELECT ON public.advbox_reconciliacao TO authenticated;
GRANT ALL ON public.advbox_reconciliacao TO service_role;
ALTER TABLE public.advbox_reconciliacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recon_select_org" ON public.advbox_reconciliacao;
CREATE POLICY "recon_select_org" ON public.advbox_reconciliacao
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));