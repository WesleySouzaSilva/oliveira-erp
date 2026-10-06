
-- ============ ofertas_catalogo ============
CREATE TABLE public.ofertas_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  marca text NOT NULL CHECK (marca IN ('agro','juridico')),
  modo text NOT NULL CHECK (modo IN ('assinatura','avulso')),
  titulo text NOT NULL,
  descricao text,
  preco numeric(12,2),
  publico boolean NOT NULL DEFAULT false,
  modo_contratacao text NOT NULL DEFAULT 'solicitar' CHECK (modo_contratacao IN ('solicitar','checkout')),
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_ofertas_catalogo_org ON public.ofertas_catalogo(organizacao_id);
CREATE INDEX idx_ofertas_catalogo_ativo ON public.ofertas_catalogo(organizacao_id) WHERE ativo = true AND deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ofertas_catalogo TO authenticated;
GRANT ALL ON public.ofertas_catalogo TO service_role;

ALTER TABLE public.ofertas_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ofertas_select_org" ON public.ofertas_catalogo
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "ofertas_insert_admin" ON public.ofertas_catalogo
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND (
      public.is_admin_in_org(auth.uid(), organizacao_id)
      OR public.has_role_in_org(auth.uid(), 'coordenador'::app_role, organizacao_id)
      OR public.is_ceo(auth.uid())
    )
  );

CREATE POLICY "ofertas_update_admin" ON public.ofertas_catalogo
  FOR UPDATE TO authenticated
  USING (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND (
      public.is_admin_in_org(auth.uid(), organizacao_id)
      OR public.has_role_in_org(auth.uid(), 'coordenador'::app_role, organizacao_id)
      OR public.is_ceo(auth.uid())
    )
  )
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "ofertas_delete_admin" ON public.ofertas_catalogo
  FOR DELETE TO authenticated
  USING (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND (
      public.is_admin_in_org(auth.uid(), organizacao_id)
      OR public.has_role_in_org(auth.uid(), 'coordenador'::app_role, organizacao_id)
      OR public.is_ceo(auth.uid())
    )
  );

CREATE TRIGGER trg_ofertas_catalogo_updated_at
  BEFORE UPDATE ON public.ofertas_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ pedidos_servico ============
