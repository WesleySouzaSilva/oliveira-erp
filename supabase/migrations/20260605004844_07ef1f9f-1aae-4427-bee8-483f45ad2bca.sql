-- ================================================================
-- MENSAGERIA INTERNA — Fase 1
-- ================================================================

-- 1) CONVERSAS
CREATE TABLE public.conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'direta' CHECK (tipo IN ('direta','grupo')),
  titulo text,
  criada_por uuid NOT NULL,
  cliente_id uuid,
  laudo_id uuid,
  processo_id uuid,
  ultima_mensagem_em timestamptz NOT NULL DEFAULT now(),
  ultima_mensagem_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas TO authenticated;
GRANT ALL ON public.conversas TO service_role;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

-- 2) MEMBROS DA CONVERSA
CREATE TABLE public.conversa_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel text NOT NULL DEFAULT 'membro' CHECK (papel IN ('admin','membro')),
  entrou_em timestamptz NOT NULL DEFAULT now(),
  ultima_leitura_em timestamptz NOT NULL DEFAULT now(),
  saiu_em timestamptz,
  UNIQUE (conversa_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversa_membros TO authenticated;
GRANT ALL ON public.conversa_membros TO service_role;
ALTER TABLE public.conversa_membros ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_conversa_membros_user ON public.conversa_membros(user_id) WHERE saiu_em IS NULL;
CREATE INDEX idx_conversa_membros_conversa ON public.conversa_membros(conversa_id);

-- 3) MENSAGENS
CREATE TABLE public.mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  conteudo text NOT NULL,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  mencoes uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  editada_em timestamptz,
  excluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens TO authenticated;
GRANT ALL ON public.mensagens TO service_role;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mensagens_conversa_data ON public.mensagens(conversa_id, created_at DESC);
CREATE INDEX idx_mensagens_org ON public.mensagens(organizacao_id);
CREATE INDEX idx_mensagens_mencoes ON public.mensagens USING GIN(mencoes);

-- ================================================================
-- HELPERS (security definer) — evitam recursão em RLS
-- ================================================================
CREATE OR REPLACE FUNCTION public.is_conversa_member(_user_id uuid, _conversa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversa_membros
    WHERE conversa_id = _conversa_id AND user_id = _user_id AND saiu_em IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversa_admin(_user_id uuid, _conversa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversa_membros
    WHERE conversa_id = _conversa_id AND user_id = _user_id AND papel = 'admin' AND saiu_em IS NULL
  );
$$;

-- ================================================================
-- RLS POLICIES
-- ================================================================

-- conversas
CREATE POLICY "ver conversas que sou membro"
  ON public.conversas FOR SELECT TO authenticated
  USING (public.is_conversa_member(auth.uid(), id));

CREATE POLICY "criar conversas na minha org"
  ON public.conversas FOR INSERT TO authenticated
  WITH CHECK (
    criada_por = auth.uid()
    AND organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
  );

CREATE POLICY "atualizar conversa se for admin dela"
  ON public.conversas FOR UPDATE TO authenticated
  USING (public.is_conversa_admin(auth.uid(), id))
  WITH CHECK (public.is_conversa_admin(auth.uid(), id));

CREATE POLICY "excluir conversa se for criador"
  ON public.conversas FOR DELETE TO authenticated
  USING (criada_por = auth.uid());

-- conversa_membros
CREATE POLICY "ver membros das minhas conversas"
  ON public.conversa_membros FOR SELECT TO authenticated
  USING (public.is_conversa_member(auth.uid(), conversa_id));

CREATE POLICY "adicionar membros se for admin ou criador"
  ON public.conversa_membros FOR INSERT TO authenticated
  WITH CHECK (
    public.is_conversa_admin(auth.uid(), conversa_id)
    OR EXISTS (SELECT 1 FROM public.conversas c WHERE c.id = conversa_id AND c.criada_por = auth.uid())
  );

CREATE POLICY "atualizar minha leitura ou se for admin"
  ON public.conversa_membros FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_conversa_admin(auth.uid(), conversa_id))
  WITH CHECK (user_id = auth.uid() OR public.is_conversa_admin(auth.uid(), conversa_id));

CREATE POLICY "sair da conversa ou admin remove"
  ON public.conversa_membros FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_conversa_admin(auth.uid(), conversa_id));

-- mensagens
CREATE POLICY "ver mensagens das minhas conversas"
  ON public.mensagens FOR SELECT TO authenticated
  USING (public.is_conversa_member(auth.uid(), conversa_id));

CREATE POLICY "enviar mensagem nas minhas conversas"
  ON public.mensagens FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND public.is_conversa_member(auth.uid(), conversa_id)
  );

CREATE POLICY "editar minha própria mensagem"
  ON public.mensagens FOR UPDATE TO authenticated
  USING (autor_id = auth.uid())
  WITH CHECK (autor_id = auth.uid());

CREATE POLICY "excluir minha própria mensagem"
  ON public.mensagens FOR DELETE TO authenticated
  USING (autor_id = auth.uid());

-- ================================================================
-- TRIGGERS
-- ================================================================

-- updated_at em conversas
CREATE TRIGGER trg_conversas_updated_at
  BEFORE UPDATE ON public.conversas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quando uma mensagem é inserida:
--   1) atualiza ultima_mensagem_em + preview na conversa
--   2) cria notificações para cada @mencionado
CREATE OR REPLACE FUNCTION public.fn_apos_mensagem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mencionado uuid;
  _autor_nome text;
BEGIN
  UPDATE public.conversas
     SET ultima_mensagem_em = NEW.created_at,
         ultima_mensagem_preview = left(NEW.conteudo, 140),
         updated_at = now()
   WHERE id = NEW.conversa_id;

  IF array_length(NEW.mencoes, 1) > 0 THEN
    SELECT COALESCE(nome, 'Alguém') INTO _autor_nome FROM public.profiles WHERE id = NEW.autor_id;
    FOREACH _mencionado IN ARRAY NEW.mencoes LOOP
      IF _mencionado <> NEW.autor_id THEN
        INSERT INTO public.notificacoes_sistema (user_id, tipo, titulo, mensagem, link)
        VALUES (
          _mencionado,
          'mencao_mensagem',
          _autor_nome || ' mencionou você',
          left(NEW.conteudo, 200),
          '/mensagens?c=' || NEW.conversa_id::text
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apos_mensagem
  AFTER INSERT ON public.mensagens
  FOR EACH ROW EXECUTE FUNCTION public.fn_apos_mensagem();

-- ================================================================
-- REALTIME
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversa_membros;
ALTER TABLE public.mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.conversas REPLICA IDENTITY FULL;
ALTER TABLE public.conversa_membros REPLICA IDENTITY FULL;
