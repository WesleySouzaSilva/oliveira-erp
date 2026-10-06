
-- Tabela empresa_documentos
CREATE TABLE public.empresa_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas_consultoria(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  arquivo_path text NOT NULL,
  arquivo_nome text,
  mime_type text,
  tamanho_bytes bigint,
  visivel_cliente boolean NOT NULL DEFAULT false,
  enviado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_documentos TO authenticated;
GRANT ALL ON public.empresa_documentos TO service_role;

ALTER TABLE public.empresa_documentos ENABLE ROW LEVEL SECURITY;

-- Trigger para derivar organizacao_id a partir da empresa (mesmo padrão de fn_pedido_servico_set_org)
CREATE OR REPLACE FUNCTION public.fn_empresa_documento_set_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.organizacao_id IS NULL AND NEW.empresa_id IS NOT NULL THEN
    SELECT organizacao_id INTO NEW.organizacao_id
    FROM public.empresas_consultoria WHERE id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_empresa_documento_set_org
BEFORE INSERT ON public.empresa_documentos
FOR EACH ROW EXECUTE FUNCTION public.fn_empresa_documento_set_org();

CREATE TRIGGER trg_empresa_documento_updated_at
BEFORE UPDATE ON public.empresa_documentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_empresa_documentos_empresa ON public.empresa_documentos(empresa_id) WHERE deleted_at IS NULL;

-- RLS: equipe interna (org proprietária)
CREATE POLICY "empresa_documentos_interno_select"
ON public.empresa_documentos FOR SELECT
TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "empresa_documentos_interno_insert"
ON public.empresa_documentos FOR INSERT
TO authenticated
WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "empresa_documentos_interno_update"
ON public.empresa_documentos FOR UPDATE
TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "empresa_documentos_interno_delete"
ON public.empresa_documentos FOR DELETE
TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

-- RLS: portal da empresa (só visíveis, só própria empresa)
CREATE POLICY "empresa_documentos_portal_select"
ON public.empresa_documentos FOR SELECT
TO authenticated
USING (
  empresa_id = public.empresa_do_usuario_portal(auth.uid())
  AND visivel_cliente = true
  AND deleted_at IS NULL
);

-- ============================================================
-- Storage policies para bucket "empresa-documentos"
-- Caminho: {empresa_id}/{uuid}-{nome}
-- ============================================================

CREATE POLICY "empresa_docs_storage_interno_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'empresa-documentos'
  AND EXISTS (
    SELECT 1 FROM public.empresas_consultoria e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
  )
);

CREATE POLICY "empresa_docs_storage_portal_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'empresa-documentos'
  AND EXISTS (
    SELECT 1 FROM public.empresa_documentos d
    WHERE d.arquivo_path = name
      AND d.empresa_id = public.empresa_do_usuario_portal(auth.uid())
      AND d.visivel_cliente = true
      AND d.deleted_at IS NULL
  )
);

CREATE POLICY "empresa_docs_storage_interno_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'empresa-documentos'
  AND EXISTS (
    SELECT 1 FROM public.empresas_consultoria e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
  )
);

CREATE POLICY "empresa_docs_storage_interno_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'empresa-documentos'
  AND EXISTS (
    SELECT 1 FROM public.empresas_consultoria e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
  )
);

CREATE POLICY "empresa_docs_storage_interno_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'empresa-documentos'
  AND EXISTS (
    SELECT 1 FROM public.empresas_consultoria e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
  )
);
