CREATE TABLE IF NOT EXISTS public.app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.app_secrets FROM PUBLIC;
REVOKE ALL ON public.app_secrets FROM anon;
REVOKE ALL ON public.app_secrets FROM authenticated;
GRANT ALL ON public.app_secrets TO service_role;

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
-- Sem políticas: nenhum acesso por anon/authenticated. Só service_role (bypassa RLS).