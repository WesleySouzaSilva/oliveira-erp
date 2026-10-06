
-- ============================================================
-- FASE 2B.1 — Portal do Cliente (fundação read-only)
-- ============================================================

-- Tabela de usuários externos do portal (NÃO são membros)
CREATE TABLE IF NOT EXISTS public.empresa_portal_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas_consultoria(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  contato_id uuid REFERENCES public.empresa_contatos(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  convidado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_epu_empresa ON public.empresa_portal_usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_epu_user ON public.empresa_portal_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_epu_org ON public.empresa_portal_usuarios(organizacao_id);

-- GRANT: leitura para authenticated (filtrada por RLS). Escrita só service_role.
GRANT SELECT ON public.empresa_portal_usuarios TO authenticated;
GRANT ALL ON public.empresa_portal_usuarios TO service_role;

ALTER TABLE public.empresa_portal_usuarios ENABLE ROW LEVEL SECURITY;

-- Equipe interna da org vê os usuários do portal da SUA org
CREATE POLICY "epu_select_interna"
ON public.empresa_portal_usuarios FOR SELECT TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

-- O próprio usuário externo vê o seu registro
CREATE POLICY "epu_select_proprio"
ON public.empresa_portal_usuarios FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_epu_updated_at
  BEFORE UPDATE ON public.empresa_portal_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Função helper: empresa do usuário do portal
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_do_usuario_portal(uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.empresa_portal_usuarios
  WHERE user_id = uid AND ativo = true
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.empresa_do_usuario_portal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_do_usuario_portal(uuid) TO authenticated, service_role;

-- ============================================================
-- POLÍTICAS adicionais de leitura para o usuário do PORTAL
-- (somam-se às policies internas existentes; default-deny segue valendo
--  para qualquer outra tabela)
-- ============================================================

-- consultoria_demandas: portal vê as demandas da SUA empresa
DROP POLICY IF EXISTS "demandas_select_portal" ON public.consultoria_demandas;
CREATE POLICY "demandas_select_portal"
ON public.consultoria_demandas FOR SELECT TO authenticated
USING (empresa_id = public.empresa_do_usuario_portal(auth.uid()));

-- demanda_interacoes: portal vê APENAS interações marcadas como visíveis
DROP POLICY IF EXISTS "demanda_interacoes_select_portal" ON public.demanda_interacoes;
CREATE POLICY "demanda_interacoes_select_portal"
ON public.demanda_interacoes FOR SELECT TO authenticated
USING (
  visivel_empresa = true
  AND EXISTS (
    SELECT 1 FROM public.consultoria_demandas d
    WHERE d.id = demanda_interacoes.demanda_id
      AND d.empresa_id = public.empresa_do_usuario_portal(auth.uid())
  )
);

-- empresas_consultoria: portal vê APENAS a própria empresa
DROP POLICY IF EXISTS "empresas_select_portal" ON public.empresas_consultoria;
CREATE POLICY "empresas_select_portal"
ON public.empresas_consultoria FOR SELECT TO authenticated
USING (id = public.empresa_do_usuario_portal(auth.uid()));
