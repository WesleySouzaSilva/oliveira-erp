
CREATE TABLE public.kanban_card_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  conteudo text NOT NULL,
  mencoes uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kanban_card_comentarios_processo ON public.kanban_card_comentarios(processo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_card_comentarios TO authenticated;
GRANT ALL ON public.kanban_card_comentarios TO service_role;

ALTER TABLE public.kanban_card_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_card_comentarios_select" ON public.kanban_card_comentarios FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_card_comentarios_insert" ON public.kanban_card_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND autor_id = auth.uid()
  );
CREATE POLICY "kanban_card_comentarios_update" ON public.kanban_card_comentarios FOR UPDATE TO authenticated
  USING (autor_id = auth.uid())
  WITH CHECK (autor_id = auth.uid());
CREATE POLICY "kanban_card_comentarios_delete" ON public.kanban_card_comentarios FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.is_admin_in_org(auth.uid(), organizacao_id));

CREATE TRIGGER trg_kanban_card_comentarios_updated BEFORE UPDATE ON public.kanban_card_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.kanban_card_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  autor_id uuid NULL,
  tipo text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kanban_card_atividades_processo ON public.kanban_card_atividades(processo_id, created_at DESC);

GRANT SELECT, INSERT ON public.kanban_card_atividades TO authenticated;
GRANT ALL ON public.kanban_card_atividades TO service_role;

ALTER TABLE public.kanban_card_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_card_atividades_select" ON public.kanban_card_atividades FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
-- INSERT por usuários (atividades manuais) — autor obrigatório = self
CREATE POLICY "kanban_card_atividades_insert" ON public.kanban_card_atividades FOR INSERT TO authenticated
  WITH CHECK (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND (autor_id IS NULL OR autor_id = auth.uid())
  );

CREATE TABLE public.kanban_card_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  tamanho_bytes bigint NOT NULL DEFAULT 0,
  tipo text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kanban_card_anexos_processo ON public.kanban_card_anexos(processo_id);

GRANT SELECT, INSERT, DELETE ON public.kanban_card_anexos TO authenticated;
GRANT ALL ON public.kanban_card_anexos TO service_role;

ALTER TABLE public.kanban_card_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_card_anexos_select" ON public.kanban_card_anexos FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "kanban_card_anexos_insert" ON public.kanban_card_anexos FOR INSERT TO authenticated
  WITH CHECK (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND autor_id = auth.uid()
  );
CREATE POLICY "kanban_card_anexos_delete" ON public.kanban_card_anexos FOR DELETE TO authenticated
  USING (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND (autor_id = auth.uid() OR public.is_admin_in_org(auth.uid(), organizacao_id))
  );

-- Trigger automático de movimentação de coluna
CREATE OR REPLACE FUNCTION public.fn_kanban_card_move_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _de_titulo text;
  _para_titulo text;
BEGIN
  IF NEW.kanban_coluna_id IS NOT DISTINCT FROM OLD.kanban_coluna_id THEN
    RETURN NEW;
  END IF;
  IF NEW.kanban_coluna_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT titulo INTO _de_titulo FROM public.kanban_colunas WHERE id = OLD.kanban_coluna_id;
  SELECT titulo INTO _para_titulo FROM public.kanban_colunas WHERE id = NEW.kanban_coluna_id;

  INSERT INTO public.kanban_card_atividades (processo_id, organizacao_id, autor_id, tipo, dados)
  VALUES (
    NEW.id,
    NEW.organizacao_id,
    auth.uid(),
    'moveu_coluna',
    jsonb_build_object(
      'de_id', OLD.kanban_coluna_id,
      'para_id', NEW.kanban_coluna_id,
      'de_titulo', _de_titulo,
      'para_titulo', _para_titulo
    )
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_kanban_card_move_log() FROM PUBLIC, anon;

CREATE TRIGGER tg_kanban_card_move
  AFTER UPDATE OF kanban_coluna_id ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.fn_kanban_card_move_log();
