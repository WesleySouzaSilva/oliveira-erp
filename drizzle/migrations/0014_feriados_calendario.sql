CREATE TABLE public.feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL,
  data DATE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'municipal',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX feriados_org_data_idx ON public.feriados (organizacao_id, data);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriados TO authenticated;
GRANT ALL ON public.feriados TO service_role;

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros leem feriados da org"
ON public.feriados FOR SELECT TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Membros inserem feriados da org"
ON public.feriados FOR INSERT TO authenticated
WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Membros atualizam feriados da org"
ON public.feriados FOR UPDATE TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Membros removem feriados da org"
ON public.feriados FOR DELETE TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));