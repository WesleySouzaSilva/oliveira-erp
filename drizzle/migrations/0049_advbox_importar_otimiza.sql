DO $do$
DECLARE f text;
BEGIN
  f := pg_get_functiondef('public.advbox_importar_clientes(uuid,uuid,jsonb,boolean)'::regprocedure);
  f := replace(f, $a$ELSE '' END WHERE true;$a$, $b$ELSE '' END WHERE true;
    ALTER TABLE _adv ADD COLUMN np text;
    UPDATE _adv SET np = normalize_person_name(nome) WHERE true;
    CREATE INDEX ON _adv (np); CREATE INDEX ON _adv (app_id); CREATE INDEX ON _adv (adv_id); CREATE INDEX ON _adv (doc);
    ANALYZE _adv;$b$);
  f := replace(f, 'normalize_person_name(a.nome)', 'a.np');
  f := replace(f, 'normalize_person_name(b.nome)', 'b.np');
  IF position('a.np' in f) = 0 OR position('ANALYZE _adv' in f) = 0 THEN RAISE EXCEPTION 'substituição falhou'; END IF;
  EXECUTE f;
END
$do$;