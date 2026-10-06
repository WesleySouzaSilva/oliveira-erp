DROP POLICY IF EXISTS "Users can add self or admins can add" ON public.membros;
CREATE POLICY "Admins can add membros to own org"
ON public.membros FOR INSERT TO authenticated
WITH CHECK (public.is_admin_in_org(auth.uid(), organizacao_id));