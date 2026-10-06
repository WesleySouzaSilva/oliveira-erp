CREATE TABLE public.controladoria_advbox_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  advbox_user_id text NOT NULL,
  advbox_nome text,
  advbox_email text,
  user_id uuid,
  origem text CHECK (origem IN ('email','manual')),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, advbox_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controladoria_advbox_usuarios TO authenticated;
GRANT ALL ON public.controladoria_advbox_usuarios TO service_role;
ALTER TABLE public.controladoria_advbox_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY ctrl_advusr_select ON public.controladoria_advbox_usuarios FOR SELECT TO authenticated
  USING (public.controladoria_is_internal(auth.uid(), organizacao_id));
CREATE POLICY ctrl_advusr_admin ON public.controladoria_advbox_usuarios FOR ALL TO authenticated
  USING (public.controladoria_is_admin(auth.uid(), organizacao_id))
  WITH CHECK (public.controladoria_is_admin(auth.uid(), organizacao_id));