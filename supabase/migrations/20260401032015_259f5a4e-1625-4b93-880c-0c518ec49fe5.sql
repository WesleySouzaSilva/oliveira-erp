CREATE OR REPLACE FUNCTION public.has_comercial_access(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros
    WHERE user_id = _user_id
      AND organizacao_id = _org_id
      AND papel IN ('admin', 'comercial', 'coordenador', 'closer', 'sdr', 'social_seller')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_marketing_access(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros
    WHERE user_id = _user_id
      AND organizacao_id = _org_id
      AND papel IN ('admin', 'marketing', 'coordenador', 'gerente_marketing', 'criacao', 'copywriter', 'social_media')
  );
$$;