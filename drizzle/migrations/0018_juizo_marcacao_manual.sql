ALTER TABLE public.operacoes_credito
  ADD COLUMN IF NOT EXISTS juizo_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS juizo_processo_numero text,
  ADD COLUMN IF NOT EXISTS juizo_operacao_na_inicial text;

COMMENT ON COLUMN public.operacoes_credito.juizo_manual IS 'Marcado à mão como ação judicial, com o número do processo informado.';
COMMENT ON COLUMN public.operacoes_credito.juizo_operacao_na_inicial IS 'Número da operação conforme consta no pedido da ação (confirmação para sair do radar).';