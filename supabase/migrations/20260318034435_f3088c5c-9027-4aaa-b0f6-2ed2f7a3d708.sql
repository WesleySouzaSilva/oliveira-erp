
-- Fix privilege escalation: scope has_role to specific organization
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros
    WHERE user_id = _user_id AND papel = _role
  );
$$;

-- New function: check role within specific org
CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id uuid, _role app_role, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros
    WHERE user_id = _user_id AND papel = _role AND organizacao_id = _org_id
  );
$$;

-- Fix membros policy: scope admin check to same org
DROP POLICY IF EXISTS "Admins can manage membros" ON public.membros;
CREATE POLICY "Admins can manage membros" ON public.membros
  FOR ALL TO authenticated
  USING (
    organizacao_id IN (SELECT user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.membros m
      WHERE m.user_id = auth.uid()
        AND m.organizacao_id = membros.organizacao_id
        AND m.papel = 'admin'
    )
  );

-- Update laudos SELECT policy: admin of user's org can view member laudos
DROP POLICY IF EXISTS "Users can view own laudos" ON public.laudos;
CREATE POLICY "Users can view own laudos" ON public.laudos
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.membros admin_m
      JOIN public.membros user_m ON admin_m.organizacao_id = user_m.organizacao_id
      WHERE admin_m.user_id = auth.uid()
        AND admin_m.papel = 'admin'
        AND user_m.user_id = laudos.user_id
    )
  );

-- Also allow admin to view contratos of org members
DROP POLICY IF EXISTS "Users can view own contratos" ON public.contratos_vencimentos;
CREATE POLICY "Users can view own contratos" ON public.contratos_vencimentos
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.membros admin_m
      JOIN public.membros user_m ON admin_m.organizacao_id = user_m.organizacao_id
      WHERE admin_m.user_id = auth.uid()
        AND admin_m.papel = 'admin'
        AND user_m.user_id = contratos_vencimentos.user_id
    )
  );

-- Add INSERT policy for membros so admin can invite
DROP POLICY IF EXISTS "Admins can insert membros" ON public.membros;
CREATE POLICY "Admins can insert membros" ON public.membros
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.membros m
      WHERE m.user_id = auth.uid()
        AND m.organizacao_id = membros.organizacao_id
        AND m.papel = 'admin'
    )
  );

-- Allow admins to create organizations (first org setup)
DROP POLICY IF EXISTS "Users can create org" ON public.organizacoes;
CREATE POLICY "Users can create org" ON public.organizacoes
  FOR INSERT TO authenticated
  WITH CHECK (true);
