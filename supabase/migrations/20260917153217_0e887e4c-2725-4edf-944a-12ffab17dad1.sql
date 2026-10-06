-- Fase 2: chaves de API restritas ao administrador
DROP POLICY IF EXISTS "Membros veem chaves da sua org" ON public.api_keys;
DROP POLICY IF EXISTS "Membros criam chaves na sua org" ON public.api_keys;

CREATE POLICY "Admin ve chaves da org" ON public.api_keys
FOR SELECT TO authenticated
USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND is_admin_in_org(auth.uid(), organizacao_id));

CREATE POLICY "Admin cria chaves na org" ON public.api_keys
FOR INSERT TO authenticated
WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND is_admin_in_org(auth.uid(), organizacao_id) AND user_id = auth.uid());