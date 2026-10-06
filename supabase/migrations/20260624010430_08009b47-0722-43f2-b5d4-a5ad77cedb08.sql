
-- ============================================================================
-- Consultoria Empresarial — Fase 1 (fundação: empresas + contatos + avenças)
-- ============================================================================

-- 1) EMPRESAS
CREATE TABLE IF NOT EXISTS public.empresas_consultoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  setor text,
  porte text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','suspensa','encerrada')),
  responsavel_id uuid,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_empresas_consultoria_org ON public.empresas_consultoria(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_empresas_consultoria_resp ON public.empresas_consultoria(responsavel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas_consultoria TO authenticated;
GRANT ALL ON public.empresas_consultoria TO service_role;
ALTER TABLE public.empresas_consultoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresas_consultoria_select_org" ON public.empresas_consultoria
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "empresas_consultoria_insert_org" ON public.empresas_consultoria
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "empresas_consultoria_update_org" ON public.empresas_consultoria
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "empresas_consultoria_delete_org" ON public.empresas_consultoria
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_empresas_consultoria_updated
  BEFORE UPDATE ON public.empresas_consultoria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) CONTATOS
CREATE TABLE IF NOT EXISTS public.empresa_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas_consultoria(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cargo text,
  email text,
  telefone text,
  pode_abrir_demanda boolean NOT NULL DEFAULT false,
  principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_empresa_contatos_empresa ON public.empresa_contatos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_contatos_org ON public.empresa_contatos(organizacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_contatos TO authenticated;
GRANT ALL ON public.empresa_contatos TO service_role;
ALTER TABLE public.empresa_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_contatos_select_org" ON public.empresa_contatos
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "empresa_contatos_insert_org" ON public.empresa_contatos
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "empresa_contatos_update_org" ON public.empresa_contatos
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "empresa_contatos_delete_org" ON public.empresa_contatos
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));


-- 3) AVENÇAS (sem valor monetário — valor vive em tabela separada e gated)
CREATE TABLE IF NOT EXISTS public.avencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas_consultoria(id) ON DELETE CASCADE,
  titulo text,
  escopo_areas text[] NOT NULL DEFAULT '{}',
  dia_vencimento int CHECK (dia_vencimento IS NULL OR (dia_vencimento BETWEEN 1 AND 31)),
  vigencia_inicio date,
  vigencia_fim date,
  reajuste_indice text,
  reajuste_proximo date,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','suspensa','encerrada')),
  responsavel_id uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_avencas_empresa ON public.avencas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_avencas_org ON public.avencas(organizacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avencas TO authenticated;
GRANT ALL ON public.avencas TO service_role;
ALTER TABLE public.avencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avencas_select_org" ON public.avencas
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "avencas_insert_org" ON public.avencas
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "avencas_update_org" ON public.avencas
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "avencas_delete_org" ON public.avencas
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_avencas_updated
  BEFORE UPDATE ON public.avencas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4) HELPER — quem pode ver/editar valor financeiro de consultoria
--    Reusa o padrão do app: roles via membros.papel + helper SECURITY DEFINER,
--    como is_admin_in_org. Aqui liberamos admin + coordenador (gestão).
CREATE OR REPLACE FUNCTION public.can_view_consultoria_financeiro(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros
    WHERE user_id = _user_id
      AND organizacao_id = _org_id
      AND papel IN ('admin'::app_role, 'coordenador'::app_role)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_consultoria_financeiro(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_consultoria_financeiro(uuid, uuid) TO authenticated, service_role;


-- 5) VALORES DAS AVENÇAS — TABELA SEPARADA, RLS gated por role financeiro.
--    Colaborador comum NÃO recebe a linha (RLS bloqueia SELECT).
CREATE TABLE IF NOT EXISTS public.avenca_valores (
  avenca_id uuid PRIMARY KEY REFERENCES public.avencas(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  valor_mensal numeric(14,2) NOT NULL CHECK (valor_mensal >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE INDEX IF NOT EXISTS idx_avenca_valores_org ON public.avenca_valores(organizacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avenca_valores TO authenticated;
GRANT ALL ON public.avenca_valores TO service_role;
ALTER TABLE public.avenca_valores ENABLE ROW LEVEL SECURITY;

-- SELECT: precisa pertencer à org E ter papel financeiro
CREATE POLICY "avenca_valores_select_gated" ON public.avenca_valores
  FOR SELECT TO authenticated
  USING (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.can_view_consultoria_financeiro(auth.uid(), organizacao_id)
  );

CREATE POLICY "avenca_valores_insert_gated" ON public.avenca_valores
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.can_view_consultoria_financeiro(auth.uid(), organizacao_id)
  );

CREATE POLICY "avenca_valores_update_gated" ON public.avenca_valores
  FOR UPDATE TO authenticated
  USING (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.can_view_consultoria_financeiro(auth.uid(), organizacao_id)
  )
  WITH CHECK (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.can_view_consultoria_financeiro(auth.uid(), organizacao_id)
  );

CREATE POLICY "avenca_valores_delete_gated" ON public.avenca_valores
  FOR DELETE TO authenticated
  USING (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.can_view_consultoria_financeiro(auth.uid(), organizacao_id)
  );

CREATE TRIGGER trg_avenca_valores_updated
  BEFORE UPDATE ON public.avenca_valores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
