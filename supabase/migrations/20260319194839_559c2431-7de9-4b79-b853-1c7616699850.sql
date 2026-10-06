
-- Helper function: check if two users share an org
CREATE OR REPLACE FUNCTION public.shares_org(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membros m1
    JOIN membros m2 ON m1.organizacao_id = m2.organizacao_id
    WHERE m1.user_id = _user_a AND m2.user_id = _user_b
  );
$$;

-- 1. LAUDOS: drop old SELECT, create new one allowing org members
DROP POLICY IF EXISTS "Users can view own laudos" ON public.laudos;
CREATE POLICY "Users can view own and org laudos"
ON public.laudos FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR shares_org(auth.uid(), user_id)
);

-- 2. CONTRATOS_VENCIMENTOS: drop old SELECT, create new one
DROP POLICY IF EXISTS "Users can view own contratos" ON public.contratos_vencimentos;
CREATE POLICY "Users can view own and org contratos"
ON public.contratos_vencimentos FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR shares_org(auth.uid(), user_id)
);

-- 3. ATIVIDADES_CLIENTES: drop old SELECT, create new one
DROP POLICY IF EXISTS "Users can view own atividades" ON public.atividades_clientes;
CREATE POLICY "Users can view own and org atividades"
ON public.atividades_clientes FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR shares_org(auth.uid(), user_id)
);

-- 4. PROCESSOS: already has org-based access but let's also cover cases where organizacao_id is null
DROP POLICY IF EXISTS "Users can view own processos" ON public.processos;
CREATE POLICY "Users can view own and org processos"
ON public.processos FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR organizacao_id IN (SELECT user_org_ids(auth.uid()))
  OR shares_org(auth.uid(), user_id)
);

-- 5. DOCUMENTOS: allow org members to view docs
DROP POLICY IF EXISTS "Users can view own docs" ON public.documentos;
CREATE POLICY "Users can view own and org docs"
ON public.documentos FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR shares_org(auth.uid(), user_id)
);
