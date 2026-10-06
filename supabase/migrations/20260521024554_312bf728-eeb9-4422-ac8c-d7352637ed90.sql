-- Config: 1 conta de anúncio por nicho
CREATE TABLE public.mkt_meta_ads_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  nicho text NOT NULL CHECK (nicho IN ('agro','empresarial','bpc')),
  ad_account_id text NOT NULL,
  ad_account_nome text,
  ativo boolean NOT NULL DEFAULT true,
  ultima_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, nicho)
);

ALTER TABLE public.mkt_meta_ads_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing pode ver config meta ads"
ON public.mkt_meta_ads_config FOR SELECT TO authenticated
USING (public.has_marketing_access(auth.uid(), organizacao_id));

CREATE POLICY "marketing pode inserir config meta ads"
ON public.mkt_meta_ads_config FOR INSERT TO authenticated
WITH CHECK (public.has_marketing_access(auth.uid(), organizacao_id));

CREATE POLICY "marketing pode atualizar config meta ads"
ON public.mkt_meta_ads_config FOR UPDATE TO authenticated
USING (public.has_marketing_access(auth.uid(), organizacao_id));

CREATE POLICY "marketing pode deletar config meta ads"
ON public.mkt_meta_ads_config FOR DELETE TO authenticated
USING (public.has_marketing_access(auth.uid(), organizacao_id));

CREATE TRIGGER tg_meta_ads_config_updated
BEFORE UPDATE ON public.mkt_meta_ads_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log de sincronização
CREATE TABLE public.mkt_meta_ads_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  nicho text NOT NULL,
  ad_account_id text NOT NULL,
  data_referencia date NOT NULL,
  status text NOT NULL CHECK (status IN ('sucesso','erro','parcial')),
  investimento numeric,
  impressoes integer,
  alcance integer,
  cliques integer,
  leads integer,
  erro_mensagem text,
  trigger_tipo text NOT NULL DEFAULT 'cron' CHECK (trigger_tipo IN ('cron','manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mkt_meta_ads_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing pode ver log meta ads"
ON public.mkt_meta_ads_sync_log FOR SELECT TO authenticated
USING (public.has_marketing_access(auth.uid(), organizacao_id));

CREATE INDEX idx_meta_sync_log_org_data ON public.mkt_meta_ads_sync_log(organizacao_id, data_referencia DESC);