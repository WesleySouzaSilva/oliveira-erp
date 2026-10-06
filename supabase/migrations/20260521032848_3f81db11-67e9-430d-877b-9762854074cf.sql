CREATE TABLE public.mkt_tentativas_data_futura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  user_id uuid NOT NULL,
  data_tentada date NOT NULL,
  contexto text NOT NULL,
  pagina text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mkt_tent_futura_org_data ON public.mkt_tentativas_data_futura (organizacao_id, data_tentada);
CREATE INDEX idx_mkt_tent_futura_user ON public.mkt_tentativas_data_futura (user_id);

ALTER TABLE public.mkt_tentativas_data_futura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros da org podem ver tentativas"
ON public.mkt_tentativas_data_futura
FOR SELECT
TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "membros da org podem registrar tentativas"
ON public.mkt_tentativas_data_futura
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
);

CREATE POLICY "admins podem deletar tentativas"
ON public.mkt_tentativas_data_futura
FOR DELETE
TO authenticated
USING (public.is_admin_in_org(auth.uid(), organizacao_id));