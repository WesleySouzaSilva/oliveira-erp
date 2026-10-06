DO $do$
DECLARE f text;
BEGIN
  f := pg_get_functiondef('public.advbox_importar_clientes(uuid,uuid,jsonb,boolean)'::regprocedure);
  f := replace(f, $a$    WITH ins AS ($a$, $b$    UPDATE _adv a SET via = 'homonimo'
     WHERE a.app_id IS NULL AND coalesce(a.papel_dup,'') <> 'alias' AND (
       EXISTS (SELECT 1 FROM clientes c WHERE c.user_id = _user AND c.nome = normalize_person_name(a.nome))
       OR EXISTS (SELECT 1 FROM _adv b WHERE b.app_id IS NULL AND coalesce(b.papel_dup,'') <> 'alias' AND b.adv_id <> a.adv_id
            AND normalize_person_name(b.nome) = normalize_person_name(a.nome)
            AND (coalesce(b.criado,'infinity'::timestamptz), b.adv_id::bigint) < (coalesce(a.criado,'infinity'::timestamptz), a.adv_id::bigint)));
    WITH ins AS ($b$);
  f := replace(f, $a$FROM _adv a WHERE a.app_id IS NULL AND coalesce(a.papel_dup,'') <> 'alias'
      RETURNING$a$, $b$FROM _adv a WHERE a.app_id IS NULL AND a.via IS NULL AND coalesce(a.papel_dup,'') <> 'alias'
      RETURNING$b$);
  f := replace(f, $a$'sem_destino', count(*) FILTER (WHERE app_id IS NULL)) INTO r FROM _adv;$a$,
    $b$'sem_destino', count(*) FILTER (WHERE app_id IS NULL), 'homonimos', count(*) FILTER (WHERE via='homonimo'),
      'lista_homonimos', coalesce(jsonb_agg(jsonb_build_object('advbox_id', adv_id, 'nome', nome, 'doc', nullif(doc,''), 'cidade', cidade)) FILTER (WHERE via='homonimo'), '[]'::jsonb)) INTO r FROM _adv;$b$);
  IF position('homonimo' in f) = 0 OR position('a.via IS NULL' in f) = 0 OR position('lista_homonimos' in f) = 0 THEN
    RAISE EXCEPTION 'substituição falhou';
  END IF;
  EXECUTE f;
END
$do$;