CREATE POLICY "Users can delete own processos"
ON public.processos FOR DELETE
TO authenticated
USING (auth.uid() = user_id);