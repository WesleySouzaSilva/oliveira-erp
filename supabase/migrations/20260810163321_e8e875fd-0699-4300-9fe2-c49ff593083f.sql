ALTER TABLE public.laudos
  ADD COLUMN IF NOT EXISTS etapa_desde timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS finalizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS observacao text;

CREATE TABLE IF NOT EXISTS public.laudo_etapa_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  laudo_id uuid NOT NULL REFERENCES public.laudos(id) ON DELETE CASCADE,
  organizacao_id uuid,
  user_id uuid,
  status_anterior text,
  status_novo text NOT NULL,
  dias_na_etapa numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_laudo_hist_laudo ON public.laudo_etapa_historico(laudo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_laudo_hist_org ON public.laudo_etapa_historico(organizacao_id);

GRANT SELECT ON public.laudo_etapa_historico TO authenticated;
GRANT ALL ON public.laudo_etapa_historico TO service_role;

ALTER TABLE public.laudo_etapa_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hist_select_org" ON public.laudo_etapa_historico;
CREATE POLICY "hist_select_org" ON public.laudo_etapa_historico
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE OR REPLACE FUNCTION public.fn_laudo_etapa_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dias numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _dias := ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(OLD.etapa_desde, OLD.created_at))) / 86400.0, 2);
    INSERT INTO public.laudo_etapa_historico (laudo_id, organizacao_id, user_id, status_anterior, status_novo, dias_na_etapa)
    VALUES (NEW.id, NEW.organizacao_id, auth.uid(), OLD.status::text, NEW.status::text, _dias);
    NEW.etapa_desde := now();
    IF NEW.status::text IN ('finalizado','exportado') AND NEW.finalizado_em IS NULL THEN
      NEW.finalizado_em := now();
    END IF;
    IF NEW.status::text NOT IN ('finalizado','exportado') THEN
      NEW.finalizado_em := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_laudo_etapa_historico ON public.laudos;
CREATE TRIGGER trg_laudo_etapa_historico
  BEFORE UPDATE ON public.laudos
  FOR EACH ROW EXECUTE FUNCTION public.fn_laudo_etapa_historico();

UPDATE public.laudos
   SET finalizado_em = COALESCE(finalizado_em, updated_at)
 WHERE status::text IN ('finalizado','exportado') AND finalizado_em IS NULL;