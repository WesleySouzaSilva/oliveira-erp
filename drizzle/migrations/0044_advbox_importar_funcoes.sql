CREATE OR REPLACE FUNCTION public.advbox_fmt_doc(_d text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN length(_d) = 11 THEN substr(_d,1,3)||'.'||substr(_d,4,3)||'.'||substr(_d,7,3)||'-'||substr(_d,10,2)
    WHEN length(_d) = 14 THEN substr(_d,1,2)||'.'||substr(_d,3,3)||'.'||substr(_d,6,3)||'/'||substr(_d,9,4)||'-'||substr(_d,13,2)
    ELSE NULL END
$$;

-- Importa/sincroniza clientes do ADVBOX (mão única). _teste=true: executa e desfaz tudo, devolvendo o relatório.
CREATE OR REPLACE FUNCTION public.advbox_importar_clientes(_org uuid, _user uuid, _dados jsonb, _teste boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb;
  antes jsonb; depois jsonb;
  v_resp_antes text; v_resp_depois text;
BEGIN
  SELECT jsonb_build_object(
    'notificacoes_sistema', (SELECT count(*) FROM notificacoes_sistema),
    'tarefas', (SELECT count(*) FROM tarefas),
    'fila_distribuicao', (SELECT count(*) FROM clientes WHERE organizacao_id=_org AND aguardando_distribuicao AND deleted_at IS NULL),
    'com_responsavel', (SELECT count(*) FROM clientes WHERE organizacao_id=_org AND responsavel_pos_venda IS NOT NULL),
    'clientes', (SELECT count(*) FROM clientes WHERE organizacao_id=_org AND deleted_at IS NULL)) INTO antes;
  SELECT md5(string_agg(id::text||coalesce(responsavel_pos_venda::text,'-'), ',' ORDER BY id)) INTO v_resp_antes FROM clientes WHERE organizacao_id=_org;

  BEGIN
    CREATE TEMP TABLE _adv ON COMMIT DROP AS
    SELECT (e->>'id') AS adv_id, btrim(e->>'name') AS nome,
           regexp_replace(coalesce(e->>'identification',''),'\D','','g') AS doc,
           nullif(btrim(coalesce(nullif(e->>'cellphone',''), e->>'phone')),'') AS tel,
           nullif(btrim(e->>'email'),'') AS email, nullif(btrim(e->>'city'),'') AS cidade,
           nullif(upper(btrim(e->>'state')),'') AS uf, nullif(btrim(e->>'notes'),'') AS notas,
           nullif(e->>'created_at','')::timestamptz AS criado,
           lower(regexp_replace(f_unaccent(coalesce(e->>'name','')),'\s+',' ','g')) AS nn,
           NULL::text AS papel_dup, NULL::uuid AS app_id, NULL::text AS via
    FROM jsonb_array_elements(_dados) e WHERE coalesce(e->>'id','') <> '' AND coalesce(btrim(e->>'name'),'') <> '';
    UPDATE _adv SET nn = btrim(nn), doc = CASE WHEN length(doc) IN (11,14) THEN doc ELSE '' END;

    -- duplicados por documento: vence id já ligado no app; senão o mais antigo
    WITH d AS (
      SELECT a.adv_id, a.doc, row_number() OVER (PARTITION BY a.doc ORDER BY
        (EXISTS (SELECT 1 FROM clientes c WHERE c.organizacao_id=_org AND c.advbox_customers_id=a.adv_id AND c.deleted_at IS NULL)) DESC,
        a.criado NULLS LAST, a.adv_id::bigint) rn,
        count(*) OVER (PARTITION BY a.doc) n
      FROM _adv a WHERE a.doc <> '')
    UPDATE _adv a SET papel_dup = CASE WHEN d.rn = 1 THEN 'principal' ELSE 'alias' END
    FROM d WHERE d.adv_id = a.adv_id AND d.n > 1;

    -- 1) por id (inclui apelidos já gravados)
    UPDATE _adv a SET app_id = c.id, via = 'id' FROM clientes c
     WHERE c.organizacao_id=_org AND c.deleted_at IS NULL AND c.advbox_customers_id = a.adv_id AND coalesce(a.papel_dup,'') <> 'alias';
    UPDATE _adv a SET app_id = al.cliente_id, via = 'id' FROM advbox_clientes_alias al
     WHERE a.app_id IS NULL AND al.organizacao_id=_org AND al.advbox_customers_id = a.adv_id AND coalesce(a.papel_dup,'') <> 'alias';
    -- 2) por documento (candidato único, ainda não usado)
    UPDATE _adv a SET app_id = x.id, via = 'documento' FROM (
      SELECT regexp_replace(cpf_cnpj,'\D','','g') d, min(id::text)::uuid id, count(*) n FROM clientes
       WHERE organizacao_id=_org AND deleted_at IS NULL AND coalesce(cpf_cnpj,'')<>'' GROUP BY 1) x
     WHERE a.app_id IS NULL AND coalesce(a.papel_dup,'') <> 'alias' AND a.doc <> '' AND x.d = a.doc AND x.n = 1
       AND NOT EXISTS (SELECT 1 FROM _adv b WHERE b.app_id = x.id);
    -- 3) por nome exato (candidato único, sem vínculo ADVBOX)
    UPDATE _adv a SET app_id = x.id, via = 'nome' FROM (
      SELECT btrim(lower(regexp_replace(f_unaccent(nome),'\s+',' ','g'))) nn, min(id::text)::uuid id, count(*) n,
             bool_and(advbox_customers_id IS NULL) livre FROM clientes
       WHERE organizacao_id=_org AND deleted_at IS NULL GROUP BY 1) x
     WHERE a.app_id IS NULL AND coalesce(a.papel_dup,'') <> 'alias' AND x.nn = a.nn AND x.n = 1 AND x.livre
       AND NOT EXISTS (SELECT 1 FROM _adv b WHERE b.app_id = x.id);

    -- existentes: só vínculo e campos vazios
    UPDATE clientes c SET
      advbox_customers_id = coalesce(c.advbox_customers_id, a.adv_id),
      cpf_cnpj = CASE WHEN coalesce(c.cpf_cnpj,'')='' AND a.doc<>'' THEN advbox_fmt_doc(a.doc) ELSE c.cpf_cnpj END,
      cpf_origem = CASE WHEN coalesce(c.cpf_cnpj,'')='' AND a.doc<>'' AND c.cpf_origem IS NULL THEN 'CPF vindo do ADVBOX' ELSE c.cpf_origem END,
      telefone = coalesce(nullif(c.telefone,''), a.tel),
      email = coalesce(nullif(c.email,''), a.email),
      municipio = coalesce(nullif(c.municipio,''), a.cidade),
      uf = coalesce(nullif(c.uf,''), a.uf),
      observacoes = coalesce(nullif(c.observacoes,''), a.notas)
    FROM _adv a WHERE a.app_id = c.id AND (
      c.advbox_customers_id IS NULL OR (coalesce(c.cpf_cnpj,'')='' AND a.doc<>'')
      OR (coalesce(c.telefone,'')='' AND a.tel IS NOT NULL) OR (coalesce(c.email,'')='' AND a.email IS NOT NULL)
      OR (coalesce(c.municipio,'')='' AND a.cidade IS NOT NULL) OR (coalesce(c.uf,'')='' AND a.uf IS NOT NULL)
      OR (coalesce(c.observacoes,'')='' AND a.notas IS NOT NULL));

    -- novos: base histórica, sem responsável, fora da fila
    WITH ins AS (
      INSERT INTO clientes (user_id, organizacao_id, nome, cpf_cnpj, cpf_origem, cpf_origem_em, telefone, email, municipio, uf,
        observacoes, advbox_customers_id, base_historica_advbox, aguardando_distribuicao, triagem_origem, triado_em,
        cadastrado_por, cadastrado_em, responsavel_pos_venda)
      SELECT _user, _org, a.nome, advbox_fmt_doc(a.doc),
        CASE WHEN a.doc<>'' THEN 'CPF vindo do ADVBOX' ELSE 'pendente_advbox' END, now(),
        a.tel, a.email, a.cidade, a.uf, a.notas, a.adv_id, true, false, 'advbox', now(),
        _user, coalesce(a.criado, now()), NULL
      FROM _adv a WHERE a.app_id IS NULL AND coalesce(a.papel_dup,'') <> 'alias'
      RETURNING id, advbox_customers_id)
    UPDATE _adv a SET app_id = ins.id, via = 'novo' FROM ins WHERE ins.advbox_customers_id = a.adv_id;

    -- apelidos dos duplicados
    UPDATE _adv a SET app_id = p.app_id, via = 'alias' FROM _adv p
     WHERE a.papel_dup = 'alias' AND p.papel_dup = 'principal' AND p.doc = a.doc;
    INSERT INTO advbox_clientes_alias (organizacao_id, advbox_customers_id, cliente_id, motivo)
    SELECT _org, adv_id, app_id, 'duplicado_documento' FROM _adv WHERE via = 'alias' AND app_id IS NOT NULL
    ON CONFLICT (organizacao_id, advbox_customers_id) DO NOTHING;

    SELECT jsonb_build_object(
      'recebidos', count(*),
      'por_id', count(*) FILTER (WHERE via='id'), 'por_documento', count(*) FILTER (WHERE via='documento'),
      'por_nome', count(*) FILTER (WHERE via='nome'), 'novos', count(*) FILTER (WHERE via='novo'),
      'novos_sem_documento', count(*) FILTER (WHERE via='novo' AND doc=''), 'apelidos', count(*) FILTER (WHERE via='alias'),
      'sem_destino', count(*) FILTER (WHERE app_id IS NULL)) INTO r FROM _adv;

    SELECT jsonb_build_object(
      'notificacoes_sistema', (SELECT count(*) FROM notificacoes_sistema),
      'tarefas', (SELECT count(*) FROM tarefas),
      'fila_distribuicao', (SELECT count(*) FROM clientes WHERE organizacao_id=_org AND aguardando_distribuicao AND deleted_at IS NULL),
      'com_responsavel', (SELECT count(*) FROM clientes WHERE organizacao_id=_org AND responsavel_pos_venda IS NOT NULL),
      'clientes', (SELECT count(*) FROM clientes WHERE organizacao_id=_org AND deleted_at IS NULL)) INTO depois;
    SELECT md5(string_agg(id::text||coalesce(responsavel_pos_venda::text,'-'), ',' ORDER BY id)) INTO v_resp_depois
      FROM clientes WHERE organizacao_id=_org AND base_historica_advbox = false;
    DROP TABLE _adv;
    IF _teste THEN RAISE EXCEPTION 'advbox_teste_desfeito'; END IF;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'advbox_teste_desfeito' THEN RAISE; END IF;
  END;
  -- responsável dos clientes existentes igual (antes = só não-históricos do início)
  RETURN jsonb_build_object('teste', _teste, 'contagens', r, 'antes', antes, 'depois_na_transacao', depois,
    'responsaveis_existentes_iguais', v_resp_depois IS NOT DISTINCT FROM (
      SELECT md5(string_agg(id::text||coalesce(responsavel_pos_venda::text,'-'), ',' ORDER BY id)) FROM clientes
       WHERE organizacao_id=_org AND base_historica_advbox = false AND created_at <= now()),
    'confirmado_desfeito', CASE WHEN _teste THEN (SELECT count(*) FROM clientes WHERE organizacao_id=_org AND deleted_at IS NULL) = (antes->>'clientes')::int END);
