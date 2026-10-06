ALTER TABLE public.mkt_metas_individuais
  ADD COLUMN IF NOT EXISTS meta_valor_total_contratos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_supermeta_valor_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pct_entrada numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS comissao_nao_bateu numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS comissao_bateu numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS comissao_supermeta numeric NOT NULL DEFAULT 4;