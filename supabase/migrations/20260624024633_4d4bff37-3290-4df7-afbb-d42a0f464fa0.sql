
-- 1) marcador de CEO
ALTER TABLE public.membros ADD COLUMN IF NOT EXISTS is_ceo boolean NOT NULL DEFAULT false;

-- Garante exclusividade: zera qualquer flag preexistente e marca apenas o usuário-dono
UPDATE public.membros SET is_ceo = false WHERE is_ceo = true;
UPDATE public.membros
   SET is_ceo = true
 WHERE user_id = (SELECT id FROM auth.users WHERE email = 'crystian.santos@gmail.com');

-- 2) função is_ceo
CREATE OR REPLACE FUNCTION public.is_ceo(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros WHERE user_id = uid AND is_ceo = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_ceo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO authenticated, service_role;

-- 3) tabela financeiro_lancamentos
CREATE TABLE public.financeiro_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data date NOT NULL,
  categoria text,
  setor text NOT NULL DEFAULT 'geral' CHECK (setor IN ('agro','empresarial','geral')),
  origem text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_financeiro_lancamentos_org ON public.financeiro_lancamentos(organizacao_id);
CREATE INDEX idx_financeiro_lancamentos_data ON public.financeiro_lancamentos(data);
CREATE INDEX idx_financeiro_lancamentos_setor ON public.financeiro_lancamentos(setor);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated;
GRANT ALL ON public.financeiro_lancamentos TO service_role;

ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_select_ceo" ON public.financeiro_lancamentos
  FOR SELECT TO authenticated
  USING (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.is_ceo(auth.uid())
  );

CREATE POLICY "fin_insert_ceo" ON public.financeiro_lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.is_ceo(auth.uid())
  );

CREATE POLICY "fin_update_ceo" ON public.financeiro_lancamentos
  FOR UPDATE TO authenticated
  USING (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.is_ceo(auth.uid())
  )
  WITH CHECK (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.is_ceo(auth.uid())
  );

CREATE POLICY "fin_delete_ceo" ON public.financeiro_lancamentos
  FOR DELETE TO authenticated
  USING (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.is_ceo(auth.uid())
  );

CREATE TRIGGER update_financeiro_lancamentos_updated_at
  BEFORE UPDATE ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
