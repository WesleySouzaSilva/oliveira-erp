
CREATE TABLE public.acordos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.acordos_tarefas(id) ON DELETE CASCADE,
  organizacao_id uuid,
  user_id uuid,
  acao text NOT NULL,
  campos_alterados text[],
  dados_anteriores jsonb,
  dados_novos jsonb,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_acordos_hist_tarefa ON public.acordos_historico(tarefa_id, created_at DESC);
CREATE INDEX idx_acordos_hist_org ON public.acordos_historico(organizacao_id);

GRANT SELECT ON public.acordos_historico TO authenticated;
GRANT ALL ON public.acordos_historico TO service_role;

ALTER TABLE public.acordos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY ah_select_org ON public.acordos_historico FOR SELECT TO authenticated
USING (organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE OR REPLACE FUNCTION public.fn_log_acordo_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _changed text[] := '{}';
  _key text;
  _old jsonb;
  _new jsonb;
  _acao text;
  _ignored text[] := ARRAY['updated_at','created_at'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.acordos_historico (tarefa_id, organizacao_id, user_id, acao, dados_novos)
    VALUES (NEW.id, NEW.organizacao_id, auth.uid(), 'criado', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.acordos_historico (tarefa_id, organizacao_id, user_id, acao, dados_anteriores)
    VALUES (OLD.id, OLD.organizacao_id, auth.uid(), 'excluido', to_jsonb(OLD));
    RETURN OLD;
  ELSE
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    FOR _key IN SELECT jsonb_object_keys(_new) LOOP
      IF _key <> ALL(_ignored) AND (_old->>_key) IS DISTINCT FROM (_new->>_key) THEN
        _changed := array_append(_changed, _key);
      END IF;
    END LOOP;
    IF array_length(_changed,1) IS NULL THEN
      RETURN NEW;
    END IF;
    _acao := CASE
      WHEN (OLD.concluida IS DISTINCT FROM NEW.concluida) AND NEW.concluida THEN 'concluido'
      WHEN (OLD.status IS DISTINCT FROM NEW.status) THEN 'status_alterado'
      ELSE 'atualizado'
    END;
    INSERT INTO public.acordos_historico (tarefa_id, organizacao_id, user_id, acao, campos_alterados, dados_anteriores, dados_novos)
    VALUES (NEW.id, NEW.organizacao_id, auth.uid(), _acao, _changed, _old, _new);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_acordos_historico ON public.acordos_tarefas;
CREATE TRIGGER trg_acordos_historico
AFTER INSERT OR UPDATE OR DELETE ON public.acordos_tarefas
FOR EACH ROW EXECUTE FUNCTION public.fn_log_acordo_change();
