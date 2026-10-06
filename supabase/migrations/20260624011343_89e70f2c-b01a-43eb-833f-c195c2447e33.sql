
-- Fase 2A Consultoria: Central de demandas internas

CREATE TABLE public.consultoria_demandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas_consultoria(id) ON DELETE CASCADE,
  contato_id uuid REFERENCES public.empresa_contatos(id) ON DELETE SET NULL,
  avenca_id uuid REFERENCES public.avencas(id) ON DELETE SET NULL,
  assunto text NOT NULL,
  descricao text,
  area text,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta','urgente')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_analise','aguardando_empresa','concluida','cancelada')),
  responsavel_id uuid,
  prazo date,
  origem text NOT NULL DEFAULT 'interno' CHECK (origem IN ('interno','portal')),
  aberta_por uuid,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_consultoria_demandas_org ON public.consultoria_demandas(organizacao_id);
CREATE INDEX idx_consultoria_demandas_empresa ON public.consultoria_demandas(empresa_id);
CREATE INDEX idx_consultoria_demandas_status ON public.consultoria_demandas(status);
CREATE INDEX idx_consultoria_demandas_prazo ON public.consultoria_demandas(prazo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_demandas TO authenticated;
GRANT ALL ON public.consultoria_demandas TO service_role;

ALTER TABLE public.consultoria_demandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demandas_select_org" ON public.consultoria_demandas FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "demandas_insert_org" ON public.consultoria_demandas FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "demandas_update_org" ON public.consultoria_demandas FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "demandas_delete_org" ON public.consultoria_demandas FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER trg_consultoria_demandas_updated_at
  BEFORE UPDATE ON public.consultoria_demandas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico/thread
CREATE TABLE public.demanda_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  demanda_id uuid NOT NULL REFERENCES public.consultoria_demandas(id) ON DELETE CASCADE,
  autor_id uuid,
  tipo text NOT NULL DEFAULT 'nota_interna' CHECK (tipo IN ('nota_interna','resposta_empresa')),
  conteudo text NOT NULL,
  visivel_empresa boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demanda_interacoes_demanda ON public.demanda_interacoes(demanda_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_interacoes TO authenticated;
GRANT ALL ON public.demanda_interacoes TO service_role;

ALTER TABLE public.demanda_interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demanda_interacoes_select_org" ON public.demanda_interacoes FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "demanda_interacoes_insert_org" ON public.demanda_interacoes FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "demanda_interacoes_update_org" ON public.demanda_interacoes FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "demanda_interacoes_delete_org" ON public.demanda_interacoes FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

-- Estende o agregador de prazos para incluir demandas de consultoria
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
$function$;
