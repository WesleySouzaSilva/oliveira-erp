ALTER TABLE public.mkt_lancamentos_diarios
  ADD COLUMN IF NOT EXISTS investimento_organico numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressoes_organico integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alcance_organico integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cliques_organico integer NOT NULL DEFAULT 0;