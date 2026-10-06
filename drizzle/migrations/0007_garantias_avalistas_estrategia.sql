-- 1. Estratégia na operação
ALTER TABLE public.operacoes_credito
  ADD COLUMN IF NOT EXISTS estrategia text,
  ADD COLUMN IF NOT EXISTS estrategia_em timestamptz,
  ADD COLUMN IF NOT EXISTS estrategia_por uuid,
  ADD COLUMN IF NOT EXISTS precisa_laudo boolean NOT NULL DEFAULT false;

-- 2. Garantias (várias por operação)
CREATE TABLE IF NOT EXISTS public.operacao_garantias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  operacao_id uuid NOT NULL REFERENCES public.operacoes_credito(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  grau text,
  descricao text,
  identificacao text,
  valor_avaliacao numeric,
  onde_registrada text,
  situacao text NOT NULL DEFAULT 'gravado',
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacao_garantias TO authenticated;
GRANT ALL ON public.operacao_garantias TO service_role;
ALTER TABLE public.operacao_garantias ENABLE ROW LEVEL SECURITY;
CREATE POLICY operacao_garantias_select_org ON public.operacao_garantias FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY operacao_garantias_insert_org ON public.operacao_garantias FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY operacao_garantias_update_org ON public.operacao_garantias FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY operacao_garantias_delete_org ON public.operacao_garantias FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE TRIGGER trg_garantias_org BEFORE INSERT ON public.operacao_garantias
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();
CREATE INDEX IF NOT EXISTS idx_garantias_operacao ON public.operacao_garantias(operacao_id);

-- 3. Avalistas (ligados a pessoas quando existirem)
CREATE TABLE IF NOT EXISTS public.operacao_avalistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  operacao_id uuid NOT NULL REFERENCES public.operacoes_credito(id) ON DELETE CASCADE,
  pessoa_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cpf text,
  conjuge_anuiu text NOT NULL DEFAULT 'nao_se_aplica',
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacao_avalistas TO authenticated;
GRANT ALL ON public.operacao_avalistas TO service_role;
ALTER TABLE public.operacao_avalistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY operacao_avalistas_select_org ON public.operacao_avalistas FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY operacao_avalistas_insert_org ON public.operacao_avalistas FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY operacao_avalistas_update_org ON public.operacao_avalistas FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY operacao_avalistas_delete_org ON public.operacao_avalistas FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE TRIGGER trg_avalistas_org BEFORE INSERT ON public.operacao_avalistas
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();
CREATE INDEX IF NOT EXISTS idx_avalistas_operacao ON public.operacao_avalistas(operacao_id);
CREATE INDEX IF NOT EXISTS idx_avalistas_pessoa ON public.operacao_avalistas(pessoa_id);

-- 4. Histórico de estratégia
CREATE TABLE IF NOT EXISTS public.operacao_estrategia_hist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  operacao_id uuid NOT NULL REFERENCES public.operacoes_credito(id) ON DELETE CASCADE,
  de text,
  para text NOT NULL,
  motivo text NOT NULL,
  alterado_por uuid DEFAULT auth.uid(),
  alterado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.operacao_estrategia_hist TO authenticated;
GRANT ALL ON public.operacao_estrategia_hist TO service_role;
ALTER TABLE public.operacao_estrategia_hist ENABLE ROW LEVEL SECURITY;
CREATE POLICY operacao_estrategia_hist_select_org ON public.operacao_estrategia_hist FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY operacao_estrategia_hist_insert_org ON public.operacao_estrategia_hist FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE TRIGGER trg_estrategia_hist_org BEFORE INSERT ON public.operacao_estrategia_hist
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();
CREATE INDEX IF NOT EXISTS idx_estrategia_hist_operacao ON public.operacao_estrategia_hist(operacao_id);

-- 5. Registro de tarefas criadas no ADVBOX (não repetir)
CREATE TABLE IF NOT EXISTS public.advbox_tarefas_criadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  operacao_id uuid REFERENCES public.operacoes_credito(id) ON DELETE CASCADE,
  lawsuits_id text NOT NULL,
  tasks_id text NOT NULL,
  advbox_post_id text,
  users_id text,
  data_prazo date,
  urgente boolean NOT NULL DEFAULT false,
  texto text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operacao_id, tasks_id)
);
GRANT SELECT ON public.advbox_tarefas_criadas TO authenticated;
GRANT ALL ON public.advbox_tarefas_criadas TO service_role;
ALTER TABLE public.advbox_tarefas_criadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY advbox_tarefas_criadas_select_org ON public.advbox_tarefas_criadas FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));