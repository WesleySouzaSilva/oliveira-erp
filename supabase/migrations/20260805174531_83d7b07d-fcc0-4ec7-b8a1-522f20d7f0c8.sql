-- pos_venda_onboardings
DROP POLICY IF EXISTS pvo_insert_own ON public.pos_venda_onboardings;
CREATE POLICY pvo_insert_own ON public.pos_venda_onboardings FOR INSERT TO authenticated
WITH CHECK (responsavel_id = auth.uid() AND organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid())));

-- analise_contrato_jobs
DROP POLICY IF EXISTS acj_insert_own ON public.analise_contrato_jobs;
CREATE POLICY acj_insert_own ON public.analise_contrato_jobs FOR INSERT TO authenticated
WITH CHECK (operador_id = auth.uid() AND organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid())));

-- atendimentos_notas
DROP POLICY IF EXISTS an_insert_own ON public.atendimentos_notas;
CREATE POLICY an_insert_own ON public.atendimentos_notas FOR INSERT TO authenticated
WITH CHECK (operador_id = auth.uid() AND organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid())));

-- honorarios_calculos
DROP POLICY IF EXISTS hc_insert_org ON public.honorarios_calculos;
CREATE POLICY hc_insert_org ON public.honorarios_calculos FOR INSERT TO authenticated
WITH CHECK (operador_id = auth.uid() AND organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid())));

-- consultoria_simulacoes
DROP POLICY IF EXISTS cs_insert_org ON public.consultoria_simulacoes;
CREATE POLICY cs_insert_org ON public.consultoria_simulacoes FOR INSERT TO authenticated
WITH CHECK (operador_id = auth.uid() AND organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid())));