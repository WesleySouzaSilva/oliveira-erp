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
  SELECT md5(string_agg(id::text||coalesce(responsavel_pos_venda::text,'-'), ',' ORDER BY id)) INTO v_resp_antes FROM clientes WHERE organizacao_id=_org AND base_historica_advbox = false;

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

    WITH d AS (
      SELECT a.adv_id, a.doc, row_number() OVER (PARTITION BY a.doc ORDER BY
        (EXISTS (SELECT 1 FROM clientes c WHERE c.organizacao_id=_org AND c.advbox_customers_id=a.adv_id AND c.deleted_at IS NULL)) DESC,
        a.criado NULLS LAST, a.adv_id::bigint) rn,
        count(*) OVER (PARTITION BY a.doc) n
      FROM _adv a WHERE a.doc <> '')
    UPDATE _adv a SET papel_dup = CASE WHEN d.rn = 1 THEN 'principal' ELSE 'alias' END
    FROM d WHERE d.adv_id = a.adv_id AND d.n > 1;

    UPDATE _adv a SET app_id = c.id, via = 'id' FROM clientes c
     WHERE c.organizacao_id=_org AND c.deleted_at IS NULL AND c.advbox_customers_id = a.adv_id AND coalesce(a.papel_dup,'') <> 'alias';
    UPDATE _adv a SET app_id = al.cliente_id, via = 'id' FROM advbox_clientes_alias al
     WHERE a.app_id IS NULL AND al.organizacao_id=_org AND al.advbox_customers_id = a.adv_id AND coalesce(a.papel_dup,'') <> 'alias';
    UPDATE _adv a SET app_id = x.id, via = 'documento' FROM (
      SELECT regexp_replace(cpf_cnpj,'\D','','g') d, min(id::text)::uuid id, count(*) n FROM clientes
       WHERE organizacao_id=_org AND deleted_at IS NULL AND coalesce(cpf_cnpj,'')<>'' GROUP BY 1) x
     WHERE a.app_id IS NULL AND coalesce(a.papel_dup,'') <> 'alias' AND a.doc <> '' AND x.d = a.doc AND x.n = 1
       AND NOT EXISTS (SELECT 1 FROM _adv b WHERE b.app_id = x.id);
    UPDATE _adv a SET app_id = x.id, via = 'nome' FROM (
      SELECT btrim(lower(regexp_replace(f_unaccent(nome),'\s+',' ','g'))) nn, min(id::text)::uuid id, count(*) n,
             bool_and(advbox_customers_id IS NULL) livre FROM clientes
       WHERE organizacao_id=_org AND deleted_at IS NULL GROUP BY 1) x
     WHERE a.app_id IS NULL AND coalesce(a.papel_dup,'') <> 'alias' AND x.nn = a.nn AND x.n = 1 AND x.livre
       AND NOT EXISTS (SELECT 1 FROM _adv b WHERE b.app_id = x.id);

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
  RETURN jsonb_build_object('teste', _teste, 'contagens', r, 'antes', antes, 'depois_na_transacao', depois,
    'responsaveis_existentes_iguais', v_resp_antes IS NOT DISTINCT FROM v_resp_depois,
    'confirmado_desfeito', CASE WHEN _teste THEN (SELECT count(*) FROM clientes WHERE organizacao_id=_org AND deleted_at IS NULL) = (antes->>'clientes')::int END);
END;
$$;
REVOKE ALL ON FUNCTION public.advbox_importar_clientes(uuid, uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advbox_importar_clientes(uuid, uuid, jsonb, boolean) TO service_role;