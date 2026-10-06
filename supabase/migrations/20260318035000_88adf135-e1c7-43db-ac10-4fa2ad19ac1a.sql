
-- Tabela para metadados dos certificados digitais A1
CREATE TABLE public.certificados_digitais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  titular_nome TEXT,
  titular_cpf TEXT,
  validade_inicio TIMESTAMPTZ,
  validade_fim TIMESTAMPTZ,
  emissor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;

-- Cada usuário só vê seus próprios certificados
CREATE POLICY "Users can manage own certificates"
  ON public.certificados_digitais
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bucket privado para armazenar os .pfx
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados', 'certificados', false);

-- RLS no storage: cada usuário só acessa sua pasta
CREATE POLICY "Users can upload own certificates"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificados' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own certificates"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'certificados' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own certificates"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'certificados' AND (storage.foldername(name))[1] = auth.uid()::text);
