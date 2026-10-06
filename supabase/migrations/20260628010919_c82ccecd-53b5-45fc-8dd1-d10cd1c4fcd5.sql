
-- ===== empresa_demandas_externas =====
CREATE TABLE public.empresa_demandas_externas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas_consultoria(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'cobranca',
  parte_contraria text,
  valor numeric,
  status text NOT NULL DEFAULT 'aberta',
  responsavel_id uuid,
  prazo date,
  descricao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_emp_dem_ext_empresa ON public.empresa_demandas_externas(empresa_id);
CREATE INDEX idx_emp_dem_ext_status ON public.empresa_demandas_externas(status);
CREATE INDEX idx_emp_dem_ext_prazo ON public.empresa_demandas_externas(prazo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_demandas_externas TO authenticated;
GRANT ALL ON public.empresa_demandas_externas TO service_role;

ALTER TABLE public.empresa_demandas_externas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demext_select" ON public.empresa_demandas_externas FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "demext_insert" ON public.empresa_demandas_externas FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "demext_update" ON public.empresa_demandas_externas FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "demext_delete" ON public.empresa_demandas_externas FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_emp_dem_ext_updated
  BEFORE UPDATE ON public.empresa_demandas_externas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== empresa_acordos =====
CREATE TABLE public.empresa_acordos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  demanda_externa_id uuid NOT NULL REFERENCES public.empresa_demandas_externas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  valor_acordo numeric,
  condicoes text,
  data_acordo date,
  status text NOT NULL DEFAULT 'proposto',
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_emp_acordos_demanda ON public.empresa_acordos(demanda_externa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_acordos TO authenticated;
GRANT ALL ON public.empresa_acordos TO service_role;

ALTER TABLE public.empresa_acordos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empacordo_select" ON public.empresa_acordos FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "empacordo_insert" ON public.empresa_acordos FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "empacordo_update" ON public.empresa_acordos FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "empacordo_delete" ON public.empresa_acordos FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_emp_acordos_updated
  BEFORE UPDATE ON public.empresa_acordos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Integração com a central de vencimentos =====
-- Estende get_proximos_vencimentos_kanban incluindo 'demanda_externa'
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
$function$;
