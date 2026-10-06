CREATE OR REPLACE FUNCTION public.fn_profiles_protect_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org uuid;
  _is_admin boolean := false;
BEGIN
  -- Chamada de servidor (service role / edge function): sem trava.
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  FOR _org IN SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = OLD.id LOOP
    IF public.is_admin_in_org(_uid, _org) THEN
      _is_admin := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT _is_admin THEN
    NEW.lider_id := OLD.lider_id;
    NEW.ativo    := OLD.ativo;
    NEW.setor    := OLD.setor;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_admin_fields ON public.profiles;
CREATE TRIGGER trg_profiles_protect_admin_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_profiles_protect_admin_fields();

REVOKE EXECUTE ON FUNCTION public.fn_profiles_protect_admin_fields() FROM anon, public;