
-- 1. rh_salarios
CREATE TABLE public.rh_salarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id uuid NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  data_vigencia date NOT NULL,
  motivo text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_salarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage rh_salarios" ON public.rh_salarios FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

-- 2. rh_feedbacks
CREATE TABLE public.rh_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id uuid NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  nota integer NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario text NOT NULL,
  periodo_referencia text,
  tipo text NOT NULL DEFAULT 'desempenho',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage rh_feedbacks" ON public.rh_feedbacks FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

-- 3. rh_metas
CREATE TABLE public.rh_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id uuid NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  prazo date,
  progresso integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage rh_metas" ON public.rh_metas FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

-- 4. rh_reunioes_1on1
CREATE TABLE public.rh_reunioes_1on1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id uuid NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  condutor_id uuid NOT NULL,
  data_reuniao date NOT NULL,
  pauta text,
  anotacoes text,
  proximos_passos text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_reunioes_1on1 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage rh_reunioes_1on1" ON public.rh_reunioes_1on1 FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

-- Trigger for updated_at on rh_metas
CREATE TRIGGER update_rh_metas_updated_at BEFORE UPDATE ON public.rh_metas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
