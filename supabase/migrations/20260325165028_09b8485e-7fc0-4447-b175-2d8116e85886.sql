ALTER TABLE public.contratos_vencimentos
  ADD COLUMN IF NOT EXISTS vencimento_segundo_ano date,
  ADD COLUMN IF NOT EXISTS vencimento_terceiro_ano date,
  ADD COLUMN IF NOT EXISTS vencimento_ultima_parcela date;