
CREATE TABLE public.consultoria_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas_consultoria(id) ON DELETE CASCADE,
  avenca_id uuid REFERENCES public.avencas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluido')),
  responsavel_id uuid,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_consultoria_onboarding_empresa ON public.consultoria_onboarding(empresa_id);
CREATE INDEX idx_consultoria_onboarding_status ON public.consultoria_onboarding(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_onboarding TO authenticated;
GRANT ALL ON public.consultoria_onboarding TO service_role;

ALTER TABLE public.consultoria_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_select_org" ON public.consultoria_onboarding
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "onboarding_insert_org" ON public.consultoria_onboarding
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "onboarding_update_org" ON public.consultoria_onboarding
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "onboarding_delete_org" ON public.consultoria_onboarding
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER update_consultoria_onboarding_updated_at
  BEFORE UPDATE ON public.consultoria_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.consultoria_onboarding_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  onboarding_id uuid NOT NULL REFERENCES public.consultoria_onboarding(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  observacao text,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_consultoria_onboarding_itens_ob ON public.consultoria_onboarding_itens(onboarding_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_onboarding_itens TO authenticated;
GRANT ALL ON public.consultoria_onboarding_itens TO service_role;

ALTER TABLE public.consultoria_onboarding_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onb_itens_select_org" ON public.consultoria_onboarding_itens
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "onb_itens_insert_org" ON public.consultoria_onboarding_itens
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "onb_itens_update_org" ON public.consultoria_onboarding_itens
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "onb_itens_delete_org" ON public.consultoria_onboarding_itens
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
