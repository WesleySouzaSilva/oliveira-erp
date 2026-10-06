REVOKE ALL ON FUNCTION public.fn_empresa_documento_set_org() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_laudo_etapa_historico() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_sync_cliente_from_contrato() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_sync_cliente_from_laudo() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_profiles_protect_admin_fields() FROM PUBLIC, anon;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure::text AS sig
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname='public' AND p.proname='match_olivia_conhecimento'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION unaccent SET SCHEMA extensions;
ALTER FUNCTION public.f_unaccent(text) SET search_path = public, extensions;

UPDATE public.clientes
   SET cpf_cnpj = '032.815.358-36'
 WHERE id = '4acb89f0-073f-4e21-8113-0bb427beec5d'
   AND cpf_cnpj = '032.815.258-36';