DROP POLICY IF EXISTS avenca_valores_select_portal ON public.avenca_valores;
CREATE POLICY avenca_valores_select_portal ON public.avenca_valores
FOR SELECT TO authenticated
USING (avenca_id IN (SELECT avencas.id FROM public.avencas WHERE avencas.empresa_id = public.empresa_do_usuario_portal(auth.uid())));

DROP POLICY IF EXISTS ofertas_select_portal ON public.ofertas_catalogo;
CREATE POLICY ofertas_select_portal ON public.ofertas_catalogo
FOR SELECT TO authenticated
USING (ativo = true AND deleted_at IS NULL AND organizacao_id IN (
  SELECT e.organizacao_id FROM public.empresas_consultoria e WHERE e.id = public.empresa_do_usuario_portal(auth.uid())));

DROP POLICY IF EXISTS "equipe pode ver responsaveis da carteira" ON public.carteira_responsaveis;
CREATE POLICY "equipe pode ver responsaveis da carteira" ON public.carteira_responsaveis
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.membros m1
  JOIN public.membros m2 ON m1.organizacao_id = m2.organizacao_id
  WHERE m1.user_id = auth.uid() AND m2.user_id = carteira_responsaveis.user_id));

DROP POLICY IF EXISTS "Admins can update org member profiles" ON public.profiles;
CREATE POLICY "Admins can update org member profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (id IN (
  SELECT m2.user_id FROM public.membros m1
  JOIN public.membros m2 ON m1.organizacao_id = m2.organizacao_id
  WHERE m1.user_id = auth.uid() AND m1.papel = 'admin'::app_role))
WITH CHECK (id IN (
  SELECT m2.user_id FROM public.membros m1
  JOIN public.membros m2 ON m1.organizacao_id = m2.organizacao_id
  WHERE m1.user_id = auth.uid() AND m1.papel = 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);