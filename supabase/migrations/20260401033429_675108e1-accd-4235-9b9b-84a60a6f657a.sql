
-- Step 1: Add organizacao_id column to all tables (nullable first for backfill)
ALTER TABLE public.laudos ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id);
ALTER TABLE public.contratos_vencimentos ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id);
ALTER TABLE public.peticoes ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id);
ALTER TABLE public.atividades_clientes ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id);
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id);
ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id);
ALTER TABLE public.arquivos_cliente ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id);
ALTER TABLE public.laudo_conversas ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id);

-- Step 2: Backfill organizacao_id from membros table
UPDATE public.laudos l SET organizacao_id = (SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = l.user_id LIMIT 1) WHERE l.organizacao_id IS NULL;
UPDATE public.clientes c SET organizacao_id = (SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = c.user_id LIMIT 1) WHERE c.organizacao_id IS NULL;
UPDATE public.contratos_vencimentos cv SET organizacao_id = (SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = cv.user_id LIMIT 1) WHERE cv.organizacao_id IS NULL;
UPDATE public.peticoes p SET organizacao_id = (SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = p.user_id LIMIT 1) WHERE p.organizacao_id IS NULL;
UPDATE public.atividades_clientes a SET organizacao_id = (SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = a.user_id LIMIT 1) WHERE a.organizacao_id IS NULL;
UPDATE public.documentos d SET organizacao_id = (SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = d.user_id LIMIT 1) WHERE d.organizacao_id IS NULL;
UPDATE public.movimentacoes mv SET organizacao_id = (SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = mv.user_id LIMIT 1) WHERE mv.organizacao_id IS NULL;
UPDATE public.arquivos_cliente ac SET organizacao_id = (SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = ac.user_id LIMIT 1) WHERE ac.organizacao_id IS NULL;
UPDATE public.laudo_conversas lc SET organizacao_id = (SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = lc.user_id LIMIT 1) WHERE lc.organizacao_id IS NULL;

-- Step 3: Indexes on new columns
CREATE INDEX IF NOT EXISTS idx_laudos_org ON public.laudos (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_clientes_org ON public.clientes (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_contratos_org ON public.contratos_vencimentos (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_peticoes_org ON public.peticoes (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_atividades_org ON public.atividades_clientes (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_documentos_org ON public.documentos (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_org ON public.movimentacoes (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_org ON public.arquivos_cliente (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_laudo_conversas_org ON public.laudo_conversas (organizacao_id);

-- Step 4: Replace RLS policies using shares_org() with user_org_ids() pattern

-- LAUDOS
DROP POLICY IF EXISTS "Users can view own and org laudos" ON public.laudos;
DROP POLICY IF EXISTS "Users can update own and org laudos" ON public.laudos;
DROP POLICY IF EXISTS "Users can delete own and org laudos" ON public.laudos;
DROP POLICY IF EXISTS "Users can create own laudos" ON public.laudos;

CREATE POLICY "org_select_laudos" ON public.laudos FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_insert_laudos" ON public.laudos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "org_update_laudos" ON public.laudos FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_delete_laudos" ON public.laudos FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);

-- CLIENTES
DROP POLICY IF EXISTS "Users can view own and org clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can create own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can update own and org clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can delete own and org clientes" ON public.clientes;

CREATE POLICY "org_select_clientes" ON public.clientes FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_insert_clientes" ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "org_update_clientes" ON public.clientes FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_delete_clientes" ON public.clientes FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);

-- CONTRATOS_VENCIMENTOS
DROP POLICY IF EXISTS "Users can view own and org contratos" ON public.contratos_vencimentos;
DROP POLICY IF EXISTS "Users can create own contratos" ON public.contratos_vencimentos;
DROP POLICY IF EXISTS "Users can update own and org contratos" ON public.contratos_vencimentos;
DROP POLICY IF EXISTS "Users can delete own and org contratos" ON public.contratos_vencimentos;

CREATE POLICY "org_select_contratos" ON public.contratos_vencimentos FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_insert_contratos" ON public.contratos_vencimentos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "org_update_contratos" ON public.contratos_vencimentos FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_delete_contratos" ON public.contratos_vencimentos FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);

-- PETICOES
DROP POLICY IF EXISTS "Users can view own and org peticoes" ON public.peticoes;
DROP POLICY IF EXISTS "Users can create own peticoes" ON public.peticoes;
DROP POLICY IF EXISTS "Users can update own and org peticoes" ON public.peticoes;
DROP POLICY IF EXISTS "Users can delete own and org peticoes" ON public.peticoes;

CREATE POLICY "org_select_peticoes" ON public.peticoes FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_insert_peticoes" ON public.peticoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "org_update_peticoes" ON public.peticoes FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_delete_peticoes" ON public.peticoes FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);

-- ATIVIDADES_CLIENTES
DROP POLICY IF EXISTS "Users can view own and org atividades" ON public.atividades_clientes;
DROP POLICY IF EXISTS "Users can create own atividades" ON public.atividades_clientes;
DROP POLICY IF EXISTS "Users can update own and org atividades" ON public.atividades_clientes;
DROP POLICY IF EXISTS "Users can delete own and org atividades" ON public.atividades_clientes;

CREATE POLICY "org_select_atividades" ON public.atividades_clientes FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_insert_atividades" ON public.atividades_clientes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "org_update_atividades" ON public.atividades_clientes FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_delete_atividades" ON public.atividades_clientes FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);

-- DOCUMENTOS
DROP POLICY IF EXISTS "Users can view own and org docs" ON public.documentos;
DROP POLICY IF EXISTS "Users can create own docs" ON public.documentos;
DROP POLICY IF EXISTS "Users can delete own and org docs" ON public.documentos;

CREATE POLICY "org_select_docs" ON public.documentos FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_insert_docs" ON public.documentos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "org_delete_docs" ON public.documentos FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);

-- MOVIMENTACOES (keep processo-based access but add org fallback)
DROP POLICY IF EXISTS "Users can view own and org movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Users can create own movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Users can delete own movimentacoes" ON public.movimentacoes;

CREATE POLICY "org_select_movimentacoes" ON public.movimentacoes FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_insert_movimentacoes" ON public.movimentacoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "org_delete_movimentacoes" ON public.movimentacoes FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);

-- ARQUIVOS_CLIENTE
DROP POLICY IF EXISTS "Users can view own and org arquivos_cliente" ON public.arquivos_cliente;
DROP POLICY IF EXISTS "Users can create own arquivos_cliente" ON public.arquivos_cliente;
DROP POLICY IF EXISTS "Users can delete own and org arquivos_cliente" ON public.arquivos_cliente;

CREATE POLICY "org_select_arquivos" ON public.arquivos_cliente FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_insert_arquivos" ON public.arquivos_cliente FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "org_delete_arquivos" ON public.arquivos_cliente FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);

-- LAUDO_CONVERSAS
DROP POLICY IF EXISTS "Org members can view laudo conversations" ON public.laudo_conversas;
DROP POLICY IF EXISTS "Users can manage own laudo conversations" ON public.laudo_conversas;

CREATE POLICY "org_select_laudo_conversas" ON public.laudo_conversas FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) OR auth.uid() = user_id);
CREATE POLICY "org_manage_laudo_conversas" ON public.laudo_conversas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
