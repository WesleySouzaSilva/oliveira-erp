
-- 1) analises_contratos: adicionar organizacao_id e escopar RLS por org

ALTER TABLE public.analises_contratos
  ADD COLUMN IF NOT EXISTS organizacao_id uuid;

-- Backfill: usar a primeira org do operador
UPDATE public.analises_contratos a
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE a.organizacao_id IS NULL
  AND a.operador_id IS NOT NULL
  AND m.user_id = a.operador_id;

-- Trigger para auto-preencher organizacao_id em novos inserts
DROP TRIGGER IF EXISTS trg_set_org_analises_contratos ON public.analises_contratos;
CREATE TRIGGER trg_set_org_analises_contratos
  BEFORE INSERT ON public.analises_contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_organizacao_id();

-- Função auxiliar local não precisa; usaremos o trigger existente.
-- O trigger lê NEW.user_id; ajustamos para mapear operador_id quando user_id inexistente
-- (mantemos compatível: caso operador_id seja setado, fazemos preenchimento direto)

-- Remove TODAS as policies atuais da tabela (limpeza segura)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'analises_contratos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.analises_contratos', r.policyname);
  END LOOP;
END $$;

-- Novas policies escopadas por organização
CREATE POLICY "analises_contratos_select_org"
  ON public.analises_contratos FOR SELECT
  TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "analises_contratos_insert_org"
  ON public.analises_contratos FOR INSERT
  TO authenticated
  WITH CHECK (
    operador_id = auth.uid()
    AND (organizacao_id IS NULL OR organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  );

CREATE POLICY "analises_contratos_update_own_or_admin"
  ON public.analises_contratos FOR UPDATE
  TO authenticated
  USING (
    operador_id = auth.uid()
    OR (organizacao_id IS NOT NULL AND public.is_admin_in_org(auth.uid(), organizacao_id))
  )
  WITH CHECK (
    operador_id = auth.uid()
    OR (organizacao_id IS NOT NULL AND public.is_admin_in_org(auth.uid(), organizacao_id))
  );

CREATE POLICY "analises_contratos_delete_own_or_admin_same_org"
  ON public.analises_contratos FOR DELETE
  TO authenticated
  USING (
    operador_id = auth.uid()
    OR (organizacao_id IS NOT NULL AND public.is_admin_in_org(auth.uid(), organizacao_id))
  );

-- 2) movimentacoes: restringir INSERT a authenticated
DROP POLICY IF EXISTS "Users can create movimentacoes" ON public.movimentacoes;
CREATE POLICY "Users can create movimentacoes"
  ON public.movimentacoes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3) processos: restringir INSERT a authenticated
DROP POLICY IF EXISTS "Users can create processos" ON public.processos;
CREATE POLICY "Users can create processos"
  ON public.processos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4) rh_salarios: permitir colaborador ver seu próprio histórico salarial
DROP POLICY IF EXISTS "rh_salarios_self_view" ON public.rh_salarios;
CREATE POLICY "rh_salarios_self_view"
  ON public.rh_salarios FOR SELECT
  TO authenticated
  USING (public.is_own_member(auth.uid(), membro_id));

-- 5) rh_tabela_salarial: permitir membros da org consultarem as faixas
DROP POLICY IF EXISTS "rh_tabela_salarial_member_read" ON public.rh_tabela_salarial;
CREATE POLICY "rh_tabela_salarial_member_read"
  ON public.rh_tabela_salarial FOR SELECT
  TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
