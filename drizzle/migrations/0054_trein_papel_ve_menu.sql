CREATE OR REPLACE FUNCTION public.trein_meu_papel()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'admin', coalesce(bool_or(public.trein_is_admin(auth.uid(), m.organizacao_id)), false),
    'gestor', coalesce(bool_or(public.trein_is_gestor(auth.uid(), m.organizacao_id)), false),
    'lider_provas', coalesce(bool_or(public.prova_is_lider(auth.uid(), m.organizacao_id)), false),
    'organizacao_id', min(m.organizacao_id::text),
    'lider_setores', coalesce((SELECT jsonb_agg(setor_id) FROM public.membro_setores WHERE user_id=auth.uid() AND lider), '[]'::jsonb),
    've_menu', coalesce(bool_or(public.trein_is_gestor(auth.uid(), m.organizacao_id)), false)
      OR EXISTS (SELECT 1 FROM public.trein_atribuicoes a WHERE a.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.trein_trilhas t WHERE t.publicada AND NOT t.arquivada
                 AND t.setor_id IN (SELECT public.trein_setores_visiveis(auth.uid()))))
  FROM public.membros m WHERE m.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.trein_papel_de(_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN public.ver_como_pode(_user) IS NULL THEN NULL ELSE (
    SELECT jsonb_build_object(
      'admin', coalesce(bool_or(public.trein_is_admin(_user, m.organizacao_id)), false),
      'gestor', coalesce(bool_or(public.trein_is_gestor(_user, m.organizacao_id)), false),
      'lider_provas', coalesce(bool_or(public.prova_is_lider(_user, m.organizacao_id)), false),
      'organizacao_id', min(m.organizacao_id::text),
      'lider_setores', coalesce((SELECT jsonb_agg(setor_id) FROM public.membro_setores WHERE user_id=_user AND lider), '[]'::jsonb),
      've_menu', coalesce(bool_or(public.trein_is_gestor(_user, m.organizacao_id)), false)
        OR EXISTS (SELECT 1 FROM public.trein_atribuicoes a WHERE a.user_id = _user)
        OR EXISTS (SELECT 1 FROM public.trein_trilhas t WHERE t.publicada AND NOT t.arquivada
                   AND t.setor_id IN (SELECT public.trein_setores_visiveis(_user))))
    FROM public.membros m WHERE m.user_id = _user) END
$$;

REVOKE ALL ON FUNCTION public.trein_meu_papel() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trein_papel_de(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trein_meu_papel() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trein_papel_de(uuid) TO authenticated, service_role;