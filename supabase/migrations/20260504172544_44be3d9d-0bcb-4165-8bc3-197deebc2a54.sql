
-- Permitir que membros da mesma organização vejam/editem laudos uns dos outros
DROP POLICY IF EXISTS "org_select_laudos" ON public.laudos;
DROP POLICY IF EXISTS "org_update_laudos" ON public.laudos;
DROP POLICY IF EXISTS "org_delete_laudos" ON public.laudos;

CREATE POLICY "org_select_laudos" ON public.laudos FOR SELECT
USING (
  (auth.uid() = user_id)
  OR (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  OR public.shares_org(auth.uid(), user_id)
);

CREATE POLICY "org_update_laudos" ON public.laudos FOR UPDATE
USING (
  (auth.uid() = user_id)
  OR (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  OR public.shares_org(auth.uid(), user_id)
);

CREATE POLICY "org_delete_laudos" ON public.laudos FOR DELETE
USING (
  (auth.uid() = user_id)
  OR (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  OR public.shares_org(auth.uid(), user_id)
);
