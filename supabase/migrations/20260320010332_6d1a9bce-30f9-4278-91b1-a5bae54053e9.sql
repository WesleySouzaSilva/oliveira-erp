
-- Add pos_venda to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pos_venda';

-- Add prioridade column to tarefas
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'normal';

-- Add nome_cliente column to tarefas for linking tasks to clients
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS nome_cliente text;
