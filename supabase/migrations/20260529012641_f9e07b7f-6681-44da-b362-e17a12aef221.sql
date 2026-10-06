
-- 1) Settings da organização
CREATE TABLE IF NOT EXISTS public.org_settings (
  organizacao_id uuid PRIMARY KEY,
  responsavel_pos_venda_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_settings TO authenticated;
GRANT ALL ON public.org_settings TO service_role;

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY os_select_org ON public.org_settings FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY os_admin_manage ON public.org_settings FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

-- 2) Workflow tarefas
CREATE TABLE IF NOT EXISTS public.workflow_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  fase text NOT NULL CHECK (fase IN ('cadastro','onboarding','contrato','checklist','laudo')),
  titulo text NOT NULL,
  descricao text,
  cliente_id uuid,
  cliente_nome text,
  lead_id uuid,
  atendimento_id uuid,
  laudo_id uuid,
  onboarding_id uuid,
  responsavel_id uuid NOT NULL,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  concluida boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  concluida_por uuid,
  prazo date,
  tarefa_origem_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_org ON public.workflow_tarefas(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_workflow_responsavel ON public.workflow_tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cliente ON public.workflow_tarefas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_workflow_fase ON public.workflow_tarefas(fase);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_tarefas TO authenticated;
GRANT ALL ON public.workflow_tarefas TO service_role;

ALTER TABLE public.workflow_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY wt_select_org ON public.workflow_tarefas FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY wt_insert_org ON public.workflow_tarefas FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND created_by = auth.uid());
CREATE POLICY wt_update_org ON public.workflow_tarefas FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY wt_delete_admin ON public.workflow_tarefas FOR DELETE TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id));

-- 3) Trigger: ao concluir, cria próxima fase
CREATE OR REPLACE FUNCTION public.fn_workflow_avancar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resp_pos uuid;
  _agro uuid;
BEGIN
  -- Só dispara quando passa de não-concluída para concluída
  IF NOT (OLD.concluida = false AND NEW.concluida = true) THEN
    RETURN NEW;
  END IF;

  NEW.concluida_em := now();
  NEW.concluida_por := COALESCE(NEW.concluida_por, auth.uid());
  NEW.status := 'concluida';

  -- Busca responsável de pós-venda configurado, fallback p/ qualquer admin da org
  SELECT responsavel_pos_venda_id INTO _resp_pos
  FROM org_settings WHERE organizacao_id = NEW.organizacao_id;

  IF _resp_pos IS NULL THEN
    SELECT user_id INTO _resp_pos FROM membros
    WHERE organizacao_id = NEW.organizacao_id AND papel = 'admin'
    LIMIT 1;
  END IF;

  -- cadastro -> onboarding
  IF NEW.fase = 'cadastro' THEN
    INSERT INTO workflow_tarefas (organizacao_id, fase, titulo, descricao, cliente_id, cliente_nome,
      lead_id, atendimento_id, responsavel_id, created_by, tarefa_origem_id)
    VALUES (NEW.organizacao_id, 'onboarding',
      'Onboarding do cliente — ' || COALESCE(NEW.cliente_nome,'(sem nome)'),
      'Realizar onboarding completo do novo cliente (documentos, dados financeiros, propriedade).',
      NEW.cliente_id, NEW.cliente_nome, NEW.lead_id, NEW.atendimento_id,
      COALESCE(_resp_pos, NEW.created_by), NEW.created_by, NEW.id);

  -- onboarding -> abre 3 frentes em paralelo
  ELSIF NEW.fase = 'onboarding' THEN
    -- Frente 1: contrato
    INSERT INTO workflow_tarefas (organizacao_id, fase, titulo, descricao, cliente_id, cliente_nome,
      onboarding_id, responsavel_id, created_by, tarefa_origem_id)
    VALUES (NEW.organizacao_id, 'contrato',
      'Solicitar contrato ao banco — ' || COALESCE(NEW.cliente_nome,'(sem nome)'),
      'Solicitar cópia do contrato e demais documentos bancários do cliente.',
      NEW.cliente_id, NEW.cliente_nome, NEW.onboarding_id,
      COALESCE(_resp_pos, NEW.created_by), NEW.created_by, NEW.id);

    -- Frente 2: checklist documental
    INSERT INTO workflow_tarefas (organizacao_id, fase, titulo, descricao, cliente_id, cliente_nome,
      onboarding_id, responsavel_id, created_by, tarefa_origem_id)
    VALUES (NEW.organizacao_id, 'checklist',
      'Checklist documental do cliente — ' || COALESCE(NEW.cliente_nome,'(sem nome)'),
      'Validar uploads no Drive do cliente (RG, CPF, matrícula, NFs, comprovantes).',
      NEW.cliente_id, NEW.cliente_nome, NEW.onboarding_id,
      COALESCE(_resp_pos, NEW.created_by), NEW.created_by, NEW.id);

    -- Frente 3: laudo
    INSERT INTO workflow_tarefas (organizacao_id, fase, titulo, descricao, cliente_id, cliente_nome,
      onboarding_id, responsavel_id, created_by, tarefa_origem_id)
    VALUES (NEW.organizacao_id, 'laudo',
      'Iniciar laudo técnico — ' || COALESCE(NEW.cliente_nome,'(sem nome)'),
      'Abrir novo laudo já com os dados do cliente pré-preenchidos.',
      NEW.cliente_id, NEW.cliente_nome, NEW.onboarding_id,
      COALESCE(_resp_pos, NEW.created_by), NEW.created_by, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_avancar ON public.workflow_tarefas;
CREATE TRIGGER trg_workflow_avancar
  BEFORE UPDATE ON public.workflow_tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_workflow_avancar();

-- updated_at
DROP TRIGGER IF EXISTS trg_workflow_updated_at ON public.workflow_tarefas;
CREATE TRIGGER trg_workflow_updated_at
  BEFORE UPDATE ON public.workflow_tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_org_settings_updated_at ON public.org_settings;
CREATE TRIGGER trg_org_settings_updated_at
  BEFORE UPDATE ON public.org_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
