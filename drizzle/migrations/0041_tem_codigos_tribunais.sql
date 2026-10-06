-- Portão leve do item de menu "Códigos dos Tribunais". Espelha a regra da
-- função totp-tribunais (listar): admin ou custodiante vê; demais só com
-- acesso concedido a credencial ativa. Devolve apenas true/false, nunca segredo.
CREATE OR REPLACE FUNCTION public.tem_codigos_tribunais()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH m AS (
    SELECT organizacao_id, papel FROM public.membros
    WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1
  )
  SELECT COALESCE((
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo = false) THEN false
      WHEN m.papel = 'admin' THEN true
      WHEN EXISTS (SELECT 1 FROM public.tj_custodiantes c WHERE c.organizacao_id = m.organizacao_id AND c.user_id = auth.uid()) THEN true
      ELSE EXISTS (
        SELECT 1 FROM public.tj_credencial_acessos a
        JOIN public.tj_credenciais cr ON cr.id = a.credencial_id
        WHERE a.user_id = auth.uid() AND cr.organizacao_id = m.organizacao_id AND cr.ativo = true
      )
    END FROM m
  ), false)
$$;
REVOKE ALL ON FUNCTION public.tem_codigos_tribunais() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_codigos_tribunais() TO authenticated, service_role;