-- ===== Módulo Treinamentos (aditivo) =====
CREATE TABLE public.setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  pai_id uuid REFERENCES public.setores(id) ON DELETE RESTRICT,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  institucional boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, nome)
);
CREATE TABLE public.membro_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  setor_id uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  lider boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, setor_id)
);
CREATE TABLE public.trein_trilhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  setor_id uuid NOT NULL REFERENCES public.setores(id) ON DELETE RESTRICT,
  titulo text NOT NULL,
  descricao text,
  obrigatoria boolean NOT NULL DEFAULT false,
  prazo_dias int CHECK (prazo_dias IS NULL OR prazo_dias > 0),
  versao int NOT NULL DEFAULT 0,
  publicada boolean NOT NULL DEFAULT false,
  arquivada boolean NOT NULL DEFAULT false,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.trein_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  trilha_id uuid NOT NULL REFERENCES public.trein_trilhas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.trein_aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  trilha_id uuid NOT NULL REFERENCES public.trein_trilhas(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.trein_modulos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  tipo text NOT NULL CHECK (tipo IN ('video_link','video_arquivo','documento','texto','link','checklist')),
  url text,
  storage_path text,
  conteudo_html text,
  checklist_itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  minutos_estimados int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.trein_questionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  trilha_id uuid NOT NULL REFERENCES public.trein_trilhas(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL UNIQUE REFERENCES public.trein_modulos(id) ON DELETE CASCADE,
  nota_minima int NOT NULL DEFAULT 70 CHECK (nota_minima BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.trein_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  trilha_id uuid NOT NULL REFERENCES public.trein_trilhas(id) ON DELETE CASCADE,
  questionario_id uuid NOT NULL REFERENCES public.trein_questionarios(id) ON DELETE CASCADE,
  enunciado text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  alternativas jsonb NOT NULL DEFAULT '[]'::jsonb,
  indice_correto int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.trein_trilha_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  trilha_id uuid NOT NULL REFERENCES public.trein_trilhas(id) ON DELETE CASCADE,
  versao int NOT NULL,
  exige_refazer boolean NOT NULL DEFAULT false,
  nota text,
  publicada_por uuid,
  publicada_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.trein_atribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  trilha_id uuid NOT NULL REFERENCES public.trein_trilhas(id) ON DELETE CASCADE,
  versao int NOT NULL DEFAULT 1,
  origem text NOT NULL DEFAULT 'auto' CHECK (origem IN ('auto','manual','voluntaria')),
  obrigatoria boolean NOT NULL DEFAULT false,
  atribuida_em timestamptz NOT NULL DEFAULT now(),
  reiniciada_em timestamptz NOT NULL DEFAULT now(),
  prazo_em timestamptz,
  concluida_em timestamptz,
  nota_final numeric(5,1),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida','refazer')),
  aviso_3d_enviado boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, trilha_id)
);
CREATE TABLE public.trein_aula_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  aula_id uuid NOT NULL REFERENCES public.trein_aulas(id) ON DELETE CASCADE,
  trilha_id uuid NOT NULL REFERENCES public.trein_trilhas(id) ON DELETE CASCADE,
  concluida_em timestamptz,
  checklist_marcados jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (user_id, aula_id)
);
CREATE TABLE public.trein_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  questionario_id uuid NOT NULL REFERENCES public.trein_questionarios(id) ON DELETE CASCADE,
  trilha_id uuid NOT NULL REFERENCES public.trein_trilhas(id) ON DELETE CASCADE,
  nota numeric(5,1) NOT NULL,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.membro_setores(setor_id);
CREATE INDEX ON public.trein_trilhas(setor_id);
CREATE INDEX ON public.trein_modulos(trilha_id);
CREATE INDEX ON public.trein_aulas(modulo_id);
CREATE INDEX ON public.trein_atribuicoes(trilha_id);
CREATE INDEX ON public.trein_aula_progresso(user_id, trilha_id);
CREATE INDEX ON public.trein_tentativas(user_id, questionario_id);

-- ===== Helpers =====
CREATE OR REPLACE FUNCTION public.trein_is_internal(_uid uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.membros m WHERE m.user_id=_uid AND m.organizacao_id=_org)
     AND NOT EXISTS (SELECT 1 FROM public.cliente_portal_usuarios c WHERE c.user_id=_uid)
     AND NOT EXISTS (SELECT 1 FROM public.empresa_portal_usuarios e WHERE e.user_id=_uid)
