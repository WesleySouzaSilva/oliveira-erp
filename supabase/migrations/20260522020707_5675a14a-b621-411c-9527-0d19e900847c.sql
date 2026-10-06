
-- 1) Cross-org INSERT fix on mkt_* tables
DROP POLICY IF EXISTS mkt_lanc_insert_org ON public.mkt_lancamentos_diarios;
CREATE POLICY mkt_lanc_insert_org ON public.mkt_lancamentos_diarios
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND user_id = auth.uid());

DROP POLICY IF EXISTS mkt_org_insert_org ON public.mkt_leads_organicos_origem;
CREATE POLICY mkt_org_insert_org ON public.mkt_leads_organicos_origem
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND user_id = auth.uid());

DROP POLICY IF EXISTS mkt_metas_ind_insert_org ON public.mkt_metas_individuais;
CREATE POLICY mkt_metas_ind_insert_org ON public.mkt_metas_individuais
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND user_id = auth.uid());

DROP POLICY IF EXISTS mkt_metas_insert_org ON public.mkt_metas_mensais;
CREATE POLICY mkt_metas_insert_org ON public.mkt_metas_mensais
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND user_id = auth.uid());

-- 2) Storage: cliente-drive scoping by org of file owner (first folder = user_id)
DROP POLICY IF EXISTS "Authenticated users can read from cliente-drive" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from cliente-drive" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to cliente-drive" ON storage.objects;

CREATE POLICY "cliente_drive_read_org" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cliente-drive'
    AND public.shares_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "cliente_drive_insert_self" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cliente-drive'
    AND ((storage.foldername(name))[1])::uuid = auth.uid()
  );

CREATE POLICY "cliente_drive_delete_org" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cliente-drive'
    AND public.shares_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 3) Avatars: admin upload restricted to users in same org
DROP POLICY IF EXISTS "Admins can upload member avatars" ON storage.objects;
CREATE POLICY "Admins can upload member avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.shares_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND EXISTS (
      SELECT 1 FROM public.membros m
      WHERE m.user_id = auth.uid() AND m.papel = 'admin'::app_role
    )
  );

-- 4) Realtime channel authorization: users may only subscribe to their own user/org topics
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "realtime_authenticated_own_topics" ON realtime.messages;
CREATE POLICY "realtime_authenticated_own_topics" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() = ('user:' || auth.uid()::text)
    OR realtime.topic() IN (
      SELECT 'org:' || organizacao_id::text FROM public.membros WHERE user_id = auth.uid()
    )
    OR realtime.topic() = ANY (ARRAY['public:laudos','public:tarefas','public:notificacoes_sistema'])
       AND false  -- block legacy broad topics
  );

-- 5) Fix search_path on functions missing it
ALTER FUNCTION public.f_unaccent(text) SET search_path = public;
ALTER FUNCTION public.normalize_search(text) SET search_path = public;
