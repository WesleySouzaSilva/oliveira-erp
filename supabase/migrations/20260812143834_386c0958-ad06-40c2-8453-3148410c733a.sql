-- 1) UPDATE policies: add WITH CHECK to prevent cross-org reassignment
DO $$
DECLARE r record; has_org boolean; wc text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'UPDATE'
      AND with_check IS NULL
      AND qual IS NOT NULL
      AND tablename IN ('clientes','movimentacoes','atividades_clientes','arquivos_cliente',
        'contratos_vencimentos','documentos','peticoes','honorarios_calculos','consultoria_simulacoes',
        'atendimentos_notas','workflow_tarefas','mkt_leads_diarios','mkt_lancamentos_diarios',
        'mkt_metas_mensais','mkt_metas_individuais','mkt_leads_organicos_origem','mkt_contratos_fechados',
        'comercial_leads','comercial_atividades')
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=r.tablename AND c.column_name='organizacao_id'
    ) INTO has_org;

    wc := '(' || r.qual || ')';
    IF has_org THEN
      wc := wc || ' AND (organizacao_id IS NULL OR organizacao_id IN (SELECT public.user_org_ids(auth.uid())))';
    END IF;

    EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
      r.policyname, r.tablename, r.qual, wc);
  END LOOP;
END $$;

-- 2) Scope policies on user-data tables to the authenticated role only
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = '{public}'
      AND tablename IN ('templates_conclusao','laudos','movimentacoes','notificacoes_sistema',
        'documentos','peticoes','dados_climaticos','analises_ia')
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3) cliente-drive: stop trusting the folder name alone for cross-user access
DROP POLICY IF EXISTS "cliente_drive_read_org" ON storage.objects;
DROP POLICY IF EXISTS "cliente_drive_delete_org" ON storage.objects;

CREATE POLICY "cliente_drive_read_org" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'cliente-drive'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.arquivos_cliente a
      WHERE a.storage_path = storage.objects.name
        AND a.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.atividades_clientes t
      WHERE t.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
        AND (t.anexo_url = storage.objects.name OR storage.objects.name = ANY (t.anexos_urls))
    )
  )
);

CREATE POLICY "cliente_drive_delete_org" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'cliente-drive'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.arquivos_cliente a
      WHERE a.storage_path = storage.objects.name
        AND a.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.atividades_clientes t
      WHERE t.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
        AND (t.anexo_url = storage.objects.name OR storage.objects.name = ANY (t.anexos_urls))
    )
  )
);