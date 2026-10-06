DROP POLICY IF EXISTS trilhas_select ON public.trein_trilhas;
CREATE POLICY trilhas_select ON public.trein_trilhas FOR SELECT TO authenticated USING (
  public.trein_is_internal(auth.uid(), organizacao_id) AND (
    public.trein_pode_editar_setor(auth.uid(), setor_id)
    OR (publicada AND setor_id IN (SELECT public.trein_setores_visiveis(auth.uid())))
    OR EXISTS (SELECT 1 FROM public.trein_atribuicoes a WHERE a.trilha_id = id AND a.user_id = auth.uid())));
