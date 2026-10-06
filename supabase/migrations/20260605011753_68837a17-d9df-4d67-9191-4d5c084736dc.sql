DROP POLICY IF EXISTS "ver conversas que sou membro" ON public.conversas;

CREATE POLICY "ver conversas que sou membro ou criador"
ON public.conversas
FOR SELECT
TO authenticated
USING (
  public.is_conversa_member(auth.uid(), id)
  OR criada_por = auth.uid()
);