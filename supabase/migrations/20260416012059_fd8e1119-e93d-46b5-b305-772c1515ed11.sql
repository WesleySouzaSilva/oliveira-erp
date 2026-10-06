
-- =============================================
-- 1. rh_tabela_salarial
-- =============================================
CREATE TABLE public.rh_tabela_salarial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id),
  setor text NOT NULL,
  nivel text NOT NULL,
  subfaixa text NOT NULL DEFAULT 'N1',
  sal_min numeric NOT NULL DEFAULT 0,
  sal_max numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organizacao_id, setor, nivel, subfaixa)
);

ALTER TABLE public.rh_tabela_salarial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_rh_tabela_salarial" ON public.rh_tabela_salarial
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

CREATE TRIGGER update_rh_tabela_salarial_updated_at
  BEFORE UPDATE ON public.rh_tabela_salarial
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. rh_metas_template
-- =============================================
CREATE TABLE public.rh_metas_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id),
  meta_code text NOT NULL,
  setor text NOT NULL,
  nivel text NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  descricao text NOT NULL,
  alvo text NOT NULL,
  alvo_calibracao text,
  tipo text NOT NULL DEFAULT 'numerica',
  fonte text,
  peso_pontuacao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organizacao_id, meta_code)
);

ALTER TABLE public.rh_metas_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_rh_metas_template" ON public.rh_metas_template
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

CREATE TRIGGER update_rh_metas_template_updated_at
  BEFORE UPDATE ON public.rh_metas_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 3. rh_pools_semestrais
-- =============================================
CREATE TABLE public.rh_pools_semestrais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id),
  semestre text NOT NULL,
  ano integer NOT NULL,
  faturamento_semestral numeric DEFAULT 0,
  meta_faturamento numeric DEFAULT 0,
  gatilho_atingido boolean DEFAULT false,
  pool_definido numeric DEFAULT 0,
  pool_liberado numeric DEFAULT 0,
  aprovado_por uuid,
  data_definicao date,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organizacao_id, semestre, ano)
);

ALTER TABLE public.rh_pools_semestrais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_rh_pools" ON public.rh_pools_semestrais
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

CREATE TRIGGER update_rh_pools_updated_at
  BEFORE UPDATE ON public.rh_pools_semestrais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4. rh_apuracoes
-- =============================================
CREATE TABLE public.rh_apuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id),
  membro_id uuid NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  pool_id uuid REFERENCES public.rh_pools_semestrais(id),
  semestre text NOT NULL,
  ano integer NOT NULL,
  setor text,
  nivel text,
  salario_fixo numeric DEFAULT 0,
  peso_nivel numeric DEFAULT 1.0,
  cota_individual numeric DEFAULT 0,
  meta_1_id text,
  meta_1_batida boolean DEFAULT false,
  meta_1_pontos integer DEFAULT 0,
  meta_2_id text,
  meta_2_batida boolean DEFAULT false,
  meta_2_pontos integer DEFAULT 0,
  meta_3_id text,
  meta_3_batida boolean DEFAULT false,
  meta_3_pontos integer DEFAULT 0,
  pontuacao_total integer DEFAULT 0,
  faixa_termometro text DEFAULT 'Atenção',
  metas_batidas_total integer DEFAULT 0,
  multiplicador_base numeric DEFAULT 0,
  multiplicador_antiguidade numeric DEFAULT 0,
  multiplicador_final numeric DEFAULT 0,
  bonus_final numeric DEFAULT 0,
  modo_calibracao boolean DEFAULT false,
  feedback_gestor text,
  aprovado_por uuid,
  data_pagamento date,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organizacao_id, membro_id, semestre, ano)
);

ALTER TABLE public.rh_apuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_rh_apuracoes" ON public.rh_apuracoes
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

CREATE POLICY "self_view_rh_apuracoes" ON public.rh_apuracoes
  FOR SELECT TO authenticated
  USING (is_own_member(auth.uid(), membro_id));

CREATE POLICY "leader_view_rh_apuracoes" ON public.rh_apuracoes
  FOR SELECT TO authenticated
  USING (is_leader_of_member(auth.uid(), membro_id));

CREATE TRIGGER update_rh_apuracoes_updated_at
  BEFORE UPDATE ON public.rh_apuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 5. rh_politica_config
-- =============================================
CREATE TABLE public.rh_politica_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id),
  config_key text NOT NULL,
  config_value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organizacao_id, config_key)
);

ALTER TABLE public.rh_politica_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_rh_politica" ON public.rh_politica_config
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

CREATE TRIGGER update_rh_politica_updated_at
  BEFORE UPDATE ON public.rh_politica_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
