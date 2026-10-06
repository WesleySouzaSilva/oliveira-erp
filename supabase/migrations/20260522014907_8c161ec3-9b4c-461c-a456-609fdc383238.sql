-- Tabela de regimentos internos (visíveis a toda a organização)
CREATE TABLE public.rh_regimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  categoria text DEFAULT 'geral',
  versao text DEFAULT '1.0',
  arquivo_url text,
  storage_path text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rh_regimentos_org ON public.rh_regimentos(organizacao_id);
ALTER TABLE public.rh_regimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_view_regimentos" ON public.rh_regimentos
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND ativo = true);

CREATE POLICY "admin_manage_regimentos" ON public.rh_regimentos
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

CREATE TRIGGER trg_rh_regimentos_updated BEFORE UPDATE ON public.rh_regimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de playbooks por setor
CREATE TABLE public.rh_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  setor text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  categoria text DEFAULT 'processo',
  versao text DEFAULT '1.0',
  arquivo_url text,
  storage_path text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rh_playbooks_org ON public.rh_playbooks(organizacao_id);
CREATE INDEX idx_rh_playbooks_setor ON public.rh_playbooks(setor);
ALTER TABLE public.rh_playbooks ENABLE ROW LEVEL SECURITY;

-- Função: verifica se o usuário tem acesso ao setor de um playbook
CREATE OR REPLACE FUNCTION public.user_has_setor_access(_user_id uuid, _org_id uuid, _setor text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_admin_in_org(_user_id, _org_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.membros m ON m.user_id = p.id
      WHERE p.id = _user_id
        AND m.organizacao_id = _org_id
        AND lower(coalesce(p.setor, '')) = lower(coalesce(_setor, ''))
    );
$$;

CREATE POLICY "setor_view_playbooks" ON public.rh_playbooks
  FOR SELECT TO authenticated
  USING (
    organizacao_id IN (SELECT user_org_ids(auth.uid()))
    AND ativo = true
    AND user_has_setor_access(auth.uid(), organizacao_id, setor)
  );

CREATE POLICY "admin_manage_playbooks" ON public.rh_playbooks
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

CREATE TRIGGER trg_rh_playbooks_updated BEFORE UPDATE ON public.rh_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para arquivos de RH (regimentos e playbooks)
INSERT INTO storage.buckets (id, name, public)
VALUES ('rh-arquivos', 'rh-arquivos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: paths esperados
-- regimentos/{organizacao_id}/{arquivo}
-- playbooks/{organizacao_id}/{setor}/{arquivo}

CREATE POLICY "rh_arquivos_org_read_regimentos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rh-arquivos'
    AND (storage.foldername(name))[1] = 'regimentos'
    AND ((storage.foldername(name))[2])::uuid IN (SELECT user_org_ids(auth.uid()))
  );

CREATE POLICY "rh_arquivos_setor_read_playbooks" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rh-arquivos'
    AND (storage.foldername(name))[1] = 'playbooks'
    AND user_has_setor_access(
      auth.uid(),
      ((storage.foldername(name))[2])::uuid,
      (storage.foldername(name))[3]
    )
  );

CREATE POLICY "rh_arquivos_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rh-arquivos'
    AND is_admin_in_org(auth.uid(), ((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "rh_arquivos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rh-arquivos'
    AND is_admin_in_org(auth.uid(), ((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "rh_arquivos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rh-arquivos'
    AND is_admin_in_org(auth.uid(), ((storage.foldername(name))[2])::uuid)
  );