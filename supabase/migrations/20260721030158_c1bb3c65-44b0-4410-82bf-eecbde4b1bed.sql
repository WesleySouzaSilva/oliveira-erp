
DROP POLICY IF EXISTS ofertas_select_portal ON public.ofertas_catalogo;
CREATE POLICY ofertas_select_portal ON public.ofertas_catalogo
FOR SELECT USING (
  ativo = true
  AND deleted_at IS NULL
  AND organizacao_id IN (
    SELECT e.organizacao_id FROM public.empresas_consultoria e
    WHERE e.id = empresa_do_usuario_portal(auth.uid())
  )
);

CREATE OR REPLACE VIEW public.portal_ofertas_view
WITH (security_invoker = true) AS
SELECT o.id, o.marca, o.modo, o.titulo, o.descricao, o.modo_contratacao,
  CASE WHEN o.marca = 'agro' THEN o.preco ELSE NULL::numeric END AS preco_exibido
FROM public.ofertas_catalogo o
JOIN public.empresas_consultoria e
  ON e.organizacao_id = o.organizacao_id
 AND e.id = empresa_do_usuario_portal(auth.uid())
WHERE o.ativo = true AND o.deleted_at IS NULL;

DROP POLICY IF EXISTS "avenca_valores_select_portal" ON public.avenca_valores;
CREATE POLICY "avenca_valores_select_portal" ON public.avenca_valores
FOR SELECT USING (
  avenca_id IN (
    SELECT id FROM public.avencas
    WHERE empresa_id = empresa_do_usuario_portal(auth.uid())
  )
);
