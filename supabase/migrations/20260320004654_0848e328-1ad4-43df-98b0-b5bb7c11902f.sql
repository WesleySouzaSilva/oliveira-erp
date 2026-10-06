
-- Table for free client files (not linked to laudos)
CREATE TABLE public.arquivos_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome_cliente text NOT NULL,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL,
  tamanho_bytes bigint DEFAULT 0,
  pasta text DEFAULT 'Geral',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.arquivos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own arquivos_cliente"
  ON public.arquivos_cliente FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own and org arquivos_cliente"
  ON public.arquivos_cliente FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

CREATE POLICY "Users can delete own and org arquivos_cliente"
  ON public.arquivos_cliente FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id));

-- Storage bucket for client drive files
INSERT INTO storage.buckets (id, name, public) VALUES ('cliente-drive', 'cliente-drive', false);

CREATE POLICY "Authenticated users can upload to cliente-drive"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cliente-drive');

CREATE POLICY "Authenticated users can read from cliente-drive"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cliente-drive');

CREATE POLICY "Authenticated users can delete from cliente-drive"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cliente-drive');
