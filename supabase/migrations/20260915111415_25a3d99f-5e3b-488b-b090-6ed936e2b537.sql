DROP POLICY IF EXISTS "Members can create tasks" ON public.tarefas;
CREATE POLICY "Members can create tasks"
ON public.tarefas FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
);