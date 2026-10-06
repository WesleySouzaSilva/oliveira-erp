
CREATE TABLE public.advbox_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo_sync text NOT NULL DEFAULT 'all',
  registros_sincronizados integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advbox_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
  ON public.advbox_sync_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

CREATE POLICY "Users can create own sync logs"
  ON public.advbox_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
