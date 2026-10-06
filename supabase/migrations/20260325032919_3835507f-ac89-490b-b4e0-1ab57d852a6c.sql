
-- 1. Add coordenador role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador';

-- 2. Extend profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS setor text,
  ADD COLUMN IF NOT EXISTS lider_id uuid,
  ADD COLUMN IF NOT EXISTS regime_trabalho text DEFAULT 'CLT',
  ADD COLUMN IF NOT EXISTS tipo_vinculo text DEFAULT 'efetivo',
  ADD COLUMN IF NOT EXISTS data_entrada date,
  ADD COLUMN IF NOT EXISTS jornada text,
  ADD COLUMN IF NOT EXISTS unidade text;

-- 3. Extend rh_feedbacks
ALTER TABLE public.rh_feedbacks
  ADD COLUMN IF NOT EXISTS contexto text,
  ADD COLUMN IF NOT EXISTS acao_esperada text,
  ADD COLUMN IF NOT EXISTS prazo_revisao date,
  ADD COLUMN IF NOT EXISTS status_feedback text NOT NULL DEFAULT 'aberto';

-- 4. Extend rh_reunioes_1on1
ALTER TABLE public.rh_reunioes_1on1
  ADD COLUMN IF NOT EXISTS vitorias text,
  ADD COLUMN IF NOT EXISTS dificuldades text,
  ADD COLUMN IF NOT EXISTS prazo_revisao date,
  ADD COLUMN IF NOT EXISTS resumo_visivel_colaborador text,
  ADD COLUMN IF NOT EXISTS nota_interna_admin text,
  ADD COLUMN IF NOT EXISTS status_reuniao text NOT NULL DEFAULT 'agendada';

-- 5. Extend rh_metas
ALTER TABLE public.rh_metas
  ADD COLUMN IF NOT EXISTS tipo_meta text DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fim date,
  ADD COLUMN IF NOT EXISTS indicador text,
  ADD COLUMN IF NOT EXISTS valor_esperado numeric,
  ADD COLUMN IF NOT EXISTS valor_atual numeric,
  ADD COLUMN IF NOT EXISTS percentual_atingimento numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- 6. Create rh_pdis
CREATE TABLE IF NOT EXISTS public.rh_pdis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id uuid NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  objetivo text NOT NULL,
  competencia text,
  acao_pratica text,
  responsavel_id uuid,
  prazo date,
  status text NOT NULL DEFAULT 'em_andamento',
  evidencia_evolucao text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Create rh_documentos
CREATE TABLE IF NOT EXISTS public.rh_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id uuid NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'outros',
  arquivo_url text,
  data_envio date DEFAULT CURRENT_DATE,
  data_assinatura date,
  status_assinatura text NOT NULL DEFAULT 'pendente',
  validade date,
  observacoes text,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Create rh_contratos
CREATE TABLE IF NOT EXISTS public.rh_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id uuid NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  tipo_vinculo text NOT NULL DEFAULT 'CLT',
  regime_trabalho text,
  data_inicio date NOT NULL,
  data_fim date,
  status text NOT NULL DEFAULT 'ativo',
  arquivo_url text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Create rh_historico
CREATE TABLE IF NOT EXISTS public.rh_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id uuid NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  descricao text NOT NULL,
  visivel_para_colaborador boolean NOT NULL DEFAULT true,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Enable RLS
ALTER TABLE public.rh_pdis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_historico ENABLE ROW LEVEL SECURITY;

-- 11. Helper functions
CREATE OR REPLACE FUNCTION public.is_leader_of_member(_user_id uuid, _membro_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM membros m
    JOIN profiles p ON p.id = m.user_id
    WHERE m.id = _membro_id AND p.lider_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_own_member(_user_id uuid, _membro_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM membros WHERE id = _membro_id AND user_id = _user_id
  );
$$;

-- 12. Drop old admin-only policies on metas and 1on1 (feedbacks stays admin-only)
DROP POLICY IF EXISTS "Admins can manage rh_metas" ON public.rh_metas;
DROP POLICY IF EXISTS "Admins can manage rh_reunioes_1on1" ON public.rh_reunioes_1on1;

-- 13. New RLS for rh_metas
CREATE POLICY "admin_full_metas" ON public.rh_metas FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));
CREATE POLICY "self_view_metas" ON public.rh_metas FOR SELECT TO authenticated
  USING (is_own_member(auth.uid(), membro_id));
CREATE POLICY "leader_view_metas" ON public.rh_metas FOR SELECT TO authenticated
  USING (is_leader_of_member(auth.uid(), membro_id));

-- 14. New RLS for rh_reunioes_1on1
CREATE POLICY "admin_full_1on1" ON public.rh_reunioes_1on1 FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));
CREATE POLICY "self_view_1on1" ON public.rh_reunioes_1on1 FOR SELECT TO authenticated
  USING (is_own_member(auth.uid(), membro_id));
CREATE POLICY "leader_view_1on1" ON public.rh_reunioes_1on1 FOR SELECT TO authenticated
  USING (is_leader_of_member(auth.uid(), membro_id));

-- 15. RLS for rh_pdis
CREATE POLICY "admin_full_pdis" ON public.rh_pdis FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));
CREATE POLICY "self_view_pdis" ON public.rh_pdis FOR SELECT TO authenticated
  USING (is_own_member(auth.uid(), membro_id));
CREATE POLICY "leader_view_pdis" ON public.rh_pdis FOR SELECT TO authenticated
  USING (is_leader_of_member(auth.uid(), membro_id));

-- 16. RLS for rh_documentos
CREATE POLICY "admin_full_rh_docs" ON public.rh_documentos FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));
CREATE POLICY "self_view_rh_docs" ON public.rh_documentos FOR SELECT TO authenticated
  USING (is_own_member(auth.uid(), membro_id));
CREATE POLICY "leader_view_basic_docs" ON public.rh_documentos FOR SELECT TO authenticated
  USING (is_leader_of_member(auth.uid(), membro_id) AND tipo NOT IN ('advertencia', 'contrato', 'aditivo'));

-- 17. RLS for rh_contratos
CREATE POLICY "admin_full_rh_contratos" ON public.rh_contratos FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));
CREATE POLICY "self_view_rh_contratos" ON public.rh_contratos FOR SELECT TO authenticated
  USING (is_own_member(auth.uid(), membro_id));

-- 18. RLS for rh_historico
CREATE POLICY "admin_full_historico" ON public.rh_historico FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));
CREATE POLICY "self_view_historico" ON public.rh_historico FOR SELECT TO authenticated
  USING (is_own_member(auth.uid(), membro_id) AND visivel_para_colaborador = true);
CREATE POLICY "leader_view_historico" ON public.rh_historico FOR SELECT TO authenticated
  USING (is_leader_of_member(auth.uid(), membro_id) AND visivel_para_colaborador = true);

-- 19. Update trigger for rh_pdis
CREATE TRIGGER update_rh_pdis_updated_at BEFORE UPDATE ON public.rh_pdis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
