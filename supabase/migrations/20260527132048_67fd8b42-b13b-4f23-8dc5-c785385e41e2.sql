
CREATE TABLE public.pos_venda_onboardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  responsavel_id uuid NOT NULL,
  cliente_id uuid,
  contrato_fechado_id uuid,
  lead_id uuid,
  cliente_nome text NOT NULL,
  cliente_contato text,
  status text NOT NULL DEFAULT 'aberto',
  observacoes text,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pos_venda_checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES public.pos_venda_onboardings(id) ON DELETE CASCADE,
  organizacao_id uuid,
  categoria text NOT NULL,
  categoria_label text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  documento text NOT NULL,
  prioridade text NOT NULL DEFAULT 'ESSENCIAL',
  finalidade text,
  onde_obter text,
  validade_tipica text,
  status text NOT NULL DEFAULT 'pendente',
  data_recebimento date,
  observacoes text,
  anexo_url text,
  anexo_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pvci_onboarding ON public.pos_venda_checklist_itens(onboarding_id);
CREATE INDEX idx_pvo_org ON public.pos_venda_onboardings(organizacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_venda_onboardings TO authenticated;
GRANT ALL ON public.pos_venda_onboardings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_venda_checklist_itens TO authenticated;
GRANT ALL ON public.pos_venda_checklist_itens TO service_role;

ALTER TABLE public.pos_venda_onboardings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_venda_checklist_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY pvo_select_org ON public.pos_venda_onboardings FOR SELECT TO authenticated
USING ((responsavel_id = auth.uid()) OR (organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid()))));

CREATE POLICY pvo_insert_own ON public.pos_venda_onboardings FOR INSERT TO authenticated
WITH CHECK (responsavel_id = auth.uid());

CREATE POLICY pvo_update_org ON public.pos_venda_onboardings FOR UPDATE TO authenticated
USING ((responsavel_id = auth.uid()) OR (organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid()))));

CREATE POLICY pvo_delete_own_or_admin ON public.pos_venda_onboardings FOR DELETE TO authenticated
USING ((responsavel_id = auth.uid()) OR (organizacao_id IS NOT NULL AND is_admin_in_org(auth.uid(), organizacao_id)));

CREATE POLICY pvci_select_org ON public.pos_venda_checklist_itens FOR SELECT TO authenticated
USING (onboarding_id IN (SELECT id FROM public.pos_venda_onboardings
  WHERE responsavel_id = auth.uid() OR (organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid())))));

CREATE POLICY pvci_insert_org ON public.pos_venda_checklist_itens FOR INSERT TO authenticated
WITH CHECK (onboarding_id IN (SELECT id FROM public.pos_venda_onboardings
  WHERE responsavel_id = auth.uid() OR (organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid())))));

CREATE POLICY pvci_update_org ON public.pos_venda_checklist_itens FOR UPDATE TO authenticated
USING (onboarding_id IN (SELECT id FROM public.pos_venda_onboardings
  WHERE responsavel_id = auth.uid() OR (organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid())))));

CREATE POLICY pvci_delete_org ON public.pos_venda_checklist_itens FOR DELETE TO authenticated
USING (onboarding_id IN (SELECT id FROM public.pos_venda_onboardings
  WHERE responsavel_id = auth.uid() OR (organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid())))));

CREATE TRIGGER trg_pvo_updated BEFORE UPDATE ON public.pos_venda_onboardings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_pvci_updated BEFORE UPDATE ON public.pos_venda_checklist_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
