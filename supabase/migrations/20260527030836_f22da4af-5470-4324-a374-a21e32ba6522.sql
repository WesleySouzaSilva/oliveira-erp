
CREATE TABLE public.analise_contrato_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organizacao_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  cliente_nome TEXT,
  arquivo_hash TEXT,
  result_raw TEXT,
  error TEXT,
  provedor TEXT,
  modelo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_acj_org_created ON public.analise_contrato_jobs(organizacao_id, created_at DESC);
CREATE INDEX idx_acj_status ON public.analise_contrato_jobs(status);

GRANT SELECT, INSERT, UPDATE ON public.analise_contrato_jobs TO authenticated;
GRANT ALL ON public.analise_contrato_jobs TO service_role;

ALTER TABLE public.analise_contrato_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acj_select_org" ON public.analise_contrato_jobs
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY "acj_insert_own" ON public.analise_contrato_jobs
  FOR INSERT TO authenticated
  WITH CHECK (operador_id = auth.uid());

CREATE POLICY "acj_update_own_or_admin" ON public.analise_contrato_jobs
  FOR UPDATE TO authenticated
  USING (operador_id = auth.uid() OR (organizacao_id IS NOT NULL AND is_admin_in_org(auth.uid(), organizacao_id)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.analise_contrato_jobs;
ALTER TABLE public.analise_contrato_jobs REPLICA IDENTITY FULL;
