-- 1) Escopo contratado por titular + banco
CREATE TABLE public.cliente_banco_escopo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  banco text NOT NULL,
  escopo text NOT NULL DEFAULT 'contratado' CHECK (escopo IN ('contratado','fora_escopo','a_contratar')),
  origem text,
  valor numeric,
  vencimento date,
  observacao text,
  pendencia_comercial boolean NOT NULL DEFAULT false,
  pendencia_texto text,
  pendencia_resolvida_em timestamptz,
  pendencia_resolvida_por uuid,
  definido_por uuid,
  definido_nome text,
  definido_em timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cliente_banco_escopo_uk ON public.cliente_banco_escopo (cliente_id, lower(btrim(banco)));
CREATE INDEX cliente_banco_escopo_org_idx ON public.cliente_banco_escopo (organizacao_id, escopo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_banco_escopo TO authenticated;
GRANT ALL ON public.cliente_banco_escopo TO service_role;
ALTER TABLE public.cliente_banco_escopo ENABLE ROW LEVEL SECURITY;

CREATE POLICY escopo_select ON public.cliente_banco_escopo FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
-- Marcar como CONTRATADO é decisão do Willian (admin).
CREATE POLICY escopo_insert ON public.cliente_banco_escopo FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid()))
              AND (escopo <> 'contratado' OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY escopo_update ON public.cliente_banco_escopo FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid()))
              AND (escopo <> 'contratado' OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY escopo_delete ON public.cliente_banco_escopo FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER cliente_banco_escopo_org BEFORE INSERT ON public.cliente_banco_escopo
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

-- 2) Complementações do pedido protocolado
CREATE TABLE public.notificacao_complementacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes_banco(id) ON DELETE CASCADE,
  data date NOT NULL,
  canal text,
  referencia text,
  arquivo text,
  operacoes text[] NOT NULL DEFAULT '{}',
  observacao text,
  registrado_por uuid DEFAULT auth.uid(),
  registrado_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notif_compl_idx ON public.notificacao_complementacoes (notificacao_id, data DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacao_complementacoes TO authenticated;
GRANT ALL ON public.notificacao_complementacoes TO service_role;
ALTER TABLE public.notificacao_complementacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_compl_select ON public.notificacao_complementacoes FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_compl_insert ON public.notificacao_complementacoes FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_compl_update ON public.notificacao_complementacoes FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_compl_delete ON public.notificacao_complementacoes FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE TRIGGER notificacao_complementacoes_org BEFORE INSERT ON public.notificacao_complementacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

-- 3) Marcos do laudo por operação (para avaliar retificação)
ALTER TABLE public.operacoes_credito
  ADD COLUMN IF NOT EXISTS laudo_retificacao_avaliada_em timestamptz;