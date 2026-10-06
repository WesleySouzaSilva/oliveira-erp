CREATE TABLE public.api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    nome text NOT NULL,
    key_hash text NOT NULL UNIQUE,
    key_prefix text NOT NULL,
    scopes text[] NOT NULL DEFAULT '{read}',
    last_used_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    revoked_at timestamptz
);

CREATE INDEX idx_api_keys_org ON public.api_keys(organizacao_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem chaves da sua org" ON public.api_keys FOR SELECT TO authenticated USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Membros criam chaves na sua org" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Criador ou admin pode atualizar" ON public.api_keys FOR UPDATE TO authenticated USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND (user_id = auth.uid() OR public.is_admin_in_org(auth.uid(), organizacao_id))) WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Criador ou admin pode deletar" ON public.api_keys FOR DELETE TO authenticated USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND (user_id = auth.uid() OR public.is_admin_in_org(auth.uid(), organizacao_id)));

CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();