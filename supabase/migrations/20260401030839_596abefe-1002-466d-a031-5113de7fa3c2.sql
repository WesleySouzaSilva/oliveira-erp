
CREATE TABLE public.tarefas_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  tarefa_id UUID,
  processo_id UUID,
  fase TEXT,
  responsavel_id UUID NOT NULL,
  acao TEXT NOT NULL DEFAULT 'concluida',
  executado_por UUID NOT NULL,
  data_vencimento_original DATE,
  data_acao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  nome_cliente TEXT,
  prioridade TEXT DEFAULT 'normal'
);

ALTER TABLE public.tarefas_historico ENABLE ROW LEVEL SECURITY;

-- Org members can insert history records
CREATE POLICY "org_member_create_historico" ON public.tarefas_historico
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacao_id IN (SELECT user_org_ids(auth.uid()))
    AND executado_por = auth.uid()
  );

-- Admins can view all history
CREATE POLICY "admin_view_all_historico" ON public.tarefas_historico
  FOR SELECT TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id));

-- Members can view their own concluded tasks
CREATE POLICY "member_view_own_historico" ON public.tarefas_historico
  FOR SELECT TO authenticated
  USING (
    organizacao_id IN (SELECT user_org_ids(auth.uid()))
    AND executado_por = auth.uid()
    AND acao = 'concluida'
  );
