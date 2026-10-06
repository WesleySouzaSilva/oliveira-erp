
-- Security definer functions for role checks
CREATE OR REPLACE FUNCTION public.has_comercial_access(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros
    WHERE user_id = _user_id
      AND organizacao_id = _org_id
      AND papel IN ('admin', 'comercial', 'coordenador')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_marketing_access(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros
    WHERE user_id = _user_id
      AND organizacao_id = _org_id
      AND papel IN ('admin', 'marketing', 'coordenador')
  );
$$;

-- Table: comercial_metas
CREATE TABLE public.comercial_metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo_meta TEXT NOT NULL DEFAULT 'leads',
  valor_alvo NUMERIC NOT NULL DEFAULT 0,
  valor_atual NUMERIC NOT NULL DEFAULT 0,
  periodo_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  periodo_fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comercial_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_comercial_metas" ON public.comercial_metas
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

CREATE POLICY "comercial_view_metas" ON public.comercial_metas
  FOR SELECT TO authenticated
  USING (has_comercial_access(auth.uid(), organizacao_id));

CREATE POLICY "comercial_create_metas" ON public.comercial_metas
  FOR INSERT TO authenticated
  WITH CHECK (has_comercial_access(auth.uid(), organizacao_id) AND created_by = auth.uid());

CREATE POLICY "comercial_update_own_metas" ON public.comercial_metas
  FOR UPDATE TO authenticated
  USING (has_comercial_access(auth.uid(), organizacao_id) AND (responsavel_id = auth.uid() OR is_admin_in_org(auth.uid(), organizacao_id)));

CREATE TRIGGER update_comercial_metas_updated_at
  BEFORE UPDATE ON public.comercial_metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update leads RLS
DROP POLICY IF EXISTS "org_view_leads" ON public.comercial_leads;

CREATE POLICY "comercial_view_leads" ON public.comercial_leads
  FOR SELECT TO authenticated
  USING (has_comercial_access(auth.uid(), organizacao_id));

CREATE POLICY "marketing_view_leads" ON public.comercial_leads
  FOR SELECT TO authenticated
  USING (has_marketing_access(auth.uid(), organizacao_id));

-- Update atividades RLS
DROP POLICY IF EXISTS "org_view_atividades_comercial" ON public.comercial_atividades;

CREATE POLICY "comercial_view_atividades" ON public.comercial_atividades
  FOR SELECT TO authenticated
  USING (has_comercial_access(auth.uid(), organizacao_id));
