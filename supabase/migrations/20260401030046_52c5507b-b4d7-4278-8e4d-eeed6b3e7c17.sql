
-- Table: comercial_leads
CREATE TABLE public.comercial_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  empresa TEXT,
  origem TEXT NOT NULL DEFAULT 'outro',
  etapa_funil TEXT NOT NULL DEFAULT 'mql',
  valor_estimado NUMERIC DEFAULT 0,
  motivo_perda TEXT,
  observacoes TEXT,
  data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
  data_conversao_sql DATE,
  data_reuniao DATE,
  data_proposta DATE,
  data_fechamento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comercial_leads ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "admin_full_leads" ON public.comercial_leads
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

-- Org members: can view all leads in their org
CREATE POLICY "org_view_leads" ON public.comercial_leads
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

-- Members: can create leads in their org
CREATE POLICY "member_create_leads" ON public.comercial_leads
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND responsavel_id = auth.uid());

-- Members: can update own leads
CREATE POLICY "member_update_own_leads" ON public.comercial_leads
  FOR UPDATE TO authenticated
  USING (responsavel_id = auth.uid() AND organizacao_id IN (SELECT user_org_ids(auth.uid())));

-- Trigger updated_at
CREATE TRIGGER update_comercial_leads_updated_at
  BEFORE UPDATE ON public.comercial_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: comercial_atividades
CREATE TABLE public.comercial_atividades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.comercial_leads(id) ON DELETE CASCADE,
  organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'ligacao',
  descricao TEXT,
  resultado TEXT,
  duracao_minutos INTEGER,
  data_atividade DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comercial_atividades ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "admin_full_atividades_comercial" ON public.comercial_atividades
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

-- Org members: can view all activities
CREATE POLICY "org_view_atividades_comercial" ON public.comercial_atividades
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

-- Members: can create activities
CREATE POLICY "member_create_atividades_comercial" ON public.comercial_atividades
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND responsavel_id = auth.uid());

-- Members: can update own activities
CREATE POLICY "member_update_own_atividades" ON public.comercial_atividades
  FOR UPDATE TO authenticated
  USING (responsavel_id = auth.uid() AND organizacao_id IN (SELECT user_org_ids(auth.uid())));
