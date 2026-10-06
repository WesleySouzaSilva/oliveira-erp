
DROP FUNCTION IF EXISTS public.audit_dangerous_policies();

CREATE FUNCTION public.audit_dangerous_policies()
RETURNS TABLE(
  kind text,
  schemaname text,
  tablename text,
  policyname text,
  cmd text,
  roles text[],
  qual text,
  with_check text,
  reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  WITH pol AS (
    SELECT
      p.schemaname::text AS schemaname,
      p.tablename::text AS tablename,
      p.policyname::text AS policyname,
      p.cmd::text AS cmd,
      p.roles::text[] AS roles,
      COALESCE(p.qual, '')::text AS qual,
      COALESCE(p.with_check, '')::text AS with_check
    FROM pg_policies p
  )
  SELECT 'table'::text, p.schemaname, p.tablename, p.policyname, p.cmd, p.roles,
         p.qual, p.with_check, 'Escrita exposta ao papel anon'::text
  FROM pol p
  WHERE p.schemaname = 'public'
    AND p.cmd IN ('INSERT','UPDATE','DELETE','ALL')
    AND 'anon' = ANY(p.roles)

  UNION ALL

  SELECT 'table'::text, p.schemaname, p.tablename, p.policyname, p.cmd, p.roles,
         p.qual, p.with_check, 'Política sem checagem de autorização (true)'::text
  FROM pol p
  WHERE p.schemaname = 'public'
    AND (p.roles && ARRAY['anon','public'])
    AND p.cmd <> 'SELECT'
    AND btrim(lower(p.qual)) IN ('true','(true)','')
    AND btrim(lower(p.with_check)) IN ('true','(true)','')

  UNION ALL

  SELECT 'storage'::text, p.schemaname, p.tablename, p.policyname, p.cmd, p.roles,
         p.qual, p.with_check, 'Bucket sensível exposto ao papel anon'::text
  FROM pol p
  WHERE p.schemaname = 'storage'
    AND p.tablename = 'objects'
    AND 'anon' = ANY(p.roles)
    AND (
      p.qual ILIKE ANY (ARRAY[
        '%''laudos''%','%''assinaturas''%','%''certificados''%',
        '%''cliente-drive''%','%''rh-arquivos''%'
      ])
      OR p.with_check ILIKE ANY (ARRAY[
        '%''laudos''%','%''assinaturas''%','%''certificados''%',
        '%''cliente-drive''%','%''rh-arquivos''%'
      ])
    );
$$;

GRANT EXECUTE ON FUNCTION public.audit_dangerous_policies() TO anon, authenticated;