END;
$$;

CREATE OR REPLACE FUNCTION public.advbox_importar_processos(_org uuid, _dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; v_rel int; v_djen int;
BEGIN
  CREATE TEMP TABLE _lp ON COMMIT DROP AS
  SELECT e->>'id' AS adv_id, regexp_replace(coalesce(e->>'process_number',''),'\D','','g') AS cnj, e AS bruto
  FROM jsonb_array_elements(_dados) e WHERE coalesce(e->>'id','') <> '';

  INSERT INTO processos_judiciais AS p (organizacao_id, advbox_lawsuit_id, numero_cnj, numero_cnj_formatado, tipo, grupo, fase, etapa,
    advbox_responsavel_id, advbox_responsavel_nome, responsavel_user_id, observacoes, advbox_criado_em, status_closure_bruto, dados_brutos, sincronizado_em)
  SELECT _org, l.adv_id, nullif(l.cnj,''),
    CASE WHEN length(l.cnj)=20 THEN substr(l.cnj,1,7)||'-'||substr(l.cnj,8,2)||'.'||substr(l.cnj,10,4)||'.'||substr(l.cnj,14,1)||'.'||substr(l.cnj,15,2)||'.'||substr(l.cnj,17,4)
         ELSE nullif(btrim(l.bruto->>'process_number'),'') END,
    nullif(l.bruto->>'type',''), nullif(l.bruto->>'group',''), nullif(l.bruto->>'stage',''), nullif(l.bruto->>'step',''),
    nullif(l.bruto->>'responsible_id',''), nullif(l.bruto->>'responsible',''),
    (SELECT u.user_id FROM controladoria_advbox_usuarios u WHERE u.organizacao_id=_org AND u.advbox_user_id = l.bruto->>'responsible_id' LIMIT 1),
    nullif(btrim(coalesce(l.bruto->>'notes', l.bruto->>'observation')),''),
    nullif(l.bruto->>'created_at','')::timestamptz, nullif(l.bruto->>'status_closure',''), l.bruto, now()
  FROM _lp l
  ON CONFLICT (organizacao_id, advbox_lawsuit_id) DO UPDATE SET
    numero_cnj = EXCLUDED.numero_cnj, numero_cnj_formatado = EXCLUDED.numero_cnj_formatado, tipo = EXCLUDED.tipo, grupo = EXCLUDED.grupo,
    fase = EXCLUDED.fase, etapa = EXCLUDED.etapa, advbox_responsavel_id = EXCLUDED.advbox_responsavel_id,
    advbox_responsavel_nome = EXCLUDED.advbox_responsavel_nome, responsavel_user_id = EXCLUDED.responsavel_user_id,
    observacoes = EXCLUDED.observacoes, status_closure_bruto = EXCLUDED.status_closure_bruto, dados_brutos = EXCLUDED.dados_brutos,
    sincronizado_em = now();

  INSERT INTO processo_judicial_clientes (processo_judicial_id, cliente_id, organizacao_id)
  SELECT DISTINCT p.id, coalesce(c.id, al.cliente_id), _org
  FROM _lp l
  JOIN processos_judiciais p ON p.organizacao_id=_org AND p.advbox_lawsuit_id = l.adv_id
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(l.bruto->'customers','[]'::jsonb)) cu
  LEFT JOIN clientes c ON c.organizacao_id=_org AND c.deleted_at IS NULL
       AND c.advbox_customers_id = coalesce(cu->>'customer_id', cu->>'id')
  LEFT JOIN advbox_clientes_alias al ON al.organizacao_id=_org AND al.advbox_customers_id = coalesce(cu->>'customer_id', cu->>'id')
  WHERE coalesce(c.id, al.cliente_id) IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rel = ROW_COUNT;

  UPDATE djen_comunicacoes d SET processo_judicial_id = p.id
  FROM processos_judiciais p
  WHERE d.organizacao_id=_org AND p.organizacao_id=_org AND d.processo_judicial_id IS NULL
    AND (d.advbox_lawsuit_id = p.advbox_lawsuit_id
         OR (coalesce(d.advbox_lawsuit_id,'')='' AND p.numero_cnj IS NOT NULL AND regexp_replace(coalesce(d.numero_processo,''),'\D','','g') = p.numero_cnj));
  GET DIAGNOSTICS v_djen = ROW_COUNT;

  SELECT jsonb_build_object('recebidos', (SELECT count(*) FROM _lp),
    'processos_total', (SELECT count(*) FROM processos_judiciais WHERE organizacao_id=_org),
    'com_cnj', (SELECT count(*) FROM processos_judiciais WHERE organizacao_id=_org AND numero_cnj IS NOT NULL),
    'relacoes_novas', v_rel, 'intimacoes_ligadas_agora', v_djen) INTO r;
  DROP TABLE _lp;
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.advbox_importar_clientes(uuid, uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advbox_importar_processos(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advbox_importar_clientes(uuid, uuid, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.advbox_importar_processos(uuid, jsonb) TO service_role;