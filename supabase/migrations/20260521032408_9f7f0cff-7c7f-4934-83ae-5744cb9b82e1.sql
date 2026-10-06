
CREATE TABLE public.mkt_leads_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  user_id uuid NOT NULL,
  data date NOT NULL,
  nicho text NOT NULL,
  origem text NOT NULL DEFAULT 'pago', -- 'pago' | 'organico'
  origem_detalhe text, -- ex: indicação, instagram, meta ads
  nome text,
  contato text,
  sdr_id uuid,
  closer_id uuid,
  status_qualificacao text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'qualificado' | 'desqualificado'
  motivo_desqualificacao text, -- 'sem_perfil' | 'sem_orcamento' | 'sem_interesse' | 'fora_icp' | 'contato_invalido' | 'duplicado' | 'outro'
  motivo_outro text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_origem CHECK (origem IN ('pago','organico')),
  CONSTRAINT chk_status CHECK (status_qualificacao IN ('pendente','qualificado','desqualificado')),
  CONSTRAINT chk_motivo CHECK (
    motivo_desqualificacao IS NULL OR
    motivo_desqualificacao IN ('sem_perfil','sem_orcamento','sem_interesse','fora_icp','contato_invalido','duplicado','outro')
  )
);

CREATE INDEX idx_mkt_leads_diarios_org_data ON public.mkt_leads_diarios (organizacao_id, data DESC);
CREATE INDEX idx_mkt_leads_diarios_nicho_data ON public.mkt_leads_diarios (organizacao_id, nicho, data DESC);
CREATE INDEX idx_mkt_leads_diarios_status ON public.mkt_leads_diarios (organizacao_id, status_qualificacao);

ALTER TABLE public.mkt_leads_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_leads_diarios_select_org"
ON public.mkt_leads_diarios FOR SELECT TO authenticated
USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY "mkt_leads_diarios_insert_org"
ON public.mkt_leads_diarios FOR INSERT TO authenticated
WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND user_id = auth.uid());

CREATE POLICY "mkt_leads_diarios_update_org"
ON public.mkt_leads_diarios FOR UPDATE TO authenticated
USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY "mkt_leads_diarios_delete_org"
ON public.mkt_leads_diarios FOR DELETE TO authenticated
USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE TRIGGER trg_mkt_leads_diarios_updated
BEFORE UPDATE ON public.mkt_leads_diarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
