DROP TRIGGER IF EXISTS audit_operacoes_credito ON public.operacoes_credito;
CREATE TRIGGER audit_operacoes_credito
AFTER INSERT OR UPDATE OR DELETE ON public.operacoes_credito
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM anon, authenticated, service_role, PUBLIC;
GRANT SELECT ON public.audit_log TO authenticated;

DROP POLICY IF EXISTS audit_no_update ON public.audit_log;
CREATE POLICY audit_no_update ON public.audit_log FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS audit_no_delete ON public.audit_log;
CREATE POLICY audit_no_delete ON public.audit_log FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS team_view_audit_operacoes ON public.audit_log;
CREATE POLICY team_view_audit_operacoes ON public.audit_log
FOR SELECT TO authenticated
USING (
  tabela IN ('operacoes_credito','clientes')
  AND organizacao_id IN (SELECT user_org_ids(auth.uid()))
);