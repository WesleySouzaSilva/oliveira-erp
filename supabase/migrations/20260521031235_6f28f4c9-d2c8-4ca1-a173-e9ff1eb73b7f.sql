ALTER TABLE public.mkt_meta_ads_config DROP CONSTRAINT IF EXISTS mkt_meta_ads_config_organizacao_id_nicho_key;
ALTER TABLE public.mkt_meta_ads_config ADD COLUMN IF NOT EXISTS campaign_ids text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.mkt_meta_ads_config ADD COLUMN IF NOT EXISTS campaign_nomes jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_ads_org_nicho_acc
  ON public.mkt_meta_ads_config(organizacao_id, nicho, ad_account_id);
ALTER TABLE public.mkt_meta_ads_sync_log ADD COLUMN IF NOT EXISTS campaign_ids text[];