CREATE TABLE public.pedidos_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas_consultoria(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  oferta_id uuid REFERENCES public.ofertas_catalogo(id) ON DELETE SET NULL,
  marca text NOT NULL CHECK (marca IN ('agro','juridico')),
  titulo text,
  status text NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado','em_analise','proposta_enviada','aceito','recusado','concluido')),
  observacao text,
  origem text NOT NULL DEFAULT 'interno' CHECK (origem IN ('portal','interno')),
  solicitado_por uuid,
  responsavel_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_pedidos_servico_org ON public.pedidos_servico(organizacao_id);
CREATE INDEX idx_pedidos_servico_empresa ON public.pedidos_servico(empresa_id);
CREATE INDEX idx_pedidos_servico_status ON public.pedidos_servico(organizacao_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_servico TO authenticated;
GRANT ALL ON public.pedidos_servico TO service_role;

ALTER TABLE public.pedidos_servico ENABLE ROW LEVEL SECURITY;

-- interno (membros)
CREATE POLICY "pedidos_select_org" ON public.pedidos_servico
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "pedidos_insert_org" ON public.pedidos_servico
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "pedidos_update_org" ON public.pedidos_servico
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "pedidos_delete_org" ON public.pedidos_servico
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

-- portal (empresa) — SELECT + INSERT apenas
CREATE POLICY "pedidos_select_portal" ON public.pedidos_servico
  FOR SELECT TO authenticated
  USING (empresa_id = public.empresa_do_usuario_portal(auth.uid()));

CREATE POLICY "pedidos_insert_portal" ON public.pedidos_servico
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.empresa_do_usuario_portal(auth.uid())
    AND origem = 'portal'
  );

CREATE TRIGGER trg_pedidos_servico_updated_at
  BEFORE UPDATE ON public.pedidos_servico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BEFORE INSERT: derivar organizacao_id da empresa quando vier do portal
CREATE OR REPLACE FUNCTION public.fn_pedido_servico_set_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organizacao_id IS NULL AND NEW.empresa_id IS NOT NULL THEN
    SELECT organizacao_id INTO NEW.organizacao_id
    FROM public.empresas_consultoria WHERE id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pedidos_servico_set_org
  BEFORE INSERT ON public.pedidos_servico
  FOR EACH ROW EXECUTE FUNCTION public.fn_pedido_servico_set_org();

-- AFTER INSERT: notifica responsável quando origem = portal
CREATE OR REPLACE FUNCTION public.fn_notificar_pedido_portal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resp uuid;
  _empresa_nome text;
  _msg text;
  _admin record;
BEGIN
  IF NEW.origem <> 'portal' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(nome_fantasia, razao_social, 'Empresa'),
         COALESCE(responsavel_pos_venda, responsavel_id)
    INTO _empresa_nome, _resp
  FROM public.empresas_consultoria
  WHERE id = NEW.empresa_id;

  _msg := 'Novo pedido de serviço de ' || COALESCE(_empresa_nome, 'empresa')
       || COALESCE(': ' || NEW.titulo, '');

  IF _resp IS NOT NULL THEN
    INSERT INTO public.notificacoes_sistema (user_id, tipo, mensagem)
    VALUES (_resp, 'pedido_servico_portal', _msg);
  ELSE
    FOR _admin IN
      SELECT user_id FROM public.membros
      WHERE organizacao_id = NEW.organizacao_id AND papel = 'admin'::app_role
    LOOP
      INSERT INTO public.notificacoes_sistema (user_id, tipo, mensagem)
      VALUES (_admin.user_id, 'pedido_servico_portal', _msg);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pedidos_servico_notify
  AFTER INSERT ON public.pedidos_servico
  FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_pedido_portal();

-- ============ portal_ofertas_view ============
-- Segue o padrão das portal_cliente_*_view: view "definer" (default) + WHERE que autoriza pelo helper de portal.
-- Escopo: ofertas ativas da MESMA organização da empresa do usuário de portal.
-- Oculta o preço quando a marca é 'juridico' (só agro expõe preco_exibido).
CREATE VIEW public.portal_ofertas_view AS
SELECT
  o.id,
  o.marca,
  o.modo,
  o.titulo,
  o.descricao,
  o.modo_contratacao,
  CASE WHEN o.marca = 'agro' THEN o.preco ELSE NULL END AS preco_exibido
FROM public.ofertas_catalogo o
JOIN public.empresas_consultoria e
  ON e.organizacao_id = o.organizacao_id
 AND e.id = public.empresa_do_usuario_portal(auth.uid())
WHERE o.ativo = true
  AND o.deleted_at IS NULL
  AND o.publico = true;

GRANT SELECT ON public.portal_ofertas_view TO authenticated;

-- ============ portal_empresa_plano_view ============
-- Mostra ao portal SOMENTE o plano da própria empresa (avença + valor mensal que ELA paga).
-- Escopo por empresa_id = empresa_do_usuario_portal(auth.uid()).
-- Não vaza valor de outra empresa; gate interno (can_view_consultoria_financeiro) segue valendo em avenca_valores.
CREATE VIEW public.portal_empresa_plano_view AS
SELECT
  a.id AS avenca_id,
  a.empresa_id,
  a.titulo,
  a.status,
  a.escopo_areas,
  a.dia_vencimento,
  v.valor_mensal
FROM public.avencas a
LEFT JOIN public.avenca_valores v ON v.avenca_id = a.id
WHERE a.deleted_at IS NULL
  AND a.empresa_id = public.empresa_do_usuario_portal(auth.uid());

GRANT SELECT ON public.portal_empresa_plano_view TO authenticated;
