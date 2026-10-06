ALTER TABLE public.controladoria_oabs ADD COLUMN IF NOT EXISTS nome_busca text;
ALTER TABLE public.djen_comunicacoes ADD COLUMN IF NOT EXISTS capturada_por text;
ALTER TABLE public.djen_comunicacoes ADD CONSTRAINT djen_capturada_por_chk CHECK (capturada_por IS NULL OR capturada_por IN ('oab','nome','ambos'));

CREATE TABLE public.controladoria_conferencia_advbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  processo_judicial_id uuid REFERENCES public.processos_judiciais(id) ON DELETE SET NULL,
  numero_cnj text NOT NULL,
  data date,
  lado text NOT NULL CHECK (lado IN ('so_advbox','so_app')),
  chave text NOT NULL,
  trecho text CHECK (trecho IS NULL OR char_length(trecho) <= 500),
  criado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid,
  UNIQUE (organizacao_id, lado, chave)
);
CREATE INDEX idx_conf_advbox_org_criado ON public.controladoria_conferencia_advbox (organizacao_id, criado_em DESC);
GRANT SELECT, UPDATE ON public.controladoria_conferencia_advbox TO authenticated;
GRANT ALL ON public.controladoria_conferencia_advbox TO service_role;
ALTER TABLE public.controladoria_conferencia_advbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem conferencia" ON public.controladoria_conferencia_advbox FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));
CREATE POLICY "internos resolvem conferencia" ON public.controladoria_conferencia_advbox FOR UPDATE TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id))
  WITH CHECK (public.controladoria_is_internal((select auth.uid()), organizacao_id));

CREATE TABLE public.controladoria_conferencia_processos (
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  processo_judicial_id uuid NOT NULL REFERENCES public.processos_judiciais(id) ON DELETE CASCADE,
  conferido_em timestamptz NOT NULL DEFAULT now(),
  prioridade text,
  pares integer NOT NULL DEFAULT 0,
  so_advbox integer NOT NULL DEFAULT 0,
  so_app integer NOT NULL DEFAULT 0,
  erro text,
  PRIMARY KEY (organizacao_id, processo_judicial_id)
);
CREATE INDEX idx_conf_proc_conferido ON public.controladoria_conferencia_processos (organizacao_id, conferido_em);
GRANT SELECT ON public.controladoria_conferencia_processos TO authenticated;
GRANT ALL ON public.controladoria_conferencia_processos TO service_role;
ALTER TABLE public.controladoria_conferencia_processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem conferidos" ON public.controladoria_conferencia_processos FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));

DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'controladoria-djen-captura' LOOP
    PERFORM cron.alter_job(j.jobid, schedule := '0 4,6,8,10,15,21 * * *');
  END LOOP;
END $$;

SELECT cron.schedule('controladoria-djen-sentinela', '0 10 * * *',
  $c$select net.http_post(url:='https://nfgrldtgowuquzmfgszw.supabase.co/functions/v1/djen-captura?forceFunctionRegion=sa-east-1',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.app_secrets where key='controladoria_cron_secret')),body:='{"acao":"sentinela"}'::jsonb,timeout_milliseconds:=60000);$c$);

SELECT cron.schedule('controladoria-conferencia-advbox', '*/10 5-7 * * *',
  $c$select net.http_post(url:='https://nfgrldtgowuquzmfgszw.supabase.co/functions/v1/controladoria-conferencia-advbox',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.app_secrets where key='controladoria_cron_secret')),body:='{}'::jsonb,timeout_milliseconds:=150000);$c$);