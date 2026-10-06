
CREATE TABLE public.atividades_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome_cliente TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'atendimento',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.atividades_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own atividades"
  ON public.atividades_clientes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own atividades"
  ON public.atividades_clientes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own atividades"
  ON public.atividades_clientes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own atividades"
  ON public.atividades_clientes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
