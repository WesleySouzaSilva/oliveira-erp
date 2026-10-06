
-- Allow authenticated users to insert notifications (for automated workflow)
CREATE POLICY "Authenticated users can create notifications"
  ON public.notificacoes_sistema
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
