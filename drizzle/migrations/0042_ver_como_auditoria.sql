CREATE OR REPLACE FUNCTION public.ver_como_pode(_alvo uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT a.organizacao_id FROM public.membros a
  WHERE a.user_id = _alvo
    AND a.user_id <> auth.uid()
    AND (public.is_admin_in_org(auth.uid(), a.organizacao_id)
         OR EXISTS (SELECT 1 FROM public.membros c WHERE c.user_id = auth.uid() AND c.organizacao_id = a.organizacao_id AND c.is_ceo))
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.ver_como_registrar(_alvo uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _org uuid;
BEGIN
  _org := public.ver_como_pode(_alvo);
  IF _org IS NULL THEN RETURN false; END IF;
  INSERT INTO public.audit_log(organizacao_id, tabela, registro_id, acao, user_id, dados_novos)
  VALUES (_org, 'ver_como', _alvo, 'VER_COMO_INICIO', auth.uid(), jsonb_build_object('alvo_user_id', _alvo, 'somente_leitura', true));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.trein_papel_de(_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN public.ver_como_pode(_user) IS NULL THEN NULL ELSE (
    SELECT jsonb_build_object(
      'admin', coalesce(bool_or(public.trein_is_admin(_user, m.organizacao_id)), false),
      'gestor', coalesce(bool_or(public.trein_is_gestor(_user, m.organizacao_id)), false),
      'lider_provas', coalesce(bool_or(public.prova_is_lider(_user, m.organizacao_id)), false),
      'organizacao_id', min(m.organizacao_id::text),
      'lider_setores', coalesce((SELECT jsonb_agg(setor_id) FROM public.membro_setores WHERE user_id=_user AND lider), '[]'::jsonb))
    FROM public.membros m WHERE m.user_id = _user) END
$$;

REVOKE ALL ON FUNCTION public.ver_como_pode(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ver_como_registrar(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trein_papel_de(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ver_como_pode(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ver_como_registrar(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trein_papel_de(uuid) TO authenticated, service_role;