
-- Add nivel and subfaixa to profiles for career tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nivel text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subfaixa text DEFAULT NULL;

-- Allow admins to update any profile in their org (for setting nivel/subfaixa)
CREATE POLICY "Admins can update org member profiles"
ON public.profiles
FOR UPDATE
USING (
  id IN (
    SELECT m2.user_id
    FROM membros m1
    JOIN membros m2 ON m1.organizacao_id = m2.organizacao_id
    WHERE m1.user_id = auth.uid()
      AND m1.papel = 'admin'
  )
);
