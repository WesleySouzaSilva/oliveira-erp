-- 1) acordos_tarefas: faltava política de DELETE (fail-closed) e WITH CHECK no UPDATE
DROP POLICY IF EXISTS member_update_own_acordos ON public.acordos_tarefas;
CREATE POLICY member_update_own_acordos ON public.acordos_tarefas
  FOR UPDATE TO authenticated
  USING (
    ((responsavel_id = auth.uid()) OR (created_by = auth.uid()))
    AND organizacao_id IN (SELECT user_org_ids(auth.uid()))
  )
  WITH CHECK (
    ((responsavel_id = auth.uid()) OR (created_by = auth.uid()))
    AND organizacao_id IN (SELECT user_org_ids(auth.uid()))
  );

DROP POLICY IF EXISTS member_delete_own_acordos ON public.acordos_tarefas;
CREATE POLICY member_delete_own_acordos ON public.acordos_tarefas
  FOR DELETE TO authenticated
  USING (
    ((responsavel_id = auth.uid()) OR (created_by = auth.uid()))
    AND organizacao_id IN (SELECT user_org_ids(auth.uid()))
  );

-- 2) arquivos_cliente: exigir organização (evita arquivos fora da fronteira multi-tenant)
DROP POLICY IF EXISTS org_insert_arquivos ON public.arquivos_cliente;
CREATE POLICY org_insert_arquivos ON public.arquivos_cliente
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND organizacao_id IS NOT NULL
    AND organizacao_id IN (SELECT user_org_ids(auth.uid()))
  );

DROP POLICY IF EXISTS org_select_arquivos ON public.arquivos_cliente;
CREATE POLICY org_select_arquivos ON public.arquivos_cliente
  FOR SELECT TO authenticated
  USING (
    (organizacao_id IN (SELECT user_org_ids(auth.uid())))
    OR (organizacao_id IS NULL AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS org_update_arquivos ON public.arquivos_cliente;
CREATE POLICY org_update_arquivos ON public.arquivos_cliente
  FOR UPDATE TO authenticated
  USING (
    (organizacao_id IN (SELECT user_org_ids(auth.uid())))
    OR (organizacao_id IS NULL AND auth.uid() = user_id)
  )
  WITH CHECK (
    (organizacao_id IN (SELECT user_org_ids(auth.uid())))
    OR (organizacao_id IS NULL AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS org_delete_arquivos ON public.arquivos_cliente;
CREATE POLICY org_delete_arquivos ON public.arquivos_cliente
  FOR DELETE TO authenticated
  USING (
    (organizacao_id IN (SELECT user_org_ids(auth.uid())))
    OR (organizacao_id IS NULL AND auth.uid() = user_id)
  );

-- 3) membros: admin não pode alterar o próprio papel (auto-escalação) e o UPDATE ganha WITH CHECK
DROP POLICY IF EXISTS "Admins can update membros" ON public.membros;
CREATE POLICY "Admins can update membros" ON public.membros
  FOR UPDATE TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

CREATE OR REPLACE FUNCTION public.bloquear_autoalteracao_papel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id = auth.uid()
     AND OLD.user_id = auth.uid()
     AND NEW.papel IS DISTINCT FROM OLD.papel THEN
    RAISE EXCEPTION 'Você não pode alterar o próprio papel';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_autoalteracao_papel ON public.membros;
CREATE TRIGGER trg_bloquear_autoalteracao_papel
  BEFORE UPDATE ON public.membros
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_autoalteracao_papel();

-- 4) profiles: colegas de organização não devem ver dados pessoais (telefone, assinatura, vínculo)
DROP POLICY IF EXISTS "Org members can view colleague profiles" ON public.profiles;

CREATE OR REPLACE VIEW public.profiles_publico
WITH (security_invoker = true) AS
  SELECT id, nome, foto_url, cargo, setor, unidade, ativo
  FROM public.profiles;

GRANT SELECT ON public.profiles_publico TO authenticated;

CREATE POLICY "Org members can view colleague profiles" ON public.profiles
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
    OR EXISTS (
      SELECT 1 FROM public.membros m1
      JOIN public.membros m2 ON m1.organizacao_id = m2.organizacao_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
    )
  );