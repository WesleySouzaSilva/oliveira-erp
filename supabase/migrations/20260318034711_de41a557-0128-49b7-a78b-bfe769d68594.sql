
-- Allow users to insert themselves as member when creating their first org
DROP POLICY IF EXISTS "Admins can insert membros" ON public.membros;
CREATE POLICY "Users can add self or admins can add" ON public.membros
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Self-insert (creating own org for first time)
    (user_id = auth.uid() AND NOT EXISTS (
      SELECT 1 FROM public.membros m WHERE m.user_id = auth.uid()
    ))
    OR
    -- Admin of the org can invite
    EXISTS (
      SELECT 1 FROM public.membros m
      WHERE m.user_id = auth.uid()
        AND m.organizacao_id = membros.organizacao_id
        AND m.papel = 'admin'
    )
  );

-- Allow admin to delete membros
DROP POLICY IF EXISTS "Admins can delete membros" ON public.membros;
CREATE POLICY "Admins can delete membros" ON public.membros
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.membros m
      WHERE m.user_id = auth.uid()
        AND m.organizacao_id = membros.organizacao_id
        AND m.papel = 'admin'
    )
    AND user_id != auth.uid()
  );
