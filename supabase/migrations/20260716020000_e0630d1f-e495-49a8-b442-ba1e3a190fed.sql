
CREATE OR REPLACE FUNCTION public.can_view_consultoria_financeiro(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_ceo(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.membros
      WHERE user_id = _user_id
        AND organizacao_id = _org_id
        AND papel IN ('admin'::app_role, 'coordenador'::app_role)
    );
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_consultoria_financeiro(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_consultoria_financeiro(uuid, uuid) TO authenticated, service_role;
