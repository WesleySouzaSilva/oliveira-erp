CREATE TABLE public.operacoes_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  banco text NOT NULL,
  numero text NOT NULL,
  modalidade text NOT NULL,
  vence_em date NOT NULL,
  saldo_devedor numeric,
  responsavel text,
  notificado_em date,
  protocolo_ref text,
  dispensar_alerta boolean NOT NULL DEFAULT false,
  dispensa_motivo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_operacoes_credito_cliente_vence ON public.operacoes_credito(cliente_id, vence_em);
CREATE INDEX idx_operacoes_credito_org_vence ON public.operacoes_credito(organizacao_id, vence_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes_credito TO authenticated;
GRANT ALL ON public.operacoes_credito TO service_role;

ALTER TABLE public.operacoes_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operacoes_credito_select_org" ON public.operacoes_credito
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "operacoes_credito_insert_org" ON public.operacoes_credito
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "operacoes_credito_update_org" ON public.operacoes_credito
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "operacoes_credito_delete_org" ON public.operacoes_credito
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_operacoes_credito_updated_at
  BEFORE UPDATE ON public.operacoes_credito
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_operacoes_credito_set_org
  BEFORE INSERT ON public.operacoes_credito
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();