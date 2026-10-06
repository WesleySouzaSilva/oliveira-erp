
-- ============================================================
-- KANBAN TRELLO-LIKE — FASE A (NÚCLEO)
-- Aditivo: não remove nada. processos.fase_atual continua válido.
-- ============================================================

-- 1) processos: ponteiros opcionais para coluna do Kanban e ordem
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS kanban_coluna_id uuid NULL,
  ADD COLUMN IF NOT EXISTS kanban_ordem numeric NULL;

-- ============================================================
-- 2) kanban_colunas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kanban_colunas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  slug text NOT NULL,
  titulo text NOT NULL,
  cor text NOT NULL DEFAULT 'bg-muted text-foreground border-border',
  ordem int NOT NULL DEFAULT 0,
  legacy_fase text NULL,
  arquivada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS kanban_colunas_org_slug_uq
  ON public.kanban_colunas (organizacao_id, slug);
CREATE INDEX IF NOT EXISTS kanban_colunas_org_ordem_idx
  ON public.kanban_colunas (organizacao_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_colunas TO authenticated;
GRANT ALL ON public.kanban_colunas TO service_role;
ALTER TABLE public.kanban_colunas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_colunas_select_org" ON public.kanban_colunas
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_colunas_insert_org" ON public.kanban_colunas
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_colunas_update_org" ON public.kanban_colunas
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_colunas_delete_org" ON public.kanban_colunas
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

DROP TRIGGER IF EXISTS trg_kanban_colunas_updated_at ON public.kanban_colunas;
CREATE TRIGGER trg_kanban_colunas_updated_at
  BEFORE UPDATE ON public.kanban_colunas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) kanban_card_meta (1:1 com processos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kanban_card_meta (
  processo_id uuid PRIMARY KEY REFERENCES public.processos(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  descricao text NULL,
  due_date timestamptz NULL,
  due_origem text NOT NULL DEFAULT 'manual',
  sincroniza_prazo_15d boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kanban_card_meta_org_idx
  ON public.kanban_card_meta (organizacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_card_meta TO authenticated;
GRANT ALL ON public.kanban_card_meta TO service_role;
ALTER TABLE public.kanban_card_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_card_meta_select_org" ON public.kanban_card_meta
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_card_meta_insert_org" ON public.kanban_card_meta
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_card_meta_update_org" ON public.kanban_card_meta
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_card_meta_delete_org" ON public.kanban_card_meta
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

DROP TRIGGER IF EXISTS trg_kanban_card_meta_updated_at ON public.kanban_card_meta;
CREATE TRIGGER trg_kanban_card_meta_updated_at
  BEFORE UPDATE ON public.kanban_card_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4) kanban_checklist_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kanban_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text NULL,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);
CREATE INDEX IF NOT EXISTS kanban_checklist_templates_org_idx
  ON public.kanban_checklist_templates (organizacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_checklist_templates TO authenticated;
GRANT ALL ON public.kanban_checklist_templates TO service_role;
ALTER TABLE public.kanban_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_chk_tpl_select_org" ON public.kanban_checklist_templates
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_chk_tpl_insert_org" ON public.kanban_checklist_templates
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_chk_tpl_update_org" ON public.kanban_checklist_templates
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_chk_tpl_delete_org" ON public.kanban_checklist_templates
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

DROP TRIGGER IF EXISTS trg_kanban_chk_tpl_updated_at ON public.kanban_checklist_templates;
CREATE TRIGGER trg_kanban_chk_tpl_updated_at
  BEFORE UPDATE ON public.kanban_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5) kanban_checklists
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kanban_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  template_id uuid NULL REFERENCES public.kanban_checklist_templates(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);
CREATE INDEX IF NOT EXISTS kanban_checklists_processo_idx
  ON public.kanban_checklists (processo_id);
CREATE INDEX IF NOT EXISTS kanban_checklists_org_idx
  ON public.kanban_checklists (organizacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_checklists TO authenticated;
GRANT ALL ON public.kanban_checklists TO service_role;
ALTER TABLE public.kanban_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_chk_select_org" ON public.kanban_checklists
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_chk_insert_org" ON public.kanban_checklists
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_chk_update_org" ON public.kanban_checklists
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_chk_delete_org" ON public.kanban_checklists
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

DROP TRIGGER IF EXISTS trg_kanban_chk_updated_at ON public.kanban_checklists;
CREATE TRIGGER trg_kanban_chk_updated_at
  BEFORE UPDATE ON public.kanban_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6) kanban_checklist_itens
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kanban_checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.kanban_checklists(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  texto text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  concluido_por uuid NULL,
  concluido_em timestamptz NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kanban_chk_itens_chk_idx
  ON public.kanban_checklist_itens (checklist_id);
CREATE INDEX IF NOT EXISTS kanban_chk_itens_org_idx
  ON public.kanban_checklist_itens (organizacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_checklist_itens TO authenticated;
GRANT ALL ON public.kanban_checklist_itens TO service_role;
ALTER TABLE public.kanban_checklist_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_chk_itens_select_org" ON public.kanban_checklist_itens
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_chk_itens_insert_org" ON public.kanban_checklist_itens
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_chk_itens_update_org" ON public.kanban_checklist_itens
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_chk_itens_delete_org" ON public.kanban_checklist_itens
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

DROP TRIGGER IF EXISTS trg_kanban_chk_itens_updated_at ON public.kanban_checklist_itens;
CREATE TRIGGER trg_kanban_chk_itens_updated_at
  BEFORE UPDATE ON public.kanban_checklist_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7) Função idempotente de seed das 7 colunas padrão + template
-- ============================================================
CREATE OR REPLACE FUNCTION public.kanban_seed_default_columns(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Colunas
  INSERT INTO public.kanban_colunas (organizacao_id, slug, titulo, cor, ordem, legacy_fase)
  VALUES
    (_org_id, 'onboarding',  'Onboarding',       'bg-muted/40 text-foreground border-border',                  1, NULL),
    (_org_id, 'laudo',       'Laudo',            'bg-info/10 text-info border-info/20',                        2, '1'),
    (_org_id, 'notificacao', 'Notificação',      'bg-accent/10 text-accent border-accent/20',                  3, '2'),
    (_org_id, 'aguardando',  'Aguardando (15d)', 'bg-warning/10 text-warning border-warning/20',               4, '3'),
    (_org_id, 'judicial',    'Judicial',         'bg-destructive/10 text-destructive border-destructive/20',   5, '4'),
    (_org_id, 'alongamento', 'Alongamento',      'bg-primary/10 text-primary border-primary/20',               6, NULL),
    (_org_id, 'encerrado',   'Encerrado',        'bg-success/10 text-success border-success/20',               7, '5')
  ON CONFLICT (organizacao_id, slug) DO NOTHING;

  -- Template de Checklist de Onboarding
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_checklist_templates
    WHERE organizacao_id = _org_id AND nome = 'Checklist de Onboarding'
  ) THEN
    INSERT INTO public.kanban_checklist_templates (organizacao_id, nome, descricao, itens)
    VALUES (
      _org_id,
      'Checklist de Onboarding',
      'Itens obrigatórios coletados na reunião pós-fechamento.',
      '[
        {"texto":"Contratos coletados","ordem":1},
        {"texto":"Titularidade da dívida confirmada","ordem":2},
        {"texto":"Cobrança judicial em curso verificada","ordem":3},
        {"texto":"Ameaças/notificações recebidas registradas","ordem":4},
        {"texto":"Documentos enviados ao laudo","ordem":5}
      ]'::jsonb
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.kanban_seed_default_columns(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kanban_seed_default_columns(uuid) TO authenticated, service_role;