$$;
CREATE OR REPLACE FUNCTION public.trein_is_admin(_uid uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.trein_is_internal(_uid,_org) AND (
    public.is_admin_in_org(_uid,_org)
    OR EXISTS (SELECT 1 FROM public.membros m WHERE m.user_id=_uid AND m.organizacao_id=_org AND m.is_ceo))
$$;
-- setores que a pessoa enxerga: os dela, o pai de cada subgrupo, filhos dos que lidera e o Institucional
CREATE OR REPLACE FUNCTION public.trein_setores_visiveis(_uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ms.setor_id FROM public.membro_setores ms WHERE ms.user_id=_uid
  UNION SELECT s.pai_id FROM public.membro_setores ms JOIN public.setores s ON s.id=ms.setor_id WHERE ms.user_id=_uid AND s.pai_id IS NOT NULL
  UNION SELECT f.id FROM public.membro_setores ms JOIN public.setores f ON f.pai_id=ms.setor_id WHERE ms.user_id=_uid AND ms.lider
  UNION SELECT s.id FROM public.setores s WHERE s.institucional AND public.trein_is_internal(_uid, s.organizacao_id)
$$;
CREATE OR REPLACE FUNCTION public.trein_pode_editar_setor(_uid uuid, _setor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.setores s WHERE s.id=_setor AND (
      public.trein_is_admin(_uid, s.organizacao_id)
      OR (public.trein_is_internal(_uid, s.organizacao_id) AND EXISTS (
        SELECT 1 FROM public.membro_setores ms WHERE ms.user_id=_uid AND ms.lider
          AND (ms.setor_id=s.id OR ms.setor_id=s.pai_id)))))
$$;
CREATE OR REPLACE FUNCTION public.trein_pode_editar_trilha(_uid uuid, _trilha uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trein_trilhas t WHERE t.id=_trilha AND public.trein_pode_editar_setor(_uid, t.setor_id))
$$;
CREATE OR REPLACE FUNCTION public.trein_pode_ver_trilha(_uid uuid, _trilha uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trein_trilhas t WHERE t.id=_trilha AND public.trein_is_internal(_uid, t.organizacao_id) AND (
    public.trein_pode_editar_setor(_uid, t.setor_id)
    OR (t.publicada AND t.setor_id IN (SELECT public.trein_setores_visiveis(_uid)))
    OR EXISTS (SELECT 1 FROM public.trein_atribuicoes a WHERE a.trilha_id=t.id AND a.user_id=_uid)))
$$;
-- admin, ou líder de um setor em que a pessoa está (ou subgrupo dele)
CREATE OR REPLACE FUNCTION public.trein_acompanha(_uid uuid, _alvo uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.trein_is_admin(_uid,_org) OR (public.trein_is_internal(_uid,_org) AND EXISTS (
    SELECT 1 FROM public.membro_setores l
    JOIN public.membro_setores a ON a.user_id=_alvo
    JOIN public.setores sa ON sa.id=a.setor_id
    WHERE l.user_id=_uid AND l.lider AND (a.setor_id=l.setor_id OR sa.pai_id=l.setor_id)))
$$;

-- ===== GRANTs + RLS =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setores, public.membro_setores, public.trein_trilhas, public.trein_modulos,
  public.trein_aulas, public.trein_questionarios, public.trein_perguntas, public.trein_trilha_versoes,
  public.trein_atribuicoes, public.trein_aula_progresso, public.trein_tentativas TO authenticated;
GRANT ALL ON public.setores, public.membro_setores, public.trein_trilhas, public.trein_modulos,
  public.trein_aulas, public.trein_questionarios, public.trein_perguntas, public.trein_trilha_versoes,
  public.trein_atribuicoes, public.trein_aula_progresso, public.trein_tentativas TO service_role;

ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membro_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trein_trilhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trein_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trein_aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trein_questionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trein_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trein_trilha_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trein_atribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trein_aula_progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trein_tentativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY setores_select ON public.setores FOR SELECT TO authenticated USING (public.trein_is_internal(auth.uid(), organizacao_id));
CREATE POLICY setores_admin ON public.setores FOR ALL TO authenticated USING (public.trein_is_admin(auth.uid(), organizacao_id)) WITH CHECK (public.trein_is_admin(auth.uid(), organizacao_id));
CREATE POLICY membro_setores_select ON public.membro_setores FOR SELECT TO authenticated USING (public.trein_is_internal(auth.uid(), organizacao_id));
CREATE POLICY membro_setores_admin ON public.membro_setores FOR ALL TO authenticated USING (public.trein_is_admin(auth.uid(), organizacao_id)) WITH CHECK (public.trein_is_admin(auth.uid(), organizacao_id));

CREATE POLICY trilhas_select ON public.trein_trilhas FOR SELECT TO authenticated USING (public.trein_pode_ver_trilha(auth.uid(), id));
CREATE POLICY trilhas_insert ON public.trein_trilhas FOR INSERT TO authenticated WITH CHECK (public.trein_pode_editar_setor(auth.uid(), setor_id) AND publicada = false);
CREATE POLICY trilhas_update ON public.trein_trilhas FOR UPDATE TO authenticated USING (public.trein_pode_editar_setor(auth.uid(), setor_id)) WITH CHECK (public.trein_pode_editar_setor(auth.uid(), setor_id));
CREATE POLICY trilhas_delete ON public.trein_trilhas FOR DELETE TO authenticated USING (public.trein_pode_editar_setor(auth.uid(), setor_id) AND versao = 0);

CREATE POLICY modulos_select ON public.trein_modulos FOR SELECT TO authenticated USING (public.trein_pode_ver_trilha(auth.uid(), trilha_id));
CREATE POLICY modulos_write ON public.trein_modulos FOR ALL TO authenticated USING (public.trein_pode_editar_trilha(auth.uid(), trilha_id)) WITH CHECK (public.trein_pode_editar_trilha(auth.uid(), trilha_id));
CREATE POLICY aulas_select ON public.trein_aulas FOR SELECT TO authenticated USING (public.trein_pode_ver_trilha(auth.uid(), trilha_id));
CREATE POLICY aulas_write ON public.trein_aulas FOR ALL TO authenticated USING (public.trein_pode_editar_trilha(auth.uid(), trilha_id)) WITH CHECK (public.trein_pode_editar_trilha(auth.uid(), trilha_id));
CREATE POLICY quest_select ON public.trein_questionarios FOR SELECT TO authenticated USING (public.trein_pode_ver_trilha(auth.uid(), trilha_id));
CREATE POLICY quest_write ON public.trein_questionarios FOR ALL TO authenticated USING (public.trein_pode_editar_trilha(auth.uid(), trilha_id)) WITH CHECK (public.trein_pode_editar_trilha(auth.uid(), trilha_id));
-- gabarito: só quem edita lê a tabela direto
CREATE POLICY perguntas_editor ON public.trein_perguntas FOR ALL TO authenticated USING (public.trein_pode_editar_trilha(auth.uid(), trilha_id)) WITH CHECK (public.trein_pode_editar_trilha(auth.uid(), trilha_id));
CREATE POLICY versoes_select ON public.trein_trilha_versoes FOR SELECT TO authenticated USING (public.trein_pode_ver_trilha(auth.uid(), trilha_id));

CREATE POLICY atrib_select ON public.trein_atribuicoes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.trein_acompanha(auth.uid(), user_id, organizacao_id));
CREATE POLICY atrib_admin_delete ON public.trein_atribuicoes FOR DELETE TO authenticated USING (public.trein_is_admin(auth.uid(), organizacao_id));

CREATE POLICY prog_select ON public.trein_aula_progresso FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.trein_acompanha(auth.uid(), user_id, organizacao_id));
CREATE POLICY prog_insert ON public.trein_aula_progresso FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.trein_pode_ver_trilha(auth.uid(), trilha_id));
CREATE POLICY prog_update ON public.trein_aula_progresso FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.trein_pode_ver_trilha(auth.uid(), trilha_id));
CREATE POLICY prog_delete ON public.trein_aula_progresso FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY tent_select ON public.trein_tentativas FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.trein_acompanha(auth.uid(), user_id, organizacao_id));

