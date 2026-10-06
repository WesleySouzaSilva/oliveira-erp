-- 1) Escopo do banco pode ser gravado no fechamento por qualquer membro.
--    Alterar depois continua exclusivo do admin (Willian).
DROP POLICY IF EXISTS escopo_insert ON public.cliente_banco_escopo;
CREATE POLICY escopo_insert ON public.cliente_banco_escopo
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));

DROP POLICY IF EXISTS escopo_update ON public.cliente_banco_escopo;
CREATE POLICY escopo_update ON public.cliente_banco_escopo
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

-- Um registro por cliente + banco.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cliente_banco_escopo
  ON public.cliente_banco_escopo (cliente_id, lower(btrim(banco)));

-- 2) Histórico das alterações de escopo.
CREATE TABLE IF NOT EXISTS public.cliente_banco_escopo_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  banco text NOT NULL,
  escopo_anterior text,
  escopo_novo text NOT NULL,
  origem text,
  motivo text,
  alterado_por uuid,
  alterado_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cliente_banco_escopo_historico TO authenticated;
GRANT ALL ON public.cliente_banco_escopo_historico TO service_role;
ALTER TABLE public.cliente_banco_escopo_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escopo_hist_select ON public.cliente_banco_escopo_historico;
CREATE POLICY escopo_hist_select ON public.cliente_banco_escopo_historico
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
DROP POLICY IF EXISTS escopo_hist_insert ON public.cliente_banco_escopo_historico;
CREATE POLICY escopo_hist_insert ON public.cliente_banco_escopo_historico
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
DROP TRIGGER IF EXISTS cliente_banco_escopo_hist_org ON public.cliente_banco_escopo_historico;
CREATE TRIGGER cliente_banco_escopo_hist_org BEFORE INSERT ON public.cliente_banco_escopo_historico
  FOR EACH ROW EXECUTE FUNCTION fn_set_organizacao_id();
CREATE INDEX IF NOT EXISTS idx_escopo_hist_cliente ON public.cliente_banco_escopo_historico (cliente_id, created_at DESC);

-- 3) Retorno do disparo imediato para o ADVBOX, mostrado na ficha do cliente.
CREATE TABLE IF NOT EXISTS public.advbox_disparos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  motivo text,
  customers_id text,
  processos jsonb NOT NULL DEFAULT '[]'::jsonb,
  tarefas integer NOT NULL DEFAULT 0,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  bloqueios jsonb NOT NULL DEFAULT '[]'::jsonb,
  disparado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.advbox_disparos TO authenticated;
GRANT ALL ON public.advbox_disparos TO service_role;
ALTER TABLE public.advbox_disparos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS advbox_disparos_select ON public.advbox_disparos;
CREATE POLICY advbox_disparos_select ON public.advbox_disparos
  FOR SELECT TO authenticated
  USING (organizacao_id IS NULL OR organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE INDEX IF NOT EXISTS idx_advbox_disparos_cliente ON public.advbox_disparos (cliente_id, created_at DESC);