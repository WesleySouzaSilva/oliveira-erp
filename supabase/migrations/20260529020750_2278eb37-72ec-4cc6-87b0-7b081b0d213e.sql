CREATE TABLE public.advbox_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  advbox_id text NOT NULL,
  data date NOT NULL,
  hora text,
  titulo text NOT NULL,
  descricao text,
  cliente_nome text,
  responsavel_email text,
  responsavel_id uuid,
  status text,
  concluida boolean NOT NULL DEFAULT false,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, advbox_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advbox_agenda TO authenticated;
GRANT ALL ON public.advbox_agenda TO service_role;

ALTER TABLE public.advbox_agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advbox_agenda_select_org"
  ON public.advbox_agenda FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "advbox_agenda_admin_write"
  ON public.advbox_agenda FOR ALL TO authenticated
  USING (public.is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (public.is_admin_in_org(auth.uid(), organizacao_id));

CREATE TRIGGER trg_advbox_agenda_updated_at
  BEFORE UPDATE ON public.advbox_agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_advbox_agenda_org_data ON public.advbox_agenda(organizacao_id, data);