
-- Create a SECURITY DEFINER function to check admin in org without hitting RLS
CREATE OR REPLACE FUNCTION public.is_admin_in_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros
    WHERE user_id = _user_id
      AND organizacao_id = _org_id
      AND papel = 'admin'::app_role
  )
$$;

-- Create a SECURITY DEFINER function to check if user is member of any org
CREATE OR REPLACE FUNCTION public.is_member_anywhere(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros WHERE user_id = _user_id
  )
$$;

-- Drop all existing membros policies
DROP POLICY IF EXISTS "Admins can delete membros" ON public.membros;
DROP POLICY IF EXISTS "Admins can manage membros" ON public.membros;
DROP POLICY IF EXISTS "Members can view membros of own org" ON public.membros;
DROP POLICY IF EXISTS "Users can add self or admins can add" ON public.membros;

-- Recreate without self-referencing subqueries
CREATE POLICY "Members can view membros of own org"
ON public.membros FOR SELECT TO public
USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY "Users can add self or admins can add"
ON public.membros FOR INSERT TO authenticated
WITH CHECK (
  ((user_id = auth.uid()) AND NOT is_member_anywhere(auth.uid()))
  OR is_admin_in_org(auth.uid(), organizacao_id)
);

CREATE POLICY "Admins can update membros"
ON public.membros FOR UPDATE TO authenticated
USING (is_admin_in_org(auth.uid(), organizacao_id));

CREATE POLICY "Admins can delete membros"
ON public.membros FOR DELETE TO authenticated
USING (is_admin_in_org(auth.uid(), organizacao_id) AND user_id <> auth.uid());

-- Fix laudos SELECT policy to avoid joining membros directly
DROP POLICY IF EXISTS "Users can view own laudos" ON public.laudos;
CREATE POLICY "Users can view own laudos"
ON public.laudos FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.membros admin_m
    WHERE admin_m.user_id = auth.uid()
      AND admin_m.papel = 'admin'::app_role
      AND admin_m.organizacao_id IN (SELECT user_org_ids(auth.uid()))
  )
);

-- Fix contratos_vencimentos SELECT policy
DROP POLICY IF EXISTS "Users can view own contratos" ON public.contratos_vencimentos;
CREATE POLICY "Users can view own contratos"
ON public.contratos_vencimentos FOR SELECT TO authenticated
USING (auth.uid() = user_id);
