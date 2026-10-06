CREATE POLICY "Org members can view colleague profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT m2.user_id FROM membros m1
    JOIN membros m2 ON m1.organizacao_id = m2.organizacao_id
    WHERE m1.user_id = auth.uid()
  )
);