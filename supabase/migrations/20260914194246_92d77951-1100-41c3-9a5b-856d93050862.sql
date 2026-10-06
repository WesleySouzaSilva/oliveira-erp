CREATE TABLE IF NOT EXISTS public.radar_etapas_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacao_id uuid NOT NULL,
  carteira text NOT NULL,
  mapeia text,
  protocola text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, carteira)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_etapas_config TO authenticated;
GRANT ALL ON public.radar_etapas_config TO service_role;

ALTER TABLE public.radar_etapas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "radar_etapas_select" ON public.radar_etapas_config
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT organizacao_id FROM public.membros WHERE user_id = auth.uid()));

CREATE POLICY "radar_etapas_insert" ON public.radar_etapas_config
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_in_org(auth.uid(), organizacao_id));

CREATE POLICY "radar_etapas_update" ON public.radar_etapas_config
  FOR UPDATE TO authenticated
  USING (public.is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (public.is_admin_in_org(auth.uid(), organizacao_id));

CREATE POLICY "radar_etapas_delete" ON public.radar_etapas_config
  FOR DELETE TO authenticated
  USING (public.is_admin_in_org(auth.uid(), organizacao_id));

INSERT INTO public.radar_etapas_config (organizacao_id, carteira, mapeia, protocola)
VALUES
  ('c937a42c-a30b-4c80-a595-7887926683fd', 'Willian',  'Maycon',   'Willian'),
  ('c937a42c-a30b-4c80-a595-7887926683fd', 'Maycon',   'Maycon',   'Vitoria'),
  ('c937a42c-a30b-4c80-a595-7887926683fd', 'Fernanda', 'Fernanda', 'Vitoria'),
  ('c937a42c-a30b-4c80-a595-7887926683fd', 'Vitoria',  'Fernanda', 'Vitoria'),
  ('c937a42c-a30b-4c80-a595-7887926683fd', '__laudos__', 'Lucas', NULL)
ON CONFLICT (organizacao_id, carteira) DO NOTHING;

ALTER TABLE public.operacoes_credito
  ADD COLUMN IF NOT EXISTS laudo_status text NOT NULL DEFAULT 'nao_avaliado',
  ADD COLUMN IF NOT EXISTS pronta_protocolar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pronta_por uuid,
  ADD COLUMN IF NOT EXISTS pronta_em timestamptz;

ALTER TABLE public.operacoes_credito
  DROP CONSTRAINT IF EXISTS operacoes_laudo_status_check;
ALTER TABLE public.operacoes_credito
  ADD CONSTRAINT operacoes_laudo_status_check
  CHECK (laudo_status IN ('nao_avaliado','precisa','pronto','nao_precisa'));

CREATE OR REPLACE FUNCTION public.fn_operacao_pronta_protocolar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pronta_protocolar THEN
    IF COALESCE(NEW.data_conferida, false) = false
       OR NEW.laudo_status NOT IN ('pronto','nao_precisa') THEN
      RAISE EXCEPTION 'A operação só pode ser marcada como pronta para protocolar com a data conferida e o laudo pronto ou dispensado.';
    END IF;
    IF NEW.pronta_em IS NULL THEN
      NEW.pronta_em := now();
    END IF;
    IF NEW.pronta_por IS NULL THEN
      NEW.pronta_por := auth.uid();
    END IF;
  ELSE
    NEW.pronta_em := NULL;
    NEW.pronta_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_operacao_pronta_protocolar() FROM anon, public;

DROP TRIGGER IF EXISTS trg_operacao_pronta_protocolar ON public.operacoes_credito;
CREATE TRIGGER trg_operacao_pronta_protocolar
  BEFORE INSERT OR UPDATE ON public.operacoes_credito
  FOR EACH ROW EXECUTE FUNCTION public.fn_operacao_pronta_protocolar();