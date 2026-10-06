-- 1) Tabela de grupos de permissão por organização
CREATE TABLE public.permission_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  modulos text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, nome)
);

CREATE INDEX idx_permission_groups_org ON public.permission_groups(organizacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_groups TO authenticated;
GRANT ALL ON public.permission_groups TO service_role;

ALTER TABLE public.permission_groups ENABLE ROW LEVEL SECURITY;

-- Qualquer membro da organização pode visualizar os grupos
CREATE POLICY "Membros visualizam grupos da org"
ON public.permission_groups FOR SELECT
TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

-- Apenas admin pode criar
CREATE POLICY "Admin cria grupos"
ON public.permission_groups FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_in_org(auth.uid(), organizacao_id));

-- Apenas admin pode editar
CREATE POLICY "Admin edita grupos"
ON public.permission_groups FOR UPDATE
TO authenticated
USING (public.is_admin_in_org(auth.uid(), organizacao_id))
WITH CHECK (public.is_admin_in_org(auth.uid(), organizacao_id));

-- Apenas admin pode excluir
CREATE POLICY "Admin exclui grupos"
ON public.permission_groups FOR DELETE
TO authenticated
USING (public.is_admin_in_org(auth.uid(), organizacao_id));

-- Trigger de updated_at
CREATE TRIGGER trg_permission_groups_updated_at
BEFORE UPDATE ON public.permission_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Vínculo do membro a um grupo de permissão (opcional; quando nulo, mantém regra por papel)
ALTER TABLE public.membros
  ADD COLUMN IF NOT EXISTS permission_group_id uuid
    REFERENCES public.permission_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_membros_permission_group
  ON public.membros(permission_group_id);