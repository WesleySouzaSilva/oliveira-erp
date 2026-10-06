CREATE OR REPLACE FUNCTION public.ensure_cliente_cadastrado(_org_id uuid, _user_id uuid, _nome text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nome_limpo text;
  _id uuid;
BEGIN
  _nome_limpo := btrim(coalesce(_nome, ''));
  IF length(_nome_limpo) < 2 OR _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  _nome_limpo := public.normalize_person_name(_nome_limpo);

  SELECT c.id INTO _id
  FROM public.clientes c
  WHERE c.deleted_at IS NULL
    AND (_org_id IS NULL OR c.organizacao_id IS NOT DISTINCT FROM _org_id)
    AND public.f_unaccent(lower(btrim(c.nome))) = public.f_unaccent(lower(_nome_limpo))
  LIMIT 1;

  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;

  INSERT INTO public.clientes (user_id, organizacao_id, nome)
  VALUES (_user_id, _org_id, _nome_limpo)
  ON CONFLICT (user_id, nome) DO UPDATE SET updated_at = now()
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_cliente_cadastrado(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_cliente_cadastrado(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_sync_cliente_from_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_cliente_cadastrado(NEW.organizacao_id, COALESCE(NEW.user_id, auth.uid()), NEW.nome_cliente);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cliente_from_contrato ON public.contratos_vencimentos;
CREATE TRIGGER trg_sync_cliente_from_contrato
AFTER INSERT OR UPDATE OF nome_cliente ON public.contratos_vencimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_cliente_from_contrato();

CREATE OR REPLACE FUNCTION public.fn_sync_cliente_from_laudo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nome text;
BEGIN
  _nome := COALESCE(NEW.dados_etapa1->>'nomeProdutor', NEW.dados_etapa1->>'nome', NEW.dados_etapa1->>'produtor');
  IF _nome IS NOT NULL THEN
    PERFORM public.ensure_cliente_cadastrado(NEW.organizacao_id, COALESCE(NEW.user_id, auth.uid()), _nome);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cliente_from_laudo ON public.laudos;
CREATE TRIGGER trg_sync_cliente_from_laudo
AFTER INSERT OR UPDATE OF dados_etapa1 ON public.laudos
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_cliente_from_laudo();