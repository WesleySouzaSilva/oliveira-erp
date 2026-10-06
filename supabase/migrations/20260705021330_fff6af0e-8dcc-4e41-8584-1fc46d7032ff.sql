-- ============================================================================
-- FASE 2 do Portal do Cliente do Agro: ATENDIMENTOS e ACORDOS (somente leitura)
-- Reusa cliente_do_usuario_portal() e o padrão visivel_cliente da Fase 1.
-- Aditivo: NÃO altera policies internas.
-- ============================================================================

-- 1) ATENDIMENTOS: já possui cliente_id (vínculo confiável). Só adiciona flag.
ALTER TABLE public.atendimentos_notas
  ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_atend_cliente_visivel
  ON public.atendimentos_notas (cliente_id)
  WHERE visivel_cliente = true;

-- 2) ACORDOS: NÃO havia vínculo confiável com cliente (só nome_cliente e
-- contrato_id sem FK). Adiciona cliente_id (nullable) e flag. Portal só vê
-- linhas com cliente_id definido + visivel_cliente=true.
ALTER TABLE public.acordos_tarefas
  ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_acordos_cliente_visivel
  ON public.acordos_tarefas (cliente_id)
  WHERE visivel_cliente = true;

-- 3) POLICIES ADITIVAS (portal-cliente). Ficam ao lado das policies internas.
-- Sem clause OR — usuário-portal não tem membros, então NENHUMA das internas
-- devolve linha; só estas devolvem, e só o que for do próprio cliente e visível.

DROP POLICY IF EXISTS portal_cliente_view_atendimentos ON public.atendimentos_notas;
CREATE POLICY portal_cliente_view_atendimentos ON public.atendimentos_notas
  FOR SELECT TO authenticated
  USING (
    visivel_cliente = true
    AND cliente_id IS NOT NULL
    AND cliente_id = public.cliente_do_usuario_portal(auth.uid())
  );

DROP POLICY IF EXISTS portal_cliente_view_acordos ON public.acordos_tarefas;
CREATE POLICY portal_cliente_view_acordos ON public.acordos_tarefas
  FOR SELECT TO authenticated
  USING (
    visivel_cliente = true
    AND cliente_id IS NOT NULL
    AND cliente_id = public.cliente_do_usuario_portal(auth.uid())
  );

-- 4) VIEWS de defesa-em-profundidade — só colunas seguras para o cliente.
-- security_invoker=true garante que RLS do usuário chamador ainda aplica.
-- Nada de notas_brutas, honorario_calculo_id, cliente_contato,
-- valor_acordo, responsavel_id, created_by, resultado_tentativa, etc.

CREATE OR REPLACE VIEW public.portal_cliente_atendimentos_view
  WITH (security_invoker = true) AS
SELECT
  id,
  cliente_id,
  titulo,
  origem,
  tipo_contato,
  status,
  relatorio_cliente,
  created_at
FROM public.atendimentos_notas
WHERE visivel_cliente = true;

CREATE OR REPLACE VIEW public.portal_cliente_acordos_view
  WITH (security_invoker = true) AS
SELECT
  id,
  cliente_id,
  titulo,
  descricao,
  status,
  data_vencimento,
  concluida,
  observacoes,
  created_at
FROM public.acordos_tarefas
WHERE visivel_cliente = true;

-- Views herdam privilégios do owner por padrão; GRANT explícito para clareza.
GRANT SELECT ON public.portal_cliente_atendimentos_view TO authenticated;
GRANT SELECT ON public.portal_cliente_acordos_view TO authenticated;