
-- Backfill organizacao_id usando o membro do dono
UPDATE public.contratos_vencimentos cv
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE cv.organizacao_id IS NULL
  AND m.user_id = cv.user_id;

-- Atualiza policies para incluir shares_org (visibilidade de equipe)
DROP POLICY IF EXISTS "org_select_contratos" ON public.contratos_vencimentos;
DROP POLICY IF EXISTS "org_update_contratos" ON public.contratos_vencimentos;
DROP POLICY IF EXISTS "org_delete_contratos" ON public.contratos_vencimentos;

CREATE POLICY "org_select_contratos" ON public.contratos_vencimentos FOR SELECT
USING (
  (auth.uid() = user_id)
  OR (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  OR public.shares_org(auth.uid(), user_id)
);

CREATE POLICY "org_update_contratos" ON public.contratos_vencimentos FOR UPDATE
USING (
  (auth.uid() = user_id)
  OR (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  OR public.shares_org(auth.uid(), user_id)
);

CREATE POLICY "org_delete_contratos" ON public.contratos_vencimentos FOR DELETE
USING (
  (auth.uid() = user_id)
  OR (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  OR public.shares_org(auth.uid(), user_id)
);
