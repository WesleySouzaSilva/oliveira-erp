
-- =============================================
-- P2: AUDIT LOG
-- =============================================

-- 1. Create audit_log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid REFERENCES public.organizacoes(id),
  tabela text NOT NULL,
  registro_id uuid NOT NULL,
  acao text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  dados_anteriores jsonb,
  dados_novos jsonb,
  campos_alterados text[],
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_audit_log_org ON public.audit_log(organizacao_id);
CREATE INDEX idx_audit_log_tabela ON public.audit_log(tabela, created_at DESC);
CREATE INDEX idx_audit_log_registro ON public.audit_log(registro_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);

-- 3. RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_view_audit"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id));

-- Allow system inserts (trigger runs as table owner)
CREATE POLICY "system_insert_audit"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Generic audit trigger function
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _registro_id uuid;
  _dados_old jsonb;
  _dados_new jsonb;
  _changed text[];
  _key text;
BEGIN
  -- Determine registro_id
  IF TG_OP = 'DELETE' THEN
    _registro_id := OLD.id;
    _dados_old := to_jsonb(OLD);
    _dados_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    _registro_id := NEW.id;
    _dados_old := NULL;
    _dados_new := to_jsonb(NEW);
  ELSE -- UPDATE
    _registro_id := NEW.id;
    _dados_old := to_jsonb(OLD);
    _dados_new := to_jsonb(NEW);
    -- Calculate changed fields
    FOR _key IN SELECT jsonb_object_keys(_dados_new)
    LOOP
      IF _key NOT IN ('updated_at', 'created_at') AND
         (_dados_old ->> _key IS DISTINCT FROM _dados_new ->> _key) THEN
        _changed := array_append(_changed, _key);
      END IF;
    END LOOP;
    -- Skip if nothing meaningful changed
    IF _changed IS NULL OR array_length(_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Try to get organizacao_id from the row
  IF TG_OP = 'DELETE' THEN
    _org_id := OLD.organizacao_id;
  ELSE
    _org_id := NEW.organizacao_id;
  END IF;

  INSERT INTO public.audit_log (organizacao_id, tabela, registro_id, acao, dados_anteriores, dados_novos, campos_alterados, user_id)
  VALUES (_org_id, TG_TABLE_NAME, _registro_id, TG_OP, _dados_old, _dados_new, _changed, auth.uid());

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Attach triggers to critical tables
CREATE TRIGGER audit_laudos
  AFTER INSERT OR UPDATE OR DELETE ON public.laudos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_processos
  AFTER INSERT OR UPDATE OR DELETE ON public.processos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_clientes
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_contratos_vencimentos
  AFTER INSERT OR UPDATE OR DELETE ON public.contratos_vencimentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_peticoes
  AFTER INSERT OR UPDATE OR DELETE ON public.peticoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_acordos_tarefas
  AFTER INSERT OR UPDATE OR DELETE ON public.acordos_tarefas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_tarefas
  AFTER INSERT OR UPDATE OR DELETE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- =============================================
-- P3: JSONB VALIDATION TRIGGERS
-- =============================================

-- 1. Validation function for laudos JSONB etapas
CREATE OR REPLACE FUNCTION public.fn_validate_laudo_jsonb()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Validate all etapa columns are objects when not null
  IF NEW.dados_etapa1 IS NOT NULL AND jsonb_typeof(NEW.dados_etapa1) != 'object' THEN
    RAISE EXCEPTION 'dados_etapa1 must be a JSON object, got %', jsonb_typeof(NEW.dados_etapa1);
  END IF;
  IF NEW.dados_etapa2 IS NOT NULL AND jsonb_typeof(NEW.dados_etapa2) != 'object' THEN
    RAISE EXCEPTION 'dados_etapa2 must be a JSON object, got %', jsonb_typeof(NEW.dados_etapa2);
  END IF;
  IF NEW.dados_etapa3 IS NOT NULL AND jsonb_typeof(NEW.dados_etapa3) != 'object' THEN
    RAISE EXCEPTION 'dados_etapa3 must be a JSON object, got %', jsonb_typeof(NEW.dados_etapa3);
  END IF;
  IF NEW.dados_etapa4 IS NOT NULL AND jsonb_typeof(NEW.dados_etapa4) != 'object' THEN
    RAISE EXCEPTION 'dados_etapa4 must be a JSON object, got %', jsonb_typeof(NEW.dados_etapa4);
  END IF;
  IF NEW.dados_etapa5 IS NOT NULL AND jsonb_typeof(NEW.dados_etapa5) != 'object' THEN
    RAISE EXCEPTION 'dados_etapa5 must be a JSON object, got %', jsonb_typeof(NEW.dados_etapa5);
  END IF;
  IF NEW.dados_etapa6 IS NOT NULL AND jsonb_typeof(NEW.dados_etapa6) != 'object' THEN
    RAISE EXCEPTION 'dados_etapa6 must be a JSON object, got %', jsonb_typeof(NEW.dados_etapa6);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_laudo_jsonb
  BEFORE INSERT OR UPDATE ON public.laudos
  FOR EACH ROW EXECUTE FUNCTION fn_validate_laudo_jsonb();

-- 2. Validation function for processos JSONB columns
CREATE OR REPLACE FUNCTION public.fn_validate_processo_jsonb()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- status_fases and datas_fases must be objects
  IF jsonb_typeof(NEW.status_fases) != 'object' THEN
    RAISE EXCEPTION 'status_fases must be a JSON object, got %', jsonb_typeof(NEW.status_fases);
  END IF;
  IF jsonb_typeof(NEW.datas_fases) != 'object' THEN
    RAISE EXCEPTION 'datas_fases must be a JSON object, got %', jsonb_typeof(NEW.datas_fases);
  END IF;
  IF jsonb_typeof(NEW.responsaveis_fases) != 'object' THEN
    RAISE EXCEPTION 'responsaveis_fases must be a JSON object, got %', jsonb_typeof(NEW.responsaveis_fases);
  END IF;
  -- dados_fase columns when not null
  IF NEW.dados_fase2 IS NOT NULL AND jsonb_typeof(NEW.dados_fase2) != 'object' THEN
    RAISE EXCEPTION 'dados_fase2 must be a JSON object, got %', jsonb_typeof(NEW.dados_fase2);
  END IF;
  IF NEW.dados_fase3 IS NOT NULL AND jsonb_typeof(NEW.dados_fase3) != 'object' THEN
    RAISE EXCEPTION 'dados_fase3 must be a JSON object, got %', jsonb_typeof(NEW.dados_fase3);
  END IF;
  IF NEW.dados_fase4 IS NOT NULL AND jsonb_typeof(NEW.dados_fase4) != 'object' THEN
    RAISE EXCEPTION 'dados_fase4 must be a JSON object, got %', jsonb_typeof(NEW.dados_fase4);
  END IF;
  IF NEW.dados_fase5 IS NOT NULL AND jsonb_typeof(NEW.dados_fase5) != 'object' THEN
    RAISE EXCEPTION 'dados_fase5 must be a JSON object, got %', jsonb_typeof(NEW.dados_fase5);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_processo_jsonb
  BEFORE INSERT OR UPDATE ON public.processos
  FOR EACH ROW EXECUTE FUNCTION fn_validate_processo_jsonb();
