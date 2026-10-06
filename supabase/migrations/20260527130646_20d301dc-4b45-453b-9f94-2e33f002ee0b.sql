CREATE TABLE public.atendimentos_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  operador_id uuid NOT NULL,
  origem text NOT NULL DEFAULT 'avulso',
  lead_id uuid,
  honorario_calculo_id uuid,
  cliente_nome text NOT NULL,
  cliente_contato text,
  titulo text,
  notas_brutas text NOT NULL DEFAULT '',
  relatorio_cliente text,
  relatorio_gerado_em timestamptz,
  modelo_ia text,
  status text NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimentos_notas TO authenticated;
GRANT ALL ON public.atendimentos_notas TO service_role;

ALTER TABLE public.atendimentos_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY an_select_org ON public.atendimentos_notas
FOR SELECT TO authenticated
USING ((operador_id = auth.uid()) OR (organizacao_id IS NOT NULL AND organizacao_id IN (SELECT user_org_ids(auth.uid()))));

CREATE POLICY an_insert_own ON public.atendimentos_notas
FOR INSERT TO authenticated
WITH CHECK (operador_id = auth.uid());

CREATE POLICY an_update_own_or_admin ON public.atendimentos_notas
FOR UPDATE TO authenticated
USING ((operador_id = auth.uid()) OR (organizacao_id IS NOT NULL AND is_admin_in_org(auth.uid(), organizacao_id)));

CREATE POLICY an_delete_own_or_admin ON public.atendimentos_notas
FOR DELETE TO authenticated
USING ((operador_id = auth.uid()) OR (organizacao_id IS NOT NULL AND is_admin_in_org(auth.uid(), organizacao_id)));

CREATE TRIGGER trg_atendimentos_notas_updated_at
BEFORE UPDATE ON public.atendimentos_notas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_atendimentos_notas_org_created ON public.atendimentos_notas(organizacao_id, created_at DESC);
CREATE INDEX idx_atendimentos_notas_lead ON public.atendimentos_notas(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_atendimentos_notas_honorario ON public.atendimentos_notas(honorario_calculo_id) WHERE honorario_calculo_id IS NOT NULL;