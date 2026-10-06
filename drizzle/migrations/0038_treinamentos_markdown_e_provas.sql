-- ============ PARTE 1: markdown, prova de saida, coordenador como gestor ============
ALTER TABLE public.trein_aulas ADD COLUMN IF NOT EXISTS conteudo_md text;
ALTER TABLE public.trein_aulas ADD COLUMN IF NOT EXISTS prova_de_saida text;

CREATE OR REPLACE FUNCTION public.trein_is_gestor(_uid uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.trein_is_admin(_uid,_org)
      OR (public.trein_is_internal(_uid,_org) AND public.has_role_in_org(_uid,'coordenador'::app_role,_org))
$$;
REVOKE ALL ON FUNCTION public.trein_is_gestor(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trein_is_gestor(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prova_is_lider(_uid uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.trein_is_internal(_uid,_org) AND (
    public.is_admin_in_org(_uid,_org)
    OR public.has_role_in_org(_uid,'coordenador'::app_role,_org)
    OR public.is_ceo(_uid))
$$;
REVOKE ALL ON FUNCTION public.prova_is_lider(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prova_is_lider(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trein_pode_editar_setor(_uid uuid, _setor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.setores s WHERE s.id=_setor AND (
      public.trein_is_gestor(_uid, s.organizacao_id)
      OR (public.trein_is_internal(_uid, s.organizacao_id) AND EXISTS (
        SELECT 1 FROM public.membro_setores ms WHERE ms.user_id=_uid AND ms.lider
          AND (ms.setor_id=s.id OR ms.setor_id=s.pai_id)))))
$$;

CREATE OR REPLACE FUNCTION public.trein_acompanha(_uid uuid, _alvo uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.trein_is_gestor(_uid,_org) OR (public.trein_is_internal(_uid,_org) AND EXISTS (
    SELECT 1 FROM public.membro_setores l
    JOIN public.membro_setores a ON a.user_id=_alvo
    JOIN public.setores sa ON sa.id=a.setor_id
    WHERE l.user_id=_uid AND l.lider AND (a.setor_id=l.setor_id OR sa.pai_id=l.setor_id)))
$$;

CREATE OR REPLACE FUNCTION public.trein_meu_papel()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'admin', coalesce(bool_or(public.trein_is_admin(auth.uid(), m.organizacao_id)), false),
    'gestor', coalesce(bool_or(public.trein_is_gestor(auth.uid(), m.organizacao_id)), false),
    'lider_provas', coalesce(bool_or(public.prova_is_lider(auth.uid(), m.organizacao_id)), false),
    'organizacao_id', min(m.organizacao_id::text),
    'lider_setores', coalesce((SELECT jsonb_agg(setor_id) FROM public.membro_setores WHERE user_id=auth.uid() AND lider), '[]'::jsonb))
  FROM public.membros m WHERE m.user_id = auth.uid()
$$;

-- ============ PARTE 2: provas ============
CREATE TABLE public.provas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  finalidade text NOT NULL DEFAULT 'geral' CHECK (finalidade IN ('geral','passagem_de_cargo','candidato')),
  trilha_id uuid REFERENCES public.trein_trilhas(id) ON DELETE SET NULL,
  cargo_alvo_id uuid REFERENCES public.rh_tabela_salarial(id) ON DELETE SET NULL,
  nota_minima numeric NOT NULL DEFAULT 70,
  tempo_limite_min int,
  embaralhar_questoes boolean NOT NULL DEFAULT true,
  embaralhar_alternativas boolean NOT NULL DEFAULT true,
  tentativas_permitidas int NOT NULL DEFAULT 1,
  retencao_dias int NOT NULL DEFAULT 180,
  publicada boolean NOT NULL DEFAULT false,
  criada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provas TO authenticated;
GRANT ALL ON public.provas TO service_role;
ALTER TABLE public.provas ENABLE ROW LEVEL SECURITY;
CREATE POLICY provas_lider_all ON public.provas FOR ALL TO authenticated
  USING (public.prova_is_lider(auth.uid(), organizacao_id))
  WITH CHECK (public.prova_is_lider(auth.uid(), organizacao_id));

CREATE TABLE public.prova_questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  prova_id uuid NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  enunciado text NOT NULL,
  tipo text NOT NULL DEFAULT 'multipla_escolha' CHECK (tipo IN ('multipla_escolha','dissertativa')),
  peso numeric NOT NULL DEFAULT 1,
  explicacao text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prova_questoes TO authenticated;
GRANT ALL ON public.prova_questoes TO service_role;
ALTER TABLE public.prova_questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY questoes_lider_all ON public.prova_questoes FOR ALL TO authenticated
  USING (public.prova_is_lider(auth.uid(), organizacao_id))
  WITH CHECK (public.prova_is_lider(auth.uid(), organizacao_id));

CREATE TABLE public.prova_alternativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  questao_id uuid NOT NULL REFERENCES public.prova_questoes(id) ON DELETE CASCADE,
  texto text NOT NULL,
  correta boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prova_alternativas TO authenticated;
GRANT ALL ON public.prova_alternativas TO service_role;
ALTER TABLE public.prova_alternativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY alternativas_lider_all ON public.prova_alternativas FOR ALL TO authenticated
  USING (public.prova_is_lider(auth.uid(), organizacao_id))
  WITH CHECK (public.prova_is_lider(auth.uid(), organizacao_id));

CREATE TABLE public.prova_aplicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  prova_id uuid NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  user_id uuid,
  candidato_nome text,
  candidato_email text,
  candidato_telefone text,
  token text UNIQUE,
  token_expira_em timestamptz,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','respondida','corrigida','expirada')),
  iniciada_em timestamptz,
  enviada_em timestamptz,
  nota numeric,
  aprovado boolean,
  corrigida_por uuid,
  corrigida_em timestamptz,
  observacao_do_lider text,
  anonimizada_em timestamptz,
  tentativas_token int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aplicacao_pessoa_ou_candidato CHECK (
    (user_id IS NOT NULL AND candidato_email IS NULL)
    OR (user_id IS NULL)
  )
);
CREATE INDEX idx_prova_aplicacoes_prova ON public.prova_aplicacoes(prova_id);
CREATE INDEX idx_prova_aplicacoes_user ON public.prova_aplicacoes(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prova_aplicacoes TO authenticated;
GRANT ALL ON public.prova_aplicacoes TO service_role;
ALTER TABLE public.prova_aplicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY aplic_lider_all ON public.prova_aplicacoes FOR ALL TO authenticated
  USING (public.prova_is_lider(auth.uid(), organizacao_id))
  WITH CHECK (public.prova_is_lider(auth.uid(), organizacao_id));
CREATE POLICY aplic_own_select ON public.prova_aplicacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.prova_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  aplicacao_id uuid NOT NULL REFERENCES public.prova_aplicacoes(id) ON DELETE CASCADE,
  questao_id uuid NOT NULL REFERENCES public.prova_questoes(id) ON DELETE CASCADE,
  alternativa_id uuid REFERENCES public.prova_alternativas(id) ON DELETE SET NULL,
  resposta_texto text,
  pontos numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aplicacao_id, questao_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prova_respostas TO authenticated;
GRANT ALL ON public.prova_respostas TO service_role;
ALTER TABLE public.prova_respostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY resp_lider_all ON public.prova_respostas FOR ALL TO authenticated
  USING (public.prova_is_lider(auth.uid(), organizacao_id))
  WITH CHECK (public.prova_is_lider(auth.uid(), organizacao_id));
CREATE POLICY resp_own_select ON public.prova_respostas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prova_aplicacoes a WHERE a.id = aplicacao_id AND a.user_id = auth.uid()));

CREATE TRIGGER trg_provas_upd BEFORE UPDATE ON public.provas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_prova_questoes_upd BEFORE UPDATE ON public.prova_questoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_prova_aplic_upd BEFORE UPDATE ON public.prova_aplicacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_prova_resp_upd BEFORE UPDATE ON public.prova_respostas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.prova_fill_parent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_TABLE_NAME = 'prova_questoes' THEN
    SELECT p.organizacao_id INTO NEW.organizacao_id FROM public.provas p WHERE p.id = NEW.prova_id;
  ELSIF TG_TABLE_NAME = 'prova_alternativas' THEN
    SELECT q.organizacao_id INTO NEW.organizacao_id FROM public.prova_questoes q WHERE q.id = NEW.questao_id;
  ELSIF TG_TABLE_NAME = 'prova_aplicacoes' THEN
    SELECT p.organizacao_id INTO NEW.organizacao_id FROM public.provas p WHERE p.id = NEW.prova_id;
  ELSIF TG_TABLE_NAME = 'prova_respostas' THEN
    SELECT a.organizacao_id INTO NEW.organizacao_id FROM public.prova_aplicacoes a WHERE a.id = NEW.aplicacao_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fill BEFORE INSERT ON public.prova_questoes FOR EACH ROW EXECUTE FUNCTION public.prova_fill_parent();
CREATE TRIGGER trg_fill BEFORE INSERT ON public.prova_alternativas FOR EACH ROW EXECUTE FUNCTION public.prova_fill_parent();
CREATE TRIGGER trg_fill BEFORE INSERT ON public.prova_aplicacoes FOR EACH ROW EXECUTE FUNCTION public.prova_fill_parent();
CREATE TRIGGER trg_fill BEFORE INSERT ON public.prova_respostas FOR EACH ROW EXECUTE FUNCTION public.prova_fill_parent();

CREATE OR REPLACE FUNCTION public.prova_anonimizar_candidatos(_org uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; v_n integer;
BEGIN
  v_org := COALESCE(_org, (SELECT m.organizacao_id FROM public.membros m WHERE m.user_id = auth.uid() LIMIT 1));
  IF v_org IS NULL OR NOT public.prova_is_lider(auth.uid(), v_org) THEN
    RAISE EXCEPTION 'sem permissao';
  END IF;
  WITH alvo AS (
    SELECT a.id FROM public.prova_aplicacoes a
    JOIN public.provas p ON p.id = a.prova_id
    WHERE a.organizacao_id = v_org
      AND a.candidato_nome IS NOT NULL
      AND a.anonimizada_em IS NULL
      AND a.created_at < now() - make_interval(days => p.retencao_dias)
  ), upd AS (
    UPDATE public.prova_aplicacoes a
       SET candidato_nome = NULL, candidato_email = NULL, candidato_telefone = NULL,
           token = NULL, anonimizada_em = now()
      FROM alvo WHERE a.id = alvo.id
    RETURNING a.id
  )
  SELECT count(*) INTO v_n FROM upd;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.prova_anonimizar_candidatos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prova_anonimizar_candidatos(uuid) TO authenticated, service_role;