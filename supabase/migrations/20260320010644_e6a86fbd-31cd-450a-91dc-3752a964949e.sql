
-- Drop overly permissive policy and replace with scoped one
DROP POLICY "Authenticated users can create notifications" ON public.notificacoes_sistema;

CREATE POLICY "Users can create notifications for org members"
  ON public.notificacoes_sistema
  FOR INSERT
  TO authenticated
  WITH CHECK (shares_org(auth.uid(), user_id) OR auth.uid() = user_id);
