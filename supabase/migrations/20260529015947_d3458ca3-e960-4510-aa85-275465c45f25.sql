
DO $$
BEGIN
  PERFORM cron.unschedule('gerar-acordos-recorrentes-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'gerar-acordos-recorrentes-diario',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url:='https://nfgrldtgowuquzmfgszw.supabase.co/functions/v1/gerar-acordos-recorrentes',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZ3JsZHRnb3d1cXV6bWZnc3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTgzNjQsImV4cCI6MjA4OTM3NDM2NH0.IiszIJE7bVhP09QRO_YdHuFpN4K5tAMy6dYugV0DlPk"}'::jsonb,
    body:='{"trigger":"cron"}'::jsonb
  );
  $$
);
