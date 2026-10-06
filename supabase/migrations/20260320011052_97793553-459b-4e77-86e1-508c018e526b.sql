
-- Add foto_url and ativo to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
