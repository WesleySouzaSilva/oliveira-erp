CREATE OR REPLACE FUNCTION public.soft_delete(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed text[] := ARRAY[
    'clientes',
    'contratos_vencimentos',
    'laudos',
    'movimentacoes',
    'peticoes',
    'processos'
  ];
  _belongs boolean;
BEGIN
  IF _table IS NULL OR NOT (_table = ANY(_allowed)) THEN
    RAISE EXCEPTION 'tabela nao permitida' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autorizado' USING ERRCODE = '42501';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM %I WHERE id = $1 AND organizacao_id IN (SELECT public.user_org_ids($2)))',
    _table
  )
  INTO _belongs
  USING _id, auth.uid();

  IF NOT _belongs THEN
    RAISE EXCEPTION 'nao autorizado' USING ERRCODE = '42501';
  END IF;

  EXECUTE format('UPDATE %I SET deleted_at = now() WHERE id = $1', _table) USING _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.soft_delete(text, uuid) TO authenticated, service_role;