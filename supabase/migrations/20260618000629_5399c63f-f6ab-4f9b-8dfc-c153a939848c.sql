CREATE TABLE public.relatorios_cliente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacao_id UUID NOT NULL,
  cliente_id UUID NULL,
  cliente_nome TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','finalizado')),
  modelo TEXT NULL,
  provedor TEXT NULL,
  gerado_por UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_cliente TO authenticated;
GRANT ALL ON public.relatorios_cliente TO service_role;

ALTER TABLE public.relatorios_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rel_cliente_select_org" ON public.relatorios_cliente
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "rel_cliente_insert_org" ON public.relatorios_cliente
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND gerado_por = auth.uid());

CREATE POLICY "rel_cliente_update_org" ON public.relatorios_cliente
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "rel_cliente_delete_org" ON public.relatorios_cliente
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE INDEX idx_relatorios_cliente_org ON public.relatorios_cliente(organizacao_id, created_at DESC);
CREATE INDEX idx_relatorios_cliente_nome ON public.relatorios_cliente(organizacao_id, cliente_nome);

CREATE TRIGGER update_relatorios_cliente_updated_at
  BEFORE UPDATE ON public.relatorios_cliente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();