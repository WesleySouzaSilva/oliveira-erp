-- arquivos_cliente
DROP POLICY IF EXISTS org_insert_arquivos ON public.arquivos_cliente;
CREATE POLICY org_insert_arquivos ON public.arquivos_cliente
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND (organizacao_id IS NULL OR organizacao_id IN (SELECT public.user_org_ids(auth.uid()))));

-- atividades_clientes
DROP POLICY IF EXISTS org_insert_atividades ON public.atividades_clientes;
CREATE POLICY org_insert_atividades ON public.atividades_clientes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND (organizacao_id IS NULL OR organizacao_id IN (SELECT public.user_org_ids(auth.uid()))));

-- clientes
DROP POLICY IF EXISTS org_insert_clientes ON public.clientes;
CREATE POLICY org_insert_clientes ON public.clientes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND (organizacao_id IS NULL OR organizacao_id IN (SELECT public.user_org_ids(auth.uid()))));

DROP POLICY IF EXISTS "Users can manage own clientes" ON public.clientes;
CREATE POLICY "Users can manage own clientes" ON public.clientes
FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR public.shares_org(auth.uid(), user_id));

-- contratos_vencimentos
DROP POLICY IF EXISTS org_insert_contratos ON public.contratos_vencimentos;
CREATE POLICY org_insert_contratos ON public.contratos_vencimentos
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND (organizacao_id IS NULL OR organizacao_id IN (SELECT public.user_org_ids(auth.uid()))));

-- documentos
DROP POLICY IF EXISTS org_insert_docs ON public.documentos;
CREATE POLICY org_insert_docs ON public.documentos
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND (organizacao_id IS NULL OR organizacao_id IN (SELECT public.user_org_ids(auth.uid()))));

-- laudos
DROP POLICY IF EXISTS org_insert_laudos ON public.laudos;
CREATE POLICY org_insert_laudos ON public.laudos
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND (organizacao_id IS NULL OR organizacao_id IN (SELECT public.user_org_ids(auth.uid()))));

-- movimentacoes
DROP POLICY IF EXISTS org_insert_movimentacoes ON public.movimentacoes;
DROP POLICY IF EXISTS "Users can create movimentacoes" ON public.movimentacoes;
CREATE POLICY org_insert_movimentacoes ON public.movimentacoes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND (organizacao_id IS NULL OR organizacao_id IN (SELECT public.user_org_ids(auth.uid()))));

-- peticoes
DROP POLICY IF EXISTS org_insert_peticoes ON public.peticoes;
CREATE POLICY org_insert_peticoes ON public.peticoes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND (organizacao_id IS NULL OR organizacao_id IN (SELECT public.user_org_ids(auth.uid()))));