
-- LAUDOS: allow org members full access
DROP POLICY IF EXISTS "Users can update own laudos" ON public.laudos;
CREATE POLICY "Users can update own and org laudos"
ON public.laudos FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own laudos" ON public.laudos;
CREATE POLICY "Users can delete own and org laudos"
ON public.laudos FOR DELETE TO authenticated
USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

-- CONTRATOS_VENCIMENTOS: allow org members full access
DROP POLICY IF EXISTS "Users can update own contratos" ON public.contratos_vencimentos;
CREATE POLICY "Users can update own and org contratos"
ON public.contratos_vencimentos FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own contratos" ON public.contratos_vencimentos;
CREATE POLICY "Users can delete own and org contratos"
ON public.contratos_vencimentos FOR DELETE TO authenticated
USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

-- ATIVIDADES_CLIENTES: allow org members full access
DROP POLICY IF EXISTS "Users can update own atividades" ON public.atividades_clientes;
CREATE POLICY "Users can update own and org atividades"
ON public.atividades_clientes FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own atividades" ON public.atividades_clientes;
CREATE POLICY "Users can delete own and org atividades"
ON public.atividades_clientes FOR DELETE TO authenticated
USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

-- PROCESSOS: allow org members full access
DROP POLICY IF EXISTS "Users can update own processos" ON public.processos;
CREATE POLICY "Users can update own and org processos"
ON public.processos FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR organizacao_id IN (SELECT user_org_ids(auth.uid())) OR shares_org(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own processos" ON public.processos;
CREATE POLICY "Users can delete own and org processos"
ON public.processos FOR DELETE TO authenticated
USING (auth.uid() = user_id OR organizacao_id IN (SELECT user_org_ids(auth.uid())) OR shares_org(auth.uid(), user_id));

-- DOCUMENTOS: allow org members to manage docs
DROP POLICY IF EXISTS "Users can delete own docs" ON public.documentos;
CREATE POLICY "Users can delete own and org docs"
ON public.documentos FOR DELETE TO authenticated
USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

-- PETICOES: allow org members full access
DROP POLICY IF EXISTS "Users can update own peticoes" ON public.peticoes;
CREATE POLICY "Users can update own and org peticoes"
ON public.peticoes FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own peticoes" ON public.peticoes;
CREATE POLICY "Users can delete own and org peticoes"
ON public.peticoes FOR DELETE TO authenticated
USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can view own peticoes" ON public.peticoes;
CREATE POLICY "Users can view own and org peticoes"
ON public.peticoes FOR SELECT TO authenticated
USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));
