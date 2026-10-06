-- Limpeza da fila de vencidas: histórico automático, duplicatas e protocolo em atraso
ALTER TABLE public.operacoes_credito
  ADD COLUMN IF NOT EXISTS historico_em timestamptz,
  ADD COLUMN IF NOT EXISTS historico_motivo text,
  ADD COLUMN IF NOT EXISTS historico_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicata_de uuid REFERENCES public.operacoes_credito(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicata_status text,
  ADD COLUMN IF NOT EXISTS duplicata_motivo text,
  ADD COLUMN IF NOT EXISTS protocolo_atraso boolean NOT NULL DEFAULT false;

ALTER TABLE public.operacoes_credito
  DROP CONSTRAINT IF EXISTS operacoes_duplicata_status_chk;
ALTER TABLE public.operacoes_credito
  ADD CONSTRAINT operacoes_duplicata_status_chk
  CHECK (duplicata_status IS NULL OR duplicata_status IN ('suspeita','confirmada','descartada'));

CREATE INDEX IF NOT EXISTS operacoes_historico_idx
  ON public.operacoes_credito (organizacao_id, historico_em);