CREATE TABLE IF NOT EXISTS public.import_cmds (
  seq integer PRIMARY KEY,
  sql text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.import_cmds TO service_role;
GRANT SELECT, INSERT ON public.import_cmds TO authenticated;
ALTER TABLE public.import_cmds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_cmds_admin" ON public.import_cmds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));