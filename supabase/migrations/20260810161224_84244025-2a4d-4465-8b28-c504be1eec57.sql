-- 1. app_secrets & rate_limits: service_role only
REVOKE ALL ON public.app_secrets FROM anon, authenticated;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.app_secrets TO service_role;
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_secrets FORCE ROW LEVEL SECURITY;

-- 2. financeiro_cobrancas: leitura CEO, escrita só service_role
REVOKE INSERT, UPDATE, DELETE ON public.financeiro_cobrancas FROM anon, authenticated;
REVOKE ALL ON public.financeiro_cobrancas FROM anon;
GRANT SELECT ON public.financeiro_cobrancas TO authenticated;
GRANT ALL ON public.financeiro_cobrancas TO service_role;
ALTER TABLE public.financeiro_cobrancas ENABLE ROW LEVEL SECURITY;

-- 3. kanban_card_atividades: autoria obrigatória
DROP POLICY IF EXISTS kanban_card_atividades_insert ON public.kanban_card_atividades;
CREATE POLICY kanban_card_atividades_insert
ON public.kanban_card_atividades FOR INSERT TO authenticated
WITH CHECK (
  organizacao_id IN (SELECT user_org_ids(auth.uid()))
  AND autor_id = auth.uid()
);

-- 4. kanban_card_membros: só admin da org ou o próprio usuário
DROP POLICY IF EXISTS kanban_card_membros_insert ON public.kanban_card_membros;
CREATE POLICY kanban_card_membros_insert
ON public.kanban_card_membros FOR INSERT TO authenticated
WITH CHECK (
  organizacao_id IN (SELECT user_org_ids(auth.uid()))
  AND (user_id = auth.uid() OR public.is_admin_in_org(auth.uid(), organizacao_id))
);

DROP POLICY IF EXISTS kanban_card_membros_delete ON public.kanban_card_membros;
CREATE POLICY kanban_card_membros_delete
ON public.kanban_card_membros FOR DELETE TO authenticated
USING (
  organizacao_id IN (SELECT user_org_ids(auth.uid()))
  AND (user_id = auth.uid() OR public.is_admin_in_org(auth.uid(), organizacao_id))
);