
-- Table for tasks/assignments per process phase
CREATE TABLE public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE NOT NULL,
  processo_id uuid REFERENCES public.processos(id) ON DELETE CASCADE,
  fase fase_processo,
  responsavel_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  data_vencimento date NOT NULL,
  concluida boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

-- Org members can view all tasks in their org
CREATE POLICY "Org members can view tasks"
ON public.tarefas FOR SELECT TO authenticated
USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

-- Only admins can create tasks
CREATE POLICY "Admins can create tasks"
ON public.tarefas FOR INSERT TO authenticated
WITH CHECK (
  organizacao_id IN (SELECT user_org_ids(auth.uid()))
  AND has_role(auth.uid(), 'admin')
);

-- Admins can update any task, responsavel can mark as done
CREATE POLICY "Members can update tasks"
ON public.tarefas FOR UPDATE TO authenticated
USING (
  organizacao_id IN (SELECT user_org_ids(auth.uid()))
  AND (has_role(auth.uid(), 'admin') OR responsavel_id = auth.uid())
);

-- Only admins can delete tasks
CREATE POLICY "Admins can delete tasks"
ON public.tarefas FOR DELETE TO authenticated
USING (
  organizacao_id IN (SELECT user_org_ids(auth.uid()))
  AND has_role(auth.uid(), 'admin')
);

-- Add responsaveis_fases to processos (JSON mapping fase -> user_id)
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS responsaveis_fases jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Trigger for updated_at
CREATE TRIGGER update_tarefas_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
