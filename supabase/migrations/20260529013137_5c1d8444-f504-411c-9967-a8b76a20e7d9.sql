CREATE OR REPLACE FUNCTION public.fn_workflow_avancar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resp_pos uuid;
BEGIN
  IF NEW.concluida IS NOT TRUE OR (OLD.concluida IS TRUE) THEN
    RETURN NEW;
  END IF;

  NEW.concluida_em := now();
  NEW.concluida_por := COALESCE(NEW.concluida_por, auth.uid());
  NEW.status := 'concluida';

  -- 1) Responsável configurado em org_settings
  SELECT responsavel_pos_venda_id INTO _resp_pos
  FROM org_settings WHERE organizacao_id = NEW.organizacao_id;

  -- 2) Fallback: qualquer membro com cargo gestor_pos_venda
  IF _resp_pos IS NULL THEN
    SELECT user_id INTO _resp_pos FROM membros
    WHERE organizacao_id = NEW.organizacao_id AND papel = 'gestor_pos_venda'
    LIMIT 1;
  END IF;

  -- 3) Fallback: membro com cargo pos_venda
  IF _resp_pos IS NULL THEN
    SELECT user_id INTO _resp_pos FROM membros
    WHERE organizacao_id = NEW.organizacao_id AND papel = 'pos_venda'
    LIMIT 1;
  END IF;

  -- 4) Fallback final: admin
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

  ELSIF NEW.fase = 'onboarding' THEN
    INSERT INTO workflow_tarefas (organizacao_id, fase, titulo, descricao, cliente_id, cliente_nome,
      onboarding_id, responsavel_id, created_by, tarefa_origem_id)
    VALUES (NEW.organizacao_id, 'contrato',
      'Solicitar contrato ao banco — ' || COALESCE(NEW.cliente_nome,'(sem nome)'),
      'Pedir cópia integral do contrato e documentos bancários.',
      NEW.cliente_id, NEW.cliente_nome, NEW.onboarding_id,
      COALESCE(_resp_pos, NEW.created_by), NEW.created_by, NEW.id);

    INSERT INTO workflow_tarefas (organizacao_id, fase, titulo, descricao, cliente_id, cliente_nome,
      onboarding_id, responsavel_id, created_by, tarefa_origem_id)
    VALUES (NEW.organizacao_id, 'checklist',
      'Checklist documental — ' || COALESCE(NEW.cliente_nome,'(sem nome)'),
      'Validar documentos do cliente conforme checklist do Drive.',
      NEW.cliente_id, NEW.cliente_nome, NEW.onboarding_id,
      COALESCE(_resp_pos, NEW.created_by), NEW.created_by, NEW.id);

    INSERT INTO workflow_tarefas (organizacao_id, fase, titulo, descricao, cliente_id, cliente_nome,
      onboarding_id, responsavel_id, created_by, tarefa_origem_id)
    VALUES (NEW.organizacao_id, 'laudo',
      'Iniciar laudo técnico — ' || COALESCE(NEW.cliente_nome,'(sem nome)'),
      'Abrir o assistente de laudo já com o cliente pré-preenchido.',
      NEW.cliente_id, NEW.cliente_nome, NEW.onboarding_id,
      NEW.created_by, NEW.created_by, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;