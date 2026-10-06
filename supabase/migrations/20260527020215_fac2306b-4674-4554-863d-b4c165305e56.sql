
ALTER TABLE public.honorarios_calculos
  ADD COLUMN IF NOT EXISTS status_verificacao text NOT NULL DEFAULT 'pendente';

ALTER TABLE public.consultoria_simulacoes
  ADD COLUMN IF NOT EXISTS status_verificacao text NOT NULL DEFAULT 'pendente';
