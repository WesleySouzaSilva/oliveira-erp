DO $do$
BEGIN
  EXECUTE replace(pg_get_functiondef('public.advbox_importar_clientes(uuid,uuid,jsonb,boolean)'::regprocedure),
    $a$doc = CASE WHEN length(doc) IN (11,14) THEN doc ELSE '' END;$a$,
    $b$doc = CASE WHEN length(doc) IN (11,14) THEN doc ELSE '' END WHERE true;$b$);
END
$do$;