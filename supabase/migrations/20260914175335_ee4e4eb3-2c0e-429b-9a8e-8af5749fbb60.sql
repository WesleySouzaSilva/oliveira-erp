CREATE OR REPLACE FUNCTION public.fn_set_organizacao_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j jsonb := to_jsonb(NEW);
  uid uuid;
BEGIN
  IF NEW.organizacao_id IS NULL THEN
    uid := COALESCE(
      NULLIF(j->>'user_id','')::uuid,
      NULLIF(j->>'created_by','')::uuid,
      auth.uid()
    );
    IF uid IS NOT NULL THEN
      SELECT organizacao_id INTO NEW.organizacao_id
      FROM public.membros WHERE user_id = uid LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_set_organizacao_id() FROM anon, public;