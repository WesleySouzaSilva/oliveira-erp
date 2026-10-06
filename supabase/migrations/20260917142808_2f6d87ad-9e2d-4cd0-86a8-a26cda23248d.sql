REVOKE EXECUTE ON FUNCTION public.contratos_vencimentos_vincula_cliente() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.portal_chamado_mensagens_pos_insert() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.portal_chamado_mensagens_preenche() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.portal_chamados_antes_insert() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.portal_chamados_pos_insert() FROM anon, public;
ALTER FUNCTION public.portal_chamados_touch() SET search_path = public;