
CREATE TABLE public.consultoria_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas_consultoria(id) ON DELETE SET NULL,
  prospect_nome text,
  titulo text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  valor_sugerido numeric,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','aceita','recusada')),
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT consultoria_propostas_empresa_ou_prospect CHECK (empresa_id IS NOT NULL OR prospect_nome IS NOT NULL)
);

CREATE INDEX idx_consultoria_propostas_org ON public.consultoria_propostas(organizacao_id);
CREATE INDEX idx_consultoria_propostas_empresa ON public.consultoria_propostas(empresa_id);
CREATE INDEX idx_consultoria_propostas_status ON public.consultoria_propostas(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_propostas TO authenticated;
GRANT ALL ON public.consultoria_propostas TO service_role;

ALTER TABLE public.consultoria_propostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da org leem propostas"
  ON public.consultoria_propostas FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Membros da org criam propostas"
  ON public.consultoria_propostas FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Membros da org atualizam propostas"
  ON public.consultoria_propostas FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Membros da org excluem propostas"
  ON public.consultoria_propostas FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_consultoria_propostas_updated_at
  BEFORE UPDATE ON public.consultoria_propostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
