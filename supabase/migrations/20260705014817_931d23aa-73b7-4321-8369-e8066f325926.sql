
-- 1) Add cliente_id to processos (nullable FK)
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_processos_cliente ON public.processos(cliente_id);

-- 2) Add visivel_cliente to processo_andamentos
ALTER TABLE public.processo_andamentos
  ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT false;

-- 3) cliente_portal_usuarios table
CREATE TABLE IF NOT EXISTS public.cliente_portal_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  convidado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpu_cliente ON public.cliente_portal_usuarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cpu_user ON public.cliente_portal_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_cpu_org ON public.cliente_portal_usuarios(organizacao_id);

GRANT SELECT ON public.cliente_portal_usuarios TO authenticated;
GRANT ALL ON public.cliente_portal_usuarios TO service_role;

ALTER TABLE public.cliente_portal_usuarios ENABLE ROW LEVEL SECURITY;

-- Equipe interna vê usuários-portal da sua org
CREATE POLICY "cpu_select_interna"
ON public.cliente_portal_usuarios FOR SELECT TO authenticated
USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

-- Próprio usuário externo vê o seu registro
CREATE POLICY "cpu_select_proprio"
ON public.cliente_portal_usuarios FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_cpu_updated_at
  BEFORE UPDATE ON public.cliente_portal_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Helper function
CREATE OR REPLACE FUNCTION public.cliente_do_usuario_portal(uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cliente_id FROM public.cliente_portal_usuarios
  WHERE user_id = uid AND ativo = true
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.cliente_do_usuario_portal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cliente_do_usuario_portal(uuid) TO authenticated, service_role;

-- 5) Portal-cliente SELECT policies (additive; do not touch internal ones)
DROP POLICY IF EXISTS "processos_select_portal_cliente" ON public.processos;
CREATE POLICY "processos_select_portal_cliente"
ON public.processos FOR SELECT TO authenticated
USING (
  cliente_id IS NOT NULL
  AND cliente_id = public.cliente_do_usuario_portal(auth.uid())
);

DROP POLICY IF EXISTS "andamentos_select_portal_cliente" ON public.processo_andamentos;
CREATE POLICY "andamentos_select_portal_cliente"
ON public.processo_andamentos FOR SELECT TO authenticated
USING (
  visivel_cliente = true
  AND EXISTS (
    SELECT 1 FROM public.processos p
    WHERE p.id = processo_andamentos.processo_id
      AND p.cliente_id IS NOT NULL
      AND p.cliente_id = public.cliente_do_usuario_portal(auth.uid())
  )
);

DROP POLICY IF EXISTS "clientes_select_portal_proprio" ON public.clientes;
CREATE POLICY "clientes_select_portal_proprio"
ON public.clientes FOR SELECT TO authenticated
USING (id = public.cliente_do_usuario_portal(auth.uid()));
