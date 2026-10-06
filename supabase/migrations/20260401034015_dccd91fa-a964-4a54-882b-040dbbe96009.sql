
-- 1. Add setor_acordos to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'setor_acordos';

-- 2. Create acordos_tarefas table
CREATE TABLE public.acordos_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id),
  contrato_id uuid REFERENCES public.contratos_vencimentos(id),
  responsavel_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  nome_cliente text,
  status text NOT NULL DEFAULT 'pendente',
  prioridade text NOT NULL DEFAULT 'normal',
  data_vencimento date NOT NULL,
  concluida boolean NOT NULL DEFAULT false,
  -- Recurrence fields
  recorrente boolean NOT NULL DEFAULT false,
  intervalo_recorrencia text, -- 'semanal', 'quinzenal', 'mensal'
  proxima_geracao date,
  tarefa_origem_id uuid REFERENCES public.acordos_tarefas(id),
  observacoes text,
  resultado_tentativa text, -- 'acordo_fechado', 'sem_resposta', 'recusado', 'reagendar'
  valor_acordo numeric,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_acordos_tarefas_org ON public.acordos_tarefas(organizacao_id);
CREATE INDEX idx_acordos_tarefas_resp ON public.acordos_tarefas(responsavel_id);
CREATE INDEX idx_acordos_tarefas_contrato ON public.acordos_tarefas(contrato_id);
CREATE INDEX idx_acordos_tarefas_status ON public.acordos_tarefas(organizacao_id, status) WHERE concluida = false;
CREATE INDEX idx_acordos_tarefas_recorrencia ON public.acordos_tarefas(proxima_geracao) WHERE recorrente = true AND concluida = false;

-- 4. RLS
ALTER TABLE public.acordos_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_acordos"
  ON public.acordos_tarefas FOR ALL
  TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

CREATE POLICY "member_view_acordos"
  ON public.acordos_tarefas FOR SELECT
  TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY "member_create_acordos"
  ON public.acordos_tarefas FOR INSERT
  TO authenticated
  WITH CHECK (
    organizacao_id IN (SELECT user_org_ids(auth.uid()))
    AND created_by = auth.uid()
  );

CREATE POLICY "member_update_own_acordos"
  ON public.acordos_tarefas FOR UPDATE
  TO authenticated
  USING (
    (responsavel_id = auth.uid() OR created_by = auth.uid())
    AND organizacao_id IN (SELECT user_org_ids(auth.uid()))
  );

-- 5. Updated_at trigger
CREATE TRIGGER update_acordos_tarefas_updated_at
  BEFORE UPDATE ON public.acordos_tarefas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
