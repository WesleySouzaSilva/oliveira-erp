DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid, jobname, command FROM cron.job WHERE jobname IN ('controladoria-djen-captura','controladoria-d5-diario') LOOP
    IF position('forceFunctionRegion' in j.command) = 0 THEN
      PERFORM cron.alter_job(j.jobid, command := replace(replace(j.command,
        '/functions/v1/djen-captura''', '/functions/v1/djen-captura?forceFunctionRegion=sa-east-1'''),
        '/functions/v1/controladoria-d5''', '/functions/v1/controladoria-d5?forceFunctionRegion=sa-east-1'''));
    END IF;
  END LOOP;
END $$;