-- ===== Integridade: organização/trilha herdadas do pai =====
CREATE OR REPLACE FUNCTION public.trein_fill_parent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'trein_trilhas' THEN
    SELECT organizacao_id INTO NEW.organizacao_id FROM public.setores WHERE id = NEW.setor_id;
    NEW.updated_at := now();
  ELSIF TG_TABLE_NAME = 'trein_modulos' THEN
    SELECT organizacao_id INTO NEW.organizacao_id FROM public.trein_trilhas WHERE id = NEW.trilha_id;
  ELSIF TG_TABLE_NAME IN ('trein_aulas','trein_questionarios') THEN
    SELECT organizacao_id, trilha_id INTO NEW.organizacao_id, NEW.trilha_id FROM public.trein_modulos WHERE id = NEW.modulo_id;
  ELSIF TG_TABLE_NAME = 'trein_perguntas' THEN
    SELECT organizacao_id, trilha_id INTO NEW.organizacao_id, NEW.trilha_id FROM public.trein_questionarios WHERE id = NEW.questionario_id;
  ELSIF TG_TABLE_NAME = 'trein_aula_progresso' THEN
    SELECT organizacao_id, trilha_id INTO NEW.organizacao_id, NEW.trilha_id FROM public.trein_aulas WHERE id = NEW.aula_id;
  ELSIF TG_TABLE_NAME = 'membro_setores' THEN
    SELECT organizacao_id INTO NEW.organizacao_id FROM public.setores WHERE id = NEW.setor_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fill BEFORE INSERT OR UPDATE ON public.trein_trilhas FOR EACH ROW EXECUTE FUNCTION public.trein_fill_parent();
CREATE TRIGGER trg_fill BEFORE INSERT OR UPDATE ON public.trein_modulos FOR EACH ROW EXECUTE FUNCTION public.trein_fill_parent();
CREATE TRIGGER trg_fill BEFORE INSERT OR UPDATE ON public.trein_aulas FOR EACH ROW EXECUTE FUNCTION public.trein_fill_parent();
CREATE TRIGGER trg_fill BEFORE INSERT OR UPDATE ON public.trein_questionarios FOR EACH ROW EXECUTE FUNCTION public.trein_fill_parent();
CREATE TRIGGER trg_fill BEFORE INSERT OR UPDATE ON public.trein_perguntas FOR EACH ROW EXECUTE FUNCTION public.trein_fill_parent();
CREATE TRIGGER trg_fill BEFORE INSERT OR UPDATE ON public.trein_aula_progresso FOR EACH ROW EXECUTE FUNCTION public.trein_fill_parent();
CREATE TRIGGER trg_fill BEFORE INSERT OR UPDATE ON public.membro_setores FOR EACH ROW EXECUTE FUNCTION public.trein_fill_parent();

-- ===== Atribuição, recálculo, quiz =====
CREATE OR REPLACE FUNCTION public.trein_notificar(_uid uuid, _msg text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('trein.silencioso', true), '') = 'on' THEN RETURN; END IF;
  INSERT INTO public.notificacoes_sistema (user_id, tipo, mensagem) VALUES (_uid, 'treinamento', _msg);
END $$;

CREATE OR REPLACE FUNCTION public.trein_atribuir(_uid uuid, _trilha uuid, _origem text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; n int;
BEGIN
  SELECT * INTO t FROM public.trein_trilhas WHERE id=_trilha AND publicada AND NOT arquivada;
  IF NOT FOUND OR NOT public.trein_is_internal(_uid, t.organizacao_id) THEN RETURN false; END IF;
  INSERT INTO public.trein_atribuicoes (organizacao_id, user_id, trilha_id, versao, origem, obrigatoria, prazo_em)
  VALUES (t.organizacao_id, _uid, t.id, t.versao, _origem, t.obrigatoria AND _origem <> 'voluntaria',
          CASE WHEN t.obrigatoria AND t.prazo_dias IS NOT NULL AND _origem <> 'voluntaria' THEN now() + make_interval(days => t.prazo_dias) END)
  ON CONFLICT (user_id, trilha_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 AND t.obrigatoria AND _origem <> 'voluntaria' THEN
    PERFORM public.trein_notificar(_uid, 'Novo treinamento obrigatório: "' || t.titulo || '"' ||
      CASE WHEN t.prazo_dias IS NOT NULL THEN ' (prazo de ' || t.prazo_dias || ' dias)' ELSE '' END || '.');
  END IF;
  RETURN n > 0;
END $$;

-- pessoas que devem receber uma trilha: membros do setor, dos subgrupos dele; Institucional = todos
CREATE OR REPLACE FUNCTION public.trein_publico_trilha(_trilha uuid) RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id FROM public.trein_trilhas t JOIN public.setores s ON s.id=t.setor_id JOIN public.membros m ON m.organizacao_id=t.organizacao_id
   WHERE t.id=_trilha AND s.institucional
  UNION
  SELECT ms.user_id FROM public.trein_trilhas t JOIN public.membro_setores ms ON true JOIN public.setores sm ON sm.id=ms.setor_id
   WHERE t.id=_trilha AND (ms.setor_id=t.setor_id OR sm.pai_id=t.setor_id)
$$;

CREATE OR REPLACE FUNCTION public.trein_recalcular(_uid uuid, _trilha uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; tot int; feitas int; qtot int; qok int; media numeric;
BEGIN
  SELECT * INTO a FROM public.trein_atribuicoes WHERE user_id=_uid AND trilha_id=_trilha;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*) INTO tot FROM public.trein_aulas WHERE trilha_id=_trilha;
  SELECT count(*) INTO feitas FROM public.trein_aula_progresso p JOIN public.trein_aulas au ON au.id=p.aula_id
    WHERE p.user_id=_uid AND au.trilha_id=_trilha AND p.concluida_em IS NOT NULL;
  WITH melhores AS (
    SELECT q.id, q.nota_minima, (SELECT max(tt.nota) FROM public.trein_tentativas tt WHERE tt.questionario_id=q.id AND tt.user_id=_uid AND tt.criado_em >= a.reiniciada_em) AS melhor
    FROM public.trein_questionarios q WHERE q.trilha_id=_trilha AND EXISTS (SELECT 1 FROM public.trein_perguntas pg WHERE pg.questionario_id=q.id))
  SELECT count(*), count(*) FILTER (WHERE melhor >= nota_minima), avg(melhor) INTO qtot, qok, media FROM melhores;
  IF tot + qtot > 0 AND feitas = tot AND qok = qtot THEN
    UPDATE public.trein_atribuicoes SET status='concluida', concluida_em=coalesce(concluida_em, now()), nota_final=round(media,1)
     WHERE id=a.id;
  ELSE
    UPDATE public.trein_atribuicoes SET status = CASE WHEN a.status='refazer' AND feitas=0 THEN 'refazer'
        WHEN feitas > 0 OR EXISTS (SELECT 1 FROM public.trein_tentativas tt WHERE tt.user_id=_uid AND tt.trilha_id=_trilha AND tt.criado_em >= a.reiniciada_em) THEN 'em_andamento' ELSE 'pendente' END,
      concluida_em = NULL, nota_final = round(media,1)
     WHERE id=a.id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trein_trg_progresso() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.trein_recalcular(OLD.user_id, OLD.trilha_id); RETURN OLD; END IF;
  -- trilha não obrigatória aberta pelo catálogo: vira atribuição voluntária
  PERFORM public.trein_atribuir(NEW.user_id, NEW.trilha_id, 'voluntaria');
  PERFORM public.trein_recalcular(NEW.user_id, NEW.trilha_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_progresso AFTER INSERT OR UPDATE OR DELETE ON public.trein_aula_progresso FOR EACH ROW EXECUTE FUNCTION public.trein_trg_progresso();

CREATE OR REPLACE FUNCTION public.trein_quiz_perguntas(_questionario uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q record;
BEGIN
  SELECT * INTO q FROM public.trein_questionarios WHERE id=_questionario;
  IF NOT FOUND OR NOT public.trein_pode_ver_trilha(auth.uid(), q.trilha_id) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  RETURN jsonb_build_object('nota_minima', q.nota_minima, 'perguntas', coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', p.id, 'enunciado', p.enunciado, 'alternativas', p.alternativas) ORDER BY p.ordem, p.created_at)
    FROM public.trein_perguntas p WHERE p.questionario_id=q.id), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.trein_quiz_responder(_questionario uuid, _respostas jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q record; tot int; certas int; nota numeric; melhor numeric; uid uuid := auth.uid(); a record;
BEGIN
  SELECT * INTO q FROM public.trein_questionarios WHERE id=_questionario;
  IF NOT FOUND OR uid IS NULL OR NOT public.trein_pode_ver_trilha(uid, q.trilha_id) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  SELECT count(*), count(*) FILTER (WHERE (_respostas ->> p.id::text) IS NOT NULL AND (_respostas ->> p.id::text)::int = p.indice_correto)
    INTO tot, certas FROM public.trein_perguntas p WHERE p.questionario_id=q.id;
  IF tot = 0 THEN RAISE EXCEPTION 'Questionário sem perguntas'; END IF;
  nota := round(certas * 100.0 / tot, 1);
  PERFORM public.trein_atribuir(uid, q.trilha_id, 'voluntaria');
  INSERT INTO public.trein_tentativas (organizacao_id, user_id, questionario_id, trilha_id, nota, respostas)
  VALUES (q.organizacao_id, uid, q.id, q.trilha_id, nota, _respostas);
  SELECT * INTO a FROM public.trein_atribuicoes WHERE user_id=uid AND trilha_id=q.trilha_id;
  SELECT max(t.nota) INTO melhor FROM public.trein_tentativas t WHERE t.questionario_id=q.id AND t.user_id=uid AND t.criado_em >= coalesce(a.reiniciada_em, '-infinity');
  PERFORM public.trein_recalcular(uid, q.trilha_id);
  RETURN jsonb_build_object('nota', nota, 'certas', certas, 'total', tot, 'melhor', melhor, 'aprovado', nota >= q.nota_minima, 'nota_minima', q.nota_minima);
END $$;

CREATE OR REPLACE FUNCTION public.trein_publicar(_trilha uuid, _exige_refazer boolean, _nota text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; nv int; u uuid; atrib int := 0; refaz int := 0; uid uuid := auth.uid();
BEGIN
  SELECT * INTO t FROM public.trein_trilhas WHERE id=_trilha;
  IF NOT FOUND OR NOT public.trein_pode_editar_setor(uid, t.setor_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trein_aulas WHERE trilha_id=t.id) THEN RAISE EXCEPTION 'A trilha precisa de pelo menos uma aula'; END IF;
  nv := t.versao + 1;
  UPDATE public.trein_trilhas SET versao=nv, publicada=true, arquivada=false WHERE id=t.id;
  INSERT INTO public.trein_trilha_versoes (organizacao_id, trilha_id, versao, exige_refazer, nota, publicada_por)
  VALUES (t.organizacao_id, t.id, nv, coalesce(_exige_refazer,false) AND t.versao > 0, _nota, uid);
  IF coalesce(_exige_refazer,false) AND t.versao > 0 THEN
    FOR u IN SELECT user_id FROM public.trein_atribuicoes WHERE trilha_id=t.id AND status='concluida' LOOP
      DELETE FROM public.trein_aula_progresso WHERE user_id=u AND trilha_id=t.id;
      UPDATE public.trein_atribuicoes SET status='refazer', concluida_em=NULL, nota_final=NULL, versao=nv, reiniciada_em=now(), aviso_3d_enviado=false,
        prazo_em = CASE WHEN t.prazo_dias IS NOT NULL AND obrigatoria THEN now() + make_interval(days => t.prazo_dias) END
       WHERE user_id=u AND trilha_id=t.id;
      PERFORM public.trein_notificar(u, 'O treinamento "' || t.titulo || '" foi atualizado e precisa ser refeito.');
      refaz := refaz + 1;
    END LOOP;
  END IF;
  IF t.obrigatoria THEN
    FOR u IN SELECT public.trein_publico_trilha(t.id) LOOP
      IF public.trein_atribuir(u, t.id, 'auto') THEN atrib := atrib + 1; END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('versao', nv, 'atribuidas', atrib, 'refazer', refaz);
END $$;

CREATE OR REPLACE FUNCTION public.trein_trg_membro_setor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tr uuid;
BEGIN
  FOR tr IN SELECT t.id FROM public.trein_trilhas t JOIN public.setores s ON s.id=NEW.setor_id
    WHERE t.publicada AND NOT t.arquivada AND t.obrigatoria AND (t.setor_id=s.id OR t.setor_id=s.pai_id) LOOP
    PERFORM public.trein_atribuir(NEW.user_id, tr, 'auto');
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_membro_setor AFTER INSERT ON public.membro_setores FOR EACH ROW EXECUTE FUNCTION public.trein_trg_membro_setor();

CREATE OR REPLACE FUNCTION public.trein_trg_novo_membro() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tr uuid;
BEGIN
  FOR tr IN SELECT t.id FROM public.trein_trilhas t JOIN public.setores s ON s.id=t.setor_id
    WHERE s.institucional AND s.organizacao_id=NEW.organizacao_id AND t.publicada AND NOT t.arquivada AND t.obrigatoria LOOP
    PERFORM public.trein_atribuir(NEW.user_id, tr, 'auto');
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_trein_novo_membro AFTER INSERT ON public.membros FOR EACH ROW EXECUTE FUNCTION public.trein_trg_novo_membro();

CREATE OR REPLACE FUNCTION public.trein_lembretes() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT a.id, a.user_id, t.titulo, a.prazo_em FROM public.trein_atribuicoes a JOIN public.trein_trilhas t ON t.id=a.trilha_id
    WHERE a.obrigatoria AND a.status <> 'concluida' AND NOT a.aviso_3d_enviado AND a.prazo_em IS NOT NULL
      AND (a.prazo_em AT TIME ZONE 'America/Sao_Paulo')::date <= ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 3)
      AND a.prazo_em > now() LOOP
    PERFORM public.trein_notificar(r.user_id, 'Faltam 3 dias para o prazo do treinamento "' || r.titulo || '" (até ' ||
      to_char(r.prazo_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || ').');
    UPDATE public.trein_atribuicoes SET aviso_3d_enviado=true WHERE id=r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.trein_meu_papel() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'admin', coalesce(bool_or(public.trein_is_admin(auth.uid(), m.organizacao_id)), false),
    'organizacao_id', min(m.organizacao_id::text),
    'lider_setores', coalesce((SELECT jsonb_agg(setor_id) FROM public.membro_setores WHERE user_id=auth.uid() AND lider), '[]'::jsonb))
  FROM public.membros m WHERE m.user_id = auth.uid()
$$;

-- permissões das funções: nunca anon/public
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'trein_is_internal(uuid,uuid)','trein_is_admin(uuid,uuid)','trein_setores_visiveis(uuid)','trein_pode_editar_setor(uuid,uuid)',
    'trein_pode_editar_trilha(uuid,uuid)','trein_pode_ver_trilha(uuid,uuid)','trein_acompanha(uuid,uuid,uuid)',
    'trein_quiz_perguntas(uuid)','trein_quiz_responder(uuid,jsonb)','trein_publicar(uuid,boolean,text)','trein_meu_papel()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'trein_fill_parent()','trein_notificar(uuid,text)','trein_atribuir(uuid,uuid,text)','trein_publico_trilha(uuid)',
    'trein_recalcular(uuid,uuid)','trein_trg_progresso()','trein_trg_membro_setor()','trein_trg_novo_membro()','trein_lembretes()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- ===== Semente de setores (sem trilhas) =====
DO $$ DECLARE o uuid; j uuid; g uuid; BEGIN
  FOR o IN SELECT id FROM public.organizacoes LOOP
    INSERT INTO public.setores (organizacao_id, nome, ordem, institucional) VALUES (o, 'Institucional', 0, true) ON CONFLICT DO NOTHING;
    INSERT INTO public.setores (organizacao_id, nome, ordem) VALUES (o, 'Comercial', 1) ON CONFLICT DO NOTHING;
    INSERT INTO public.setores (organizacao_id, nome, ordem) VALUES (o, 'Jurídico', 2) ON CONFLICT DO NOTHING;
    INSERT INTO public.setores (organizacao_id, nome, ordem) VALUES (o, 'GPR – Gestão de Pessoas e Recursos', 3) ON CONFLICT DO NOTHING;
    INSERT INTO public.setores (organizacao_id, nome, ordem) VALUES (o, 'Marketing', 4) ON CONFLICT DO NOTHING;
    SELECT id INTO j FROM public.setores WHERE organizacao_id=o AND nome='Jurídico';
    SELECT id INTO g FROM public.setores WHERE organizacao_id=o AND nome='GPR – Gestão de Pessoas e Recursos';
    INSERT INTO public.setores (organizacao_id, nome, pai_id, ordem) VALUES (o, 'Pós-venda', j, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.setores (organizacao_id, nome, pai_id, ordem) VALUES (o, 'Financeiro', g, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.setores (organizacao_id, nome, pai_id, ordem) VALUES (o, 'RH', g, 1) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ===== Cron diário de lembretes (08h Brasília) =====
SELECT cron.schedule('treinamentos-lembretes', '0 11 * * *', $cron$SELECT public.trein_lembretes()$cron$);
