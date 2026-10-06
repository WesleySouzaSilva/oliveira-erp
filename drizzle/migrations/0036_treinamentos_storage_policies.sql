-- caminho: {organizacao_id}/{trilha_id}/{arquivo}
CREATE OR REPLACE FUNCTION public.trein_uuid_seguro(_t text) RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN _t::uuid; EXCEPTION WHEN others THEN RETURN NULL; END $$;
REVOKE ALL ON FUNCTION public.trein_uuid_seguro(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trein_uuid_seguro(text) TO authenticated, service_role;

CREATE POLICY "trein_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'treinamentos' AND public.trein_pode_ver_trilha(auth.uid(), public.trein_uuid_seguro((storage.foldername(name))[2])));
CREATE POLICY "trein_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'treinamentos' AND public.trein_pode_editar_trilha(auth.uid(), public.trein_uuid_seguro((storage.foldername(name))[2])));
CREATE POLICY "trein_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'treinamentos' AND public.trein_pode_editar_trilha(auth.uid(), public.trein_uuid_seguro((storage.foldername(name))[2])));
CREATE POLICY "trein_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'treinamentos' AND public.trein_pode_editar_trilha(auth.uid(), public.trein_uuid_seguro((storage.foldername(name))[2])));
