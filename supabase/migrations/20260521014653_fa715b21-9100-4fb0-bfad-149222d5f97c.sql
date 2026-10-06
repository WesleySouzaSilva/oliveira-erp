
-- ============================================
-- MÓDULO MÉTRICAS: Marketing + Comercial
-- ============================================

-- 1) Lançamentos diários (1 por org+data+nicho)
CREATE TABLE public.mkt_lancamentos_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data date NOT NULL,
  nicho text NOT NULL CHECK (nicho IN ('agro','empresarial','bpc')),
  -- Marketing
  investimento numeric DEFAULT 0,
  impressoes integer DEFAULT 0,
  alcance integer DEFAULT 0,
  cliques integer DEFAULT 0,
  leads_pagos integer DEFAULT 0,
  leads_organicos integer DEFAULT 0,
  -- SDR
  leads_qualificados_sdr integer DEFAULT 0,
  reunioes_agendadas integer DEFAULT 0,
  -- Closer
  reunioes_realizadas integer DEFAULT 0,
  propostas_enviadas integer DEFAULT 0,
  contratos_fechados integer DEFAULT 0,
  receita_fechada numeric DEFAULT 0,
  -- Perdas
  contratos_perdidos integer DEFAULT 0,
  motivo_perda_principal text CHECK (motivo_perda_principal IN ('preco','concorrencia','timing','sem_fit','sem_resposta','outro') OR motivo_perda_principal IS NULL),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, data, nicho)
);

CREATE INDEX idx_mkt_lanc_data ON public.mkt_lancamentos_diarios (data);
CREATE INDEX idx_mkt_lanc_nicho ON public.mkt_lancamentos_diarios (nicho);
CREATE INDEX idx_mkt_lanc_org ON public.mkt_lancamentos_diarios (organizacao_id);

ALTER TABLE public.mkt_lancamentos_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_lanc_select_org" ON public.mkt_lancamentos_diarios
  FOR SELECT USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "mkt_lanc_insert_org" ON public.mkt_lancamentos_diarios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "mkt_lanc_update_org" ON public.mkt_lancamentos_diarios
  FOR UPDATE USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "mkt_lanc_delete_org" ON public.mkt_lancamentos_diarios
  FOR DELETE USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_mkt_lanc_org BEFORE INSERT ON public.mkt_lancamentos_diarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();
CREATE TRIGGER trg_mkt_lanc_upd BEFORE UPDATE ON public.mkt_lancamentos_diarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) Leads orgânicos por origem
CREATE TABLE public.mkt_leads_organicos_origem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data date NOT NULL,
  nicho text NOT NULL CHECK (nicho IN ('agro','empresarial','bpc')),
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('instagram_organico','indicacao','networking','ltv_cliente','evento','palestra','conteudo','outro')),
  quantidade integer NOT NULL DEFAULT 0,
  indicado_por text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, data, nicho, origem_tipo)
);

CREATE INDEX idx_mkt_org_data ON public.mkt_leads_organicos_origem (data);
CREATE INDEX idx_mkt_org_nicho ON public.mkt_leads_organicos_origem (nicho);
CREATE INDEX idx_mkt_org_origem ON public.mkt_leads_organicos_origem (origem_tipo);
CREATE INDEX idx_mkt_org_org ON public.mkt_leads_organicos_origem (organizacao_id);

ALTER TABLE public.mkt_leads_organicos_origem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_org_select_org" ON public.mkt_leads_organicos_origem
  FOR SELECT USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "mkt_org_insert_org" ON public.mkt_leads_organicos_origem
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "mkt_org_update_org" ON public.mkt_leads_organicos_origem
  FOR UPDATE USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "mkt_org_delete_org" ON public.mkt_leads_organicos_origem
  FOR DELETE USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_mkt_org_org BEFORE INSERT ON public.mkt_leads_organicos_origem
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();
CREATE TRIGGER trg_mkt_org_upd BEFORE UPDATE ON public.mkt_leads_organicos_origem
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3) Metas mensais
CREATE TABLE public.mkt_metas_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano integer NOT NULL,
  nicho text NOT NULL CHECK (nicho IN ('agro','empresarial','bpc')),
  meta_investimento numeric DEFAULT 0,
  meta_leads_pagos integer DEFAULT 0,
  meta_leads_organicos integer DEFAULT 0,
  meta_contratos integer DEFAULT 0,
  meta_receita numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, mes, ano, nicho)
);

CREATE INDEX idx_mkt_metas_org ON public.mkt_metas_mensais (organizacao_id);
CREATE INDEX idx_mkt_metas_periodo ON public.mkt_metas_mensais (ano, mes);

ALTER TABLE public.mkt_metas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_metas_select_org" ON public.mkt_metas_mensais
  FOR SELECT USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "mkt_metas_insert_org" ON public.mkt_metas_mensais
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "mkt_metas_update_org" ON public.mkt_metas_mensais
  FOR UPDATE USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "mkt_metas_delete_org" ON public.mkt_metas_mensais
  FOR DELETE USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_mkt_metas_org BEFORE INSERT ON public.mkt_metas_mensais
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();
CREATE TRIGGER trg_mkt_metas_upd BEFORE UPDATE ON public.mkt_metas_mensais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
