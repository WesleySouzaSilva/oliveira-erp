-- Otimização: auth.uid()/jwt()/role() passam a ser avaliados uma vez por consulta,
-- via (select auth.x()). A lógica das políticas não muda.
DO $$
DECLARE
  p record;
  nq text;
  nw text;
  s text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ~ '(?<!SELECT )auth\.(uid|jwt|role)\(\)'
  LOOP
    nq := regexp_replace(p.qual, '(?<!SELECT )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    nw := regexp_replace(p.with_check, '(?<!SELECT )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    s := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF p.qual IS NOT NULL THEN s := s || ' USING (' || nq || ')'; END IF;
    IF p.with_check IS NOT NULL THEN s := s || ' WITH CHECK (' || nw || ')'; END IF;
    EXECUTE s;
  END LOOP;
END $$;