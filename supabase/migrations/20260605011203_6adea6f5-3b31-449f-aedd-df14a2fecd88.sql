DROP POLICY IF EXISTS "criar conversas na minha org" ON public.conversas;

CREATE POLICY "criar conversas na minha org"
  ON public.conversas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    criada_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.membros m
      WHERE m.user_id = auth.uid()
        AND m.organizacao_id = conversas.organizacao_id
    )
  );