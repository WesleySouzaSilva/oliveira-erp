
CREATE TABLE public.consultoria_simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  cliente_nome text NOT NULL,
  tipo_cliente text NOT NULL,
  plano text NOT NULL,
  valor_base numeric NOT NULL,
  fator_complexidade numeric NOT NULL DEFAULT 1.0,
  valor_mensalidade_final numeric NOT NULL,
  valor_credito_cobranca numeric,
  honorario_exito_estimado numeric,
  operador_id uuid NOT NULL,
  organizacao_id uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_simulacoes TO authenticated;
GRANT ALL ON public.consultoria_simulacoes TO service_role;

ALTER TABLE public.consultoria_simulacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY cs_select_org ON public.consultoria_simulacoes
FOR SELECT TO authenticated
USING (operador_id = auth.uid() OR organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY cs_insert_org ON public.consultoria_simulacoes
FOR INSERT TO authenticated
WITH CHECK (operador_id = auth.uid());

CREATE POLICY cs_update_org ON public.consultoria_simulacoes
FOR UPDATE TO authenticated
USING (operador_id = auth.uid() OR organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY cs_delete_org ON public.consultoria_simulacoes
FOR DELETE TO authenticated
USING (operador_id = auth.uid() OR is_admin_in_org(auth.uid(), organizacao_id));
