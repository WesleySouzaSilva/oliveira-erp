CREATE TABLE public.peticoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  laudo_id uuid REFERENCES public.laudos(id) ON DELETE SET NULL,
  processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'peticao_inicial',
  titulo text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  secoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.peticoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own peticoes" ON public.peticoes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own peticoes" ON public.peticoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own peticoes" ON public.peticoes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own peticoes" ON public.peticoes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_peticoes_updated_at
  BEFORE UPDATE ON public.peticoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();