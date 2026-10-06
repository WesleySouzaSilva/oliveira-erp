-- 1) Segredos / rate limits / TOTP tribunais: negação explícita (fail-closed documentado)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_secrets','rate_limits','tj_credenciais','tj_credencial_acessos','tj_custodiantes','tj_auditoria']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_deny_all_client_roles" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_deny_all_client_roles" ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t, t);
  END LOOP;
END $$;

-- 2) financeiro_cobrancas: leitura só CEO (policy existente); escrita negada explicitamente para clientes
REVOKE ALL ON public.financeiro_cobrancas FROM anon, authenticated;
GRANT SELECT ON public.financeiro_cobrancas TO authenticated;
GRANT ALL ON public.financeiro_cobrancas TO service_role;

DROP POLICY IF EXISTS "financeiro_cobrancas_deny_insert" ON public.financeiro_cobrancas;
CREATE POLICY "financeiro_cobrancas_deny_insert"
  ON public.financeiro_cobrancas AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "financeiro_cobrancas_deny_update" ON public.financeiro_cobrancas;
CREATE POLICY "financeiro_cobrancas_deny_update"
  ON public.financeiro_cobrancas AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "financeiro_cobrancas_deny_delete" ON public.financeiro_cobrancas;
CREATE POLICY "financeiro_cobrancas_deny_delete"
  ON public.financeiro_cobrancas AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);