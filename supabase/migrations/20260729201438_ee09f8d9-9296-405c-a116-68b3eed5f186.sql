CREATE POLICY "Team can view org laudo files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'laudos'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.shares_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);