
-- Restrict org creation: only allow if user has no org yet
DROP POLICY IF EXISTS "Users can create org" ON public.organizacoes;
CREATE POLICY "Users can create org" ON public.organizacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.membros WHERE user_id = auth.uid())
  );
