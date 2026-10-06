ALTER TABLE public.contratos_vencimentos ADD COLUMN resolvido boolean NOT NULL DEFAULT false;
ALTER TABLE public.contratos_vencimentos ADD COLUMN motivo_resolucao text;