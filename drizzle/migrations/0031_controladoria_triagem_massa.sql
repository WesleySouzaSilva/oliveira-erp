ALTER TABLE public.djen_comunicacoes DROP CONSTRAINT IF EXISTS djen_comunicacoes_status_triagem_check;
ALTER TABLE public.djen_comunicacoes ADD CONSTRAINT djen_comunicacoes_status_triagem_check CHECK (status_triagem = ANY (ARRAY['nova','lida','tarefa_criada','sem_providencia','tratada_advbox']));
ALTER TABLE public.djen_comunicacoes ADD COLUMN IF NOT EXISTS responsavel_id uuid;
ALTER TABLE public.djen_comunicacoes ADD COLUMN IF NOT EXISTS prazo_sugerido_dias integer;
ALTER TABLE public.djen_comunicacoes ADD COLUMN IF NOT EXISTS prazo_sugerido_trecho text;
ALTER TABLE public.djen_comunicacoes ADD COLUMN IF NOT EXISTS prazo_sugerido_multiplo boolean NOT NULL DEFAULT false;

-- Extrai "prazo (legal/comum) de N (extenso) dias" do texto
CREATE OR REPLACE FUNCTION public.fn_djen_prazo_sugerido()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  re text := '(?:no\s+)?prazo\s+(?:legal\s+|comum\s+|sucessivo\s+)?de\s+(\d{1,3})\s*(?:\([^)]{1,40}\)\s*)?dias(?:\s+[úu]teis)?';
  nums int[];
  trecho text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.texto IS NOT DISTINCT FROM OLD.texto THEN RETURN NEW; END IF;
  SELECT array_agg(DISTINCT (m[1])::int) INTO nums FROM regexp_matches(coalesce(NEW.texto,''), re, 'gi') AS m;
  NEW.prazo_sugerido_dias := NULL; NEW.prazo_sugerido_trecho := NULL; NEW.prazo_sugerido_multiplo := false;
  IF nums IS NULL OR array_length(nums,1) IS NULL THEN RETURN NEW; END IF;
  IF array_length(nums,1) > 1 THEN NEW.prazo_sugerido_multiplo := true; RETURN NEW; END IF;
  trecho := substring(NEW.texto from '(?i)' || re);
  IF trecho IS NULL THEN SELECT (regexp_match(NEW.texto, '(' || re || ')', 'i'))[1] INTO trecho; END IF;
  NEW.prazo_sugerido_dias := nums[1];
  NEW.prazo_sugerido_trecho := trecho;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_djen_prazo_sugerido ON public.djen_comunicacoes;
CREATE TRIGGER trg_djen_prazo_sugerido BEFORE INSERT OR UPDATE OF texto ON public.djen_comunicacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_djen_prazo_sugerido();
-- backfill (dispara o gatilho de sugestão)
UPDATE public.djen_comunicacoes SET texto = texto || '' WHERE texto IS NOT NULL;
UPDATE public.djen_comunicacoes d SET
  prazo_sugerido_dias = NULL WHERE false;

CREATE TABLE public.controladoria_triagem_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  user_id uuid,
  acao text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  observacao text,
  desfeito_em timestamptz,
  desfeito_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.controladoria_triagem_lote_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.controladoria_triagem_lotes(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  comunicacao_id uuid NOT NULL,
  anterior jsonb NOT NULL,
  tarefa_criada_id uuid
);
CREATE INDEX ON public.controladoria_triagem_lote_itens(lote_id);
GRANT SELECT ON public.controladoria_triagem_lotes TO authenticated;
GRANT SELECT ON public.controladoria_triagem_lote_itens TO authenticated;
GRANT ALL ON public.controladoria_triagem_lotes TO service_role;
GRANT ALL ON public.controladoria_triagem_lote_itens TO service_role;
ALTER TABLE public.controladoria_triagem_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controladoria_triagem_lote_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY lotes_select ON public.controladoria_triagem_lotes FOR SELECT TO authenticated
  USING (public.controladoria_is_internal(auth.uid(), organizacao_id));
CREATE POLICY lote_itens_select ON public.controladoria_triagem_lote_itens FOR SELECT TO authenticated
  USING (public.controladoria_is_internal(auth.uid(), organizacao_id));

