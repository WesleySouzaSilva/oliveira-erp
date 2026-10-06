REVOKE ALL ON TABLE public.app_secrets FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.rate_limits FROM anon, authenticated, PUBLIC;

GRANT ALL ON TABLE public.app_secrets TO service_role;
GRANT ALL ON TABLE public.rate_limits TO service_role;

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_secrets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;