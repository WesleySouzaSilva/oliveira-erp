-- 1) app_secrets / rate_limits: fail-closed explícito (RLS já habilitado, zero policies).
REVOKE ALL ON TABLE public.app_secrets FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.rate_limits FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.app_secrets TO service_role;
GRANT ALL ON TABLE public.rate_limits TO service_role;

COMMENT ON TABLE public.app_secrets IS 'Segredos internos. RLS habilitado sem policies (default-deny). Acesso somente via service_role / SECURITY DEFINER.';
COMMENT ON TABLE public.rate_limits IS 'Contadores de rate limit. RLS habilitado sem policies (default-deny). Gerenciado por public.check_rate_limit() (SECURITY DEFINER).';

-- 2) realtime.messages: remove cláusula morta de tópicos públicos.
DROP POLICY IF EXISTS realtime_authenticated_own_topics ON realtime.messages;
CREATE POLICY realtime_authenticated_own_topics
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || auth.uid()::text)
  OR realtime.topic() IN (
    SELECT 'org:' || m.organizacao_id::text
    FROM public.membros m
    WHERE m.user_id = auth.uid()
  )
);