-- Ação em massa: grava o lote com a situação anterior de cada intimação
CREATE OR REPLACE FUNCTION public.controladoria_triagem_lote(_ids uuid[], _acao text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _org uuid;
  _lote uuid;
  r record;
  _tarefa uuid;
  _fatal date;
  _dias int := nullif(_payload->>'dias','')::int;
  _resp uuid := nullif(_payload->>'responsavel_id','')::uuid;
  _motivo text := nullif(trim(coalesce(_payload->>'motivo','')),'');
  _n int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _acao NOT IN ('lida','tratada_advbox','sem_providencia','atribuir','tarefa') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  IF coalesce(array_length(_ids,1),0) = 0 THEN RAISE EXCEPTION 'Nenhuma intimação selecionada'; END IF;
  SELECT organizacao_id INTO _org FROM djen_comunicacoes WHERE id = _ids[1];
  IF _org IS NULL OR NOT controladoria_is_internal(_uid, _org) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  IF _acao = 'sem_providencia' AND _motivo IS NULL THEN RAISE EXCEPTION 'Informe o motivo de "sem providência"'; END IF;
  IF _acao = 'atribuir' AND _resp IS NULL THEN RAISE EXCEPTION 'Escolha o responsável'; END IF;
  IF _acao = 'tarefa' AND (_dias IS NULL OR _dias < 1) THEN RAISE EXCEPTION 'Informe o prazo em dias'; END IF;

  INSERT INTO controladoria_triagem_lotes(organizacao_id, user_id, acao, observacao)
  VALUES (_org, _uid, _acao, coalesce(_motivo, _payload->>'observacao')) RETURNING id INTO _lote;

  FOR r IN SELECT d.*, c.nome AS cliente_nome FROM djen_comunicacoes d LEFT JOIN clientes c ON c.id = d.cliente_id
           WHERE d.id = ANY(_ids) AND d.organizacao_id = _org FOR UPDATE OF d LOOP
    _tarefa := NULL;
    IF _acao = 'tarefa' THEN
      _fatal := nullif(_payload->'fatais'->>(r.id::text),'')::date;
      IF _fatal IS NULL THEN RAISE EXCEPTION 'Intimação % sem prazo fatal calculado (sem início do prazo)', coalesce(r.numero_processo_mascara, r.numero_processo); END IF;
      INSERT INTO tarefas(organizacao_id, titulo, descricao, data_vencimento, responsavel_id, created_by, nome_cliente, concluida, prioridade)
      VALUES (_org,
        'Prazo ' || coalesce(r.tipo_comunicacao,'intimação') || ' — proc. ' || coalesce(r.numero_processo_mascara, r.numero_processo),
        'Intimação DJEN ' || coalesce(r.sigla_tribunal,'') || ' disponibilizada em ' || to_char(r.data_disponibilizacao,'DD/MM/YYYY') ||
          '. Prazo de ' || _dias || ' dias úteis a partir de ' || to_char(r.inicio_prazo,'DD/MM/YYYY') || '.' || coalesce(E'\n' || r.link, ''),
        _fatal, coalesce(_resp, r.responsavel_id, _uid), _uid,
        coalesce(r.cliente_nome, r.destinatarios->0->>'nome'), false, 'alta')
      RETURNING id INTO _tarefa;
    END IF;
    INSERT INTO controladoria_triagem_lote_itens(lote_id, organizacao_id, comunicacao_id, anterior, tarefa_criada_id)
    VALUES (_lote, _org, r.id, jsonb_build_object(
      'status_triagem', r.status_triagem, 'responsavel_id', r.responsavel_id, 'observacao', r.observacao,
      'prazo_dias', r.prazo_dias, 'prazo_fatal', r.prazo_fatal, 'tarefa_id', r.tarefa_id,
      'triado_por', r.triado_por, 'triado_em', r.triado_em), _tarefa);
    IF _acao = 'atribuir' THEN
      UPDATE djen_comunicacoes SET responsavel_id = _resp WHERE id = r.id;
    ELSIF _acao = 'tarefa' THEN
      UPDATE djen_comunicacoes SET status_triagem = 'tarefa_criada', prazo_dias = _dias, prazo_fatal = _fatal, tarefa_id = _tarefa,
        responsavel_id = coalesce(_resp, responsavel_id), triado_por = _uid, triado_em = now() WHERE id = r.id;
    ELSE
      UPDATE djen_comunicacoes SET status_triagem = _acao,
        observacao = CASE WHEN _acao = 'sem_providencia' THEN _motivo ELSE observacao END,
        triado_por = _uid, triado_em = now() WHERE id = r.id;
    END IF;
    _n := _n + 1;
  END LOOP;
  UPDATE controladoria_triagem_lotes SET quantidade = _n WHERE id = _lote;
  RETURN _lote;
END $$;

CREATE OR REPLACE FUNCTION public.controladoria_triagem_desfazer(_lote uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  l record; i record; _n int := 0;
BEGIN
  SELECT * INTO l FROM controladoria_triagem_lotes WHERE id = _lote;
  IF l IS NULL THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  IF l.desfeito_em IS NOT NULL THEN RAISE EXCEPTION 'Lote já desfeito'; END IF;
  IF _uid IS NULL OR NOT (l.user_id = _uid OR controladoria_is_admin(_uid, l.organizacao_id)) THEN
    RAISE EXCEPTION 'Só quem fez o lote ou o administrador pode desfazer';
  END IF;
  FOR i IN SELECT * FROM controladoria_triagem_lote_itens WHERE lote_id = _lote LOOP
    UPDATE djen_comunicacoes SET
      status_triagem = i.anterior->>'status_triagem',
      responsavel_id = nullif(i.anterior->>'responsavel_id','')::uuid,
      observacao = i.anterior->>'observacao',
      prazo_dias = nullif(i.anterior->>'prazo_dias','')::int,
      prazo_fatal = nullif(i.anterior->>'prazo_fatal','')::date,
      tarefa_id = nullif(i.anterior->>'tarefa_id','')::uuid,
      triado_por = nullif(i.anterior->>'triado_por','')::uuid,
      triado_em = nullif(i.anterior->>'triado_em','')::timestamptz
    WHERE id = i.comunicacao_id;
    IF i.tarefa_criada_id IS NOT NULL THEN DELETE FROM tarefas WHERE id = i.tarefa_criada_id; END IF;
    _n := _n + 1;
  END LOOP;
  UPDATE controladoria_triagem_lotes SET desfeito_em = now(), desfeito_por = _uid WHERE id = _lote;
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.controladoria_triagem_lote(uuid[], text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.controladoria_triagem_desfazer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.controladoria_triagem_lote(uuid[], text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.controladoria_triagem_desfazer(uuid) TO authenticated, service_role;