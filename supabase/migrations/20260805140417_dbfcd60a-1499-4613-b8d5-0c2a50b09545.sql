-- bug_reports: escopar admin à organização do autor do relato
DROP POLICY IF EXISTS "Admins can view all bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Admins can update bug reports" ON public.bug_reports;

CREATE POLICY "Org admins can view bug reports"
ON public.bug_reports FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_org_ids(bug_reports.user_id) AS oid
    WHERE public.is_admin_in_org(auth.uid(), oid)
  )
);

CREATE POLICY "Org admins can update bug reports"
ON public.bug_reports FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_org_ids(bug_reports.user_id) AS oid
    WHERE public.is_admin_in_org(auth.uid(), oid)
  )
);

-- organizacoes: admin precisa ser admin DAQUELA organização
DROP POLICY IF EXISTS "Admins can update org" ON public.organizacoes;
CREATE POLICY "Admins can update org"
ON public.organizacoes FOR UPDATE TO authenticated
USING (public.is_admin_in_org(auth.uid(), id))
WITH CHECK (public.is_admin_in_org(auth.uid(), id));

-- tarefas: criar/excluir exige admin da organização alvo
DROP POLICY IF EXISTS "Admins can create tasks" ON public.tarefas;
CREATE POLICY "Admins can create tasks"
ON public.tarefas FOR INSERT TO authenticated
WITH CHECK (public.is_admin_in_org(auth.uid(), organizacao_id));

DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tarefas;
CREATE POLICY "Admins can delete tasks"
ON public.tarefas FOR DELETE TO authenticated
USING (public.is_admin_in_org(auth.uid(), organizacao_id));