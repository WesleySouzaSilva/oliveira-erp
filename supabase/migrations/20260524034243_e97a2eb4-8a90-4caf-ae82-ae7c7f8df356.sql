
CREATE OR REPLACE FUNCTION public.audit_dangerous_policies()
RETURNS TABLE(
  kind text,
  schemaname text,
  tablename text,
  policyname text,
  cmd text,
  roles text[],
  reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT
    'table'::text,
    p.schemaname::text,
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    p.roles::text[],
    'Escrita exposta a anon/public'::text
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.cmd IN ('INSERT','UPDATE','DELETE','ALL')
    AND (p.roles::text[] && ARRAY['anon','public'])

  UNION ALL

  SELECT
    'storage'::text,
    p.schemaname::text,
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    p.roles::text[],
    'Bucket sensível exposto a anon/public'::text
  FROM pg_policies p
  WHERE p.schemaname = 'storage'
    AND p.tablename = 'objects'
    AND (p.roles::text[] && ARRAY['anon','public'])
    AND (
      COALESCE(p.qual, '') ILIKE ANY (ARRAY[
        '%''laudos''%','%''assinaturas''%','%''certificados''%',
        '%''cliente-drive''%','%''rh-arquivos''%'
      ])
      OR COALESCE(p.with_check, '') ILIKE ANY (ARRAY[
        '%''laudos''%','%''assinaturas''%','%''certificados''%',
        '%''cliente-drive''%','%''rh-arquivos''%'
      ])
    );
$$;

GRANT EXECUTE ON FUNCTION public.audit_dangerous_policies() TO anon, authenticated;
