
-- Views passam a rodar como invoker (respeitando RLS do usuário)
ALTER VIEW public.portal_ofertas_view SET (security_invoker = true);
ALTER VIEW public.portal_empresa_plano_view SET (security_invoker = true);

-- Policies de portal nas tabelas de suporte (para as views invoker verem as linhas)
CREATE POLICY "ofertas_select_portal" ON public.ofertas_catalogo
  FOR SELECT TO authenticated
  USING (
    ativo = true
    AND deleted_at IS NULL
    AND publico = true
    AND organizacao_id = (
      SELECT organizacao_id FROM public.empresas_consultoria
      WHERE id = public.empresa_do_usuario_portal(auth.uid())
    )
  );

CREATE POLICY "avencas_select_portal" ON public.avencas
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND empresa_id = public.empresa_do_usuario_portal(auth.uid())
  );

CREATE POLICY "avenca_valores_select_portal" ON public.avenca_valores
  FOR SELECT TO authenticated
  USING (
    avenca_id IN (
      SELECT id FROM public.avencas
      WHERE empresa_id = public.empresa_do_usuario_portal(auth.uid())
        AND deleted_at IS NULL
    )
  );

-- Restringe execução das novas SECURITY DEFINER (não expor via API pública)
REVOKE EXECUTE ON FUNCTION public.fn_pedido_servico_set_org() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_notificar_pedido_portal() FROM PUBLIC, anon, authenticated;
