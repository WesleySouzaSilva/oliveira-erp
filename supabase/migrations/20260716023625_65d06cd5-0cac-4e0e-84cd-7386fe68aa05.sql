
-- ============================================================
-- ÁREA "DEMANDAS GERAIS" — Causas Avulsas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.causas_avulsas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  titulo text NOT NULL,
  materia text NOT NULL DEFAULT 'outros',
  cliente_nome text NOT NULL,
  cliente_documento text,
  cliente_contato text,
  numero_processo text,
  parte_contraria text,
  valor_causa numeric,
  status text NOT NULL DEFAULT 'novo',
  responsavel_id uuid,
  prazo date,
  descricao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_causas_avulsas_org ON public.causas_avulsas(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_causas_avulsas_status ON public.causas_avulsas(status);
CREATE INDEX IF NOT EXISTS idx_causas_avulsas_prazo ON public.causas_avulsas(prazo);
CREATE INDEX IF NOT EXISTS idx_causas_avulsas_materia ON public.causas_avulsas(materia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.causas_avulsas TO authenticated;
GRANT ALL ON public.causas_avulsas TO service_role;

ALTER TABLE public.causas_avulsas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "causas_avulsas_select_org"
  ON public.causas_avulsas FOR SELECT
  TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "causas_avulsas_insert_org"
  ON public.causas_avulsas FOR INSERT
  TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "causas_avulsas_update_org"
  ON public.causas_avulsas FOR UPDATE
  TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "causas_avulsas_delete_org"
  ON public.causas_avulsas FOR DELETE
  TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_causas_avulsas_updated_at
  BEFORE UPDATE ON public.causas_avulsas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- causa_notas ----
CREATE TABLE IF NOT EXISTS public.causa_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  causa_id uuid NOT NULL REFERENCES public.causas_avulsas(id) ON DELETE CASCADE,
  autor_id uuid,
  conteudo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_causa_notas_causa ON public.causa_notas(causa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_causa_notas_org ON public.causa_notas(organizacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.causa_notas TO authenticated;
GRANT ALL ON public.causa_notas TO service_role;

ALTER TABLE public.causa_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "causa_notas_select_org"
  ON public.causa_notas FOR SELECT
  TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "causa_notas_insert_org"
  ON public.causa_notas FOR INSERT
  TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "causa_notas_update_org"
  ON public.causa_notas FOR UPDATE
  TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND autor_id = auth.uid())
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND autor_id = auth.uid());

CREATE POLICY "causa_notas_delete_org"
  ON public.causa_notas FOR DELETE
  TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND autor_id = auth.uid());

-- ============================================================
-- Adiciona 'causa_avulsa' ao get_proximos_vencimentos_kanban
-- (mesma assinatura, apenas mais um UNION ALL)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_proximos_vencimentos_kanban()
 RETURNS TABLE(origem text, ref_id uuid, processo_id uuid, cliente text, banco text, data date, dias_restantes integer, observacao text, organizacao_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH orgs AS (SELECT public.user_org_ids(auth.uid()) AS oid)
  SELECT 'contrato'::text, cv.id, NULL::uuid, cv.nome_cliente,
         cv.banco, cv.vencimento_proxima_parcela::date,
         (cv.vencimento_proxima_parcela::date - CURRENT_DATE)::int,
         cv.observacoes, cv.organizacao_id
  FROM public.contratos_vencimentos cv
  WHERE cv.deleted_at IS NULL
    AND COALESCE(cv.resolvido, false) = false
    AND cv.vencimento_proxima_parcela IS NOT NULL
    AND cv.organizacao_id IN (SELECT oid FROM orgs)
  UNION ALL
  SELECT 'kanban'::text, m.processo_id, m.processo_id,
         COALESCE(l.dados_etapa1->>'nome','Sem nome'),
         COALESCE(p.dados_fase2->>'banco', l.dados_etapa1->>'banco','—'),
         m.due_date::date,
         (m.due_date::date - CURRENT_DATE)::int,
         m.descricao, m.organizacao_id
  FROM public.kanban_card_meta m
  JOIN public.processos p ON p.id = m.processo_id
  LEFT JOIN public.laudos l ON l.id = p.laudo_id
  WHERE m.due_date IS NOT NULL
    AND m.organizacao_id IN (SELECT oid FROM orgs)
  UNION ALL
  SELECT 'demanda'::text, d.id, NULL::uuid,
         COALESCE(e.nome_fantasia, e.razao_social, 'Empresa'),
         d.assunto,
         d.prazo,
         (d.prazo - CURRENT_DATE)::int,
         d.area, d.organizacao_id
  FROM public.consultoria_demandas d
  JOIN public.empresas_consultoria e ON e.id = d.empresa_id
  WHERE d.deleted_at IS NULL
    AND d.prazo IS NOT NULL
    AND d.status NOT IN ('concluida','cancelada')
    AND d.organizacao_id IN (SELECT oid FROM orgs)
  UNION ALL
  SELECT 'demanda_externa'::text, de.id, NULL::uuid,
         COALESCE(e.nome_fantasia, e.razao_social, 'Empresa'),
         COALESCE(de.parte_contraria, de.tipo),
         de.prazo,
         (de.prazo - CURRENT_DATE)::int,
         de.titulo, de.organizacao_id
  FROM public.empresa_demandas_externas de
  JOIN public.empresas_consultoria e ON e.id = de.empresa_id
  WHERE de.deleted_at IS NULL
    AND de.prazo IS NOT NULL
    AND de.status NOT IN ('encerrada')
    AND de.organizacao_id IN (SELECT oid FROM orgs)
  UNION ALL
  SELECT 'causa_avulsa'::text, ca.id, NULL::uuid,
         ca.cliente_nome,
         COALESCE(ca.materia, 'outros'),
         ca.prazo,
         (ca.prazo - CURRENT_DATE)::int,
         ca.titulo, ca.organizacao_id
  FROM public.causas_avulsas ca
  WHERE ca.deleted_at IS NULL
    AND ca.prazo IS NOT NULL
    AND ca.status NOT IN ('concluido','arquivado')
    AND ca.organizacao_id IN (SELECT oid FROM orgs)
$function$;
