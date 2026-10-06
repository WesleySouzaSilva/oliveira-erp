
CREATE TABLE public.kanban_etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT 'bg-muted text-foreground border-border',
  categoria text NOT NULL DEFAULT 'livre' CHECK (categoria IN ('banco','urgencia','tipo','livre')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_etiquetas TO authenticated;
GRANT ALL ON public.kanban_etiquetas TO service_role;
ALTER TABLE public.kanban_etiquetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kanban_etiquetas_select" ON public.kanban_etiquetas FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_etiquetas_insert" ON public.kanban_etiquetas FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_etiquetas_update" ON public.kanban_etiquetas FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_etiquetas_delete" ON public.kanban_etiquetas FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE TRIGGER trg_kanban_etiquetas_updated BEFORE UPDATE ON public.kanban_etiquetas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.kanban_card_etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  etiqueta_id uuid NOT NULL REFERENCES public.kanban_etiquetas(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (processo_id, etiqueta_id)
);
CREATE INDEX idx_kanban_card_etiquetas_processo ON public.kanban_card_etiquetas(processo_id);
GRANT SELECT, INSERT, DELETE ON public.kanban_card_etiquetas TO authenticated;
GRANT ALL ON public.kanban_card_etiquetas TO service_role;
ALTER TABLE public.kanban_card_etiquetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kanban_card_etiquetas_select" ON public.kanban_card_etiquetas FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_card_etiquetas_insert" ON public.kanban_card_etiquetas FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_card_etiquetas_delete" ON public.kanban_card_etiquetas FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TABLE public.kanban_card_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organizacao_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (processo_id, user_id)
);
CREATE INDEX idx_kanban_card_membros_processo ON public.kanban_card_membros(processo_id);
CREATE INDEX idx_kanban_card_membros_user ON public.kanban_card_membros(user_id);
GRANT SELECT, INSERT, DELETE ON public.kanban_card_membros TO authenticated;
GRANT ALL ON public.kanban_card_membros TO service_role;
ALTER TABLE public.kanban_card_membros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kanban_card_membros_select" ON public.kanban_card_membros FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_card_membros_insert" ON public.kanban_card_membros FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_card_membros_delete" ON public.kanban_card_membros FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE OR REPLACE FUNCTION public.get_proximos_vencimentos_kanban()
RETURNS TABLE (
  origem text,
  ref_id uuid,
  processo_id uuid,
  cliente text,
  banco text,
  data date,
  dias_restantes integer,
  observacao text,
  organizacao_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
$$;
REVOKE EXECUTE ON FUNCTION public.get_proximos_vencimentos_kanban() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_proximos_vencimentos_kanban() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_kanban_notificar_prazo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _days int;
  _bucket text;
  _mensagem text;
  _membro record;
  _produtor text;
BEGIN
  IF NEW.due_date IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.due_date IS NOT DISTINCT FROM NEW.due_date THEN
    RETURN NEW;
  END IF;
  _days := (NEW.due_date::date - CURRENT_DATE)::int;
  _bucket := CASE
    WHEN _days < 0  THEN 'vencido'
    WHEN _days = 0  THEN 'hoje'
    WHEN _days <= 3 THEN '3d'
    WHEN _days <= 7 THEN '7d'
    WHEN _days <= 15 THEN '15d'
    ELSE NULL
  END;
  IF _bucket IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(l.dados_etapa1->>'nome','Sem nome') INTO _produtor
  FROM public.processos p
  LEFT JOIN public.laudos l ON l.id = p.laudo_id
  WHERE p.id = NEW.processo_id;

  _mensagem := CASE
    WHEN _bucket = 'vencido' THEN 'Prazo VENCIDO há ' || ABS(_days) || ' dia(s) — ' || COALESCE(_produtor,'')
    WHEN _bucket = 'hoje'    THEN 'Prazo vence HOJE — ' || COALESCE(_produtor,'')
    ELSE 'Prazo em ' || _days || ' dia(s) — ' || COALESCE(_produtor,'')
  END;

  FOR _membro IN
    SELECT user_id FROM public.kanban_card_membros WHERE processo_id = NEW.processo_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notificacoes_sistema
      WHERE user_id = _membro.user_id
        AND processo_id = NEW.processo_id
        AND tipo = 'kanban_prazo_' || _bucket
        AND created_at::date = CURRENT_DATE
    ) THEN
      INSERT INTO public.notificacoes_sistema (user_id, processo_id, tipo, mensagem)
      VALUES (_membro.user_id, NEW.processo_id, 'kanban_prazo_' || _bucket, _mensagem);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_kanban_notificar_prazo() FROM PUBLIC, anon;

CREATE TRIGGER trg_kanban_notificar_prazo
  AFTER INSERT OR UPDATE OF due_date ON public.kanban_card_meta
  FOR EACH ROW EXECUTE FUNCTION public.fn_kanban_notificar_prazo();
