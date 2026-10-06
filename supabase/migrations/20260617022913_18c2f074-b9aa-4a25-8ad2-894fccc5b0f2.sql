
-- Item 1 — Revogar EXECUTE de funções SECURITY DEFINER para anon/public.
-- Funções de trigger (fn_*, handle_new_user) rodam sob privilégio do owner da tabela
-- e não precisam de GRANT EXECUTE. Helpers usados em policies RLS precisam de
-- EXECUTE para o papel `authenticated` (a função é avaliada sob o papel chamador).
-- Não revogamos do `service_role` (mantém uso por edge functions).

-- Funções de trigger: revogam de anon/public; service_role mantém para casos administrativos.
REVOKE EXECUTE ON FUNCTION public.fn_apos_mensagem() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_audit_log() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_criar_tarefa_mensal_sdr_leads() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_log_acordo_change() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_mirror_laudo_to_drive() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_set_organizacao_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_workflow_avancar() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;

-- Ferramenta administrativa (auditoria de policies). Só admins.
REVOKE EXECUTE ON FUNCTION public.audit_dangerous_policies() FROM anon, public;

-- Rate limiter: usado por edge functions com service_role. Não expor.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon, public;

-- Dashboard agregado de marketing: chamada via RPC pelo app autenticado.
REVOKE EXECUTE ON FUNCTION public.mkt_dashboard_agregado(date, date, text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mkt_dashboard_agregado(date, date, text[]) TO authenticated;

-- Gerador de número de proposta de honorários: só usuários autenticados.
REVOKE EXECUTE ON FUNCTION public.gerar_numero_proposta_honorarios() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.gerar_numero_proposta_honorarios() TO authenticated;

-- Soft delete: só usuários autenticados.
REVOKE EXECUTE ON FUNCTION public.soft_delete(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.soft_delete(text, uuid) TO authenticated;

-- Helpers usados em RLS — precisam de EXECUTE para authenticated;
-- revogamos de anon/public para que não fiquem chamáveis sem login.
REVOKE EXECUTE ON FUNCTION public.has_comercial_access(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_marketing_access(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role_in_org(uuid, app_role, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin_in_org(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_conversa_admin(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_conversa_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_leader_of_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_member_anywhere(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_own_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.shares_org(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_has_setor_access(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_org_ids(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_comercial_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_marketing_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in_org(uuid, app_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_in_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversa_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversa_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_leader_of_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_anywhere(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_setor_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org_ids(uuid) TO authenticated;

-- match_olivia_conhecimento já não tinha EXECUTE para anon; mantemos.
-- (Conferido no audit anterior.)
