
CREATE TABLE public.honorarios_calculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  cliente_nome text NOT NULL,
  valor_divida numeric NOT NULL,
  faixa_aplicada integer NOT NULL,
  complexidade_multiplicador numeric NOT NULL DEFAULT 1.0,
  honorario_inicial numeric NOT NULL,
  honorario_exito numeric NOT NULL,
  honorario_total numeric NOT NULL,
  operador_id uuid NOT NULL,
  organizacao_id uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.honorarios_calculos TO authenticated;
GRANT ALL ON public.honorarios_calculos TO service_role;

ALTER TABLE public.honorarios_calculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hc_select_org" ON public.honorarios_calculos
FOR SELECT TO authenticated
USING ((operador_id = auth.uid()) OR (organizacao_id IN (SELECT user_org_ids(auth.uid()))));

CREATE POLICY "hc_insert_org" ON public.honorarios_calculos
FOR INSERT TO authenticated
WITH CHECK (operador_id = auth.uid());

CREATE POLICY "hc_update_org" ON public.honorarios_calculos
FOR UPDATE TO authenticated
USING ((operador_id = auth.uid()) OR (organizacao_id IN (SELECT user_org_ids(auth.uid()))));

CREATE POLICY "hc_delete_org" ON public.honorarios_calculos
FOR DELETE TO authenticated
USING ((operador_id = auth.uid()) OR is_admin_in_org(auth.uid(), organizacao_id));

CREATE INDEX idx_hc_org ON public.honorarios_calculos(organizacao_id);
CREATE INDEX idx_hc_operador ON public.honorarios_calculos(operador_id);
