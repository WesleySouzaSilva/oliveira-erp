
-- Table for chat conversation messages per laudo
CREATE TABLE public.laudo_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  laudo_id uuid REFERENCES public.laudos(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.laudo_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own laudo conversations"
  ON public.laudo_conversas FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow org members to view conversations
CREATE POLICY "Org members can view laudo conversations"
  ON public.laudo_conversas FOR SELECT
  TO authenticated
  USING (shares_org(auth.uid(), user_id));

-- Table for AI learning/memory per municipality, bank, agronomist
CREATE TABLE public.laudo_memoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('municipio', 'banco', 'estilo', 'cultura')),
  chave text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  uso_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tipo, chave)
);

ALTER TABLE public.laudo_memoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own memoria"
  ON public.laudo_memoria FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_laudo_conversas_laudo ON public.laudo_conversas(laudo_id, created_at);
CREATE INDEX idx_laudo_memoria_lookup ON public.laudo_memoria(user_id, tipo, chave);
