-- 1) Lista de motivos de perda atualizada (inclui motivos do agro)
ALTER TABLE public.mkt_lancamentos_diarios
  DROP CONSTRAINT IF EXISTS mkt_lancamentos_diarios_motivo_perda_principal_check;

ALTER TABLE public.mkt_lancamentos_diarios
  ADD CONSTRAINT mkt_lancamentos_diarios_motivo_perda_principal_check
  CHECK (
    motivo_perda_principal IS NULL OR motivo_perda_principal IN (
      'preco','concorrencia','timing','sem_fit','sem_resposta','outro',
      'negociou_banco','outro_advogado'
    )
  );

-- 2) Vínculo de closer/SDR no lançamento
ALTER TABLE public.mkt_lancamentos_diarios
  ADD COLUMN IF NOT EXISTS closer_id uuid,
  ADD COLUMN IF NOT EXISTS sdr_id uuid;

-- 3) Permitir mais de 1 lançamento por dia/nicho (um por dupla closer/sdr)
ALTER TABLE public.mkt_lancamentos_diarios
  DROP CONSTRAINT IF EXISTS mkt_lancamentos_diarios_organizacao_id_data_nicho_key;

CREATE UNIQUE INDEX IF NOT EXISTS mkt_lancamentos_diarios_org_data_nicho_closer_sdr_uniq
  ON public.mkt_lancamentos_diarios (
    organizacao_id, data, nicho,
    COALESCE(closer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(sdr_id,    '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 4) Tabela de metas individuais
CREATE TABLE IF NOT EXISTS public.mkt_metas_individuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membro_user_id uuid NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano int NOT NULL,
  meta_receita numeric NOT NULL DEFAULT 0,
  meta_contratos int NOT NULL DEFAULT 0,
  meta_leads_qualificados int NOT NULL DEFAULT 0,
  meta_reunioes_realizadas int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, membro_user_id, mes, ano)
);

ALTER TABLE public.mkt_metas_individuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_metas_ind_select_org"
  ON public.mkt_metas_individuais FOR SELECT
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY "mkt_metas_ind_insert_org"
  ON public.mkt_metas_individuais FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "mkt_metas_ind_update_org"
  ON public.mkt_metas_individuais FOR UPDATE
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY "mkt_metas_ind_delete_org"
  ON public.mkt_metas_individuais FOR DELETE
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE TRIGGER mkt_metas_ind_updated_at
  BEFORE UPDATE ON public.mkt_metas_individuais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER mkt_metas_ind_set_org
  BEFORE INSERT ON public.mkt_metas_individuais
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();