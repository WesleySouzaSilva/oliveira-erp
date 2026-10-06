-- Perfis: dados pessoais (telefone, assinatura, CREA, nível salarial) deixam de ser
-- visíveis para todos os colegas. Colegas passam a usar a visão pública reduzida.
DROP POLICY IF EXISTS "Org members can view colleague profiles" ON public.profiles;

CREATE POLICY "Admins can view org member profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.membros m1
      JOIN public.membros m2 ON m1.organizacao_id = m2.organizacao_id
      WHERE m1.user_id = auth.uid()
        AND m2.user_id = public.profiles.id
        AND m1.papel = 'admin'::app_role
    )
  );

DROP VIEW IF EXISTS public.profiles_publico;
CREATE VIEW public.profiles_publico AS
  SELECT p.id, p.nome, p.foto_url, p.cargo, p.setor, p.unidade, p.ativo,
         p.lider_id, p.regime_trabalho, p.data_entrada
  FROM public.profiles p
  WHERE p.id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM public.membros m1
       JOIN public.membros m2 ON m1.organizacao_id = m2.organizacao_id
       WHERE m1.user_id = auth.uid() AND m2.user_id = p.id
     );

REVOKE ALL ON public.profiles_publico FROM anon;
GRANT SELECT ON public.profiles_publico TO authenticated;