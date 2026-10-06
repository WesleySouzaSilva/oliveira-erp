CREATE TABLE public.olivia_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organizacao_id uuid,
  titulo text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_olivia_conversas_user ON public.olivia_conversas(user_id, updated_at DESC);
ALTER TABLE public.olivia_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "olivia_conv_owner_all" ON public.olivia_conversas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_olivia_conv_updated BEFORE UPDATE ON public.olivia_conversas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.olivia_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.olivia_conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL DEFAULT '',
  acoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  rota_origem text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_olivia_msg_conv ON public.olivia_mensagens(conversa_id, created_at);
ALTER TABLE public.olivia_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "olivia_msg_owner_all" ON public.olivia_mensagens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());