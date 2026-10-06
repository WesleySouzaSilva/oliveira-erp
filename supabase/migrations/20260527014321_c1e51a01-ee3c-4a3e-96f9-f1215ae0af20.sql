ALTER TABLE public.honorarios_calculos
  ADD COLUMN IF NOT EXISTS numero_proposta TEXT,
  ADD COLUMN IF NOT EXISTS cliente_documento TEXT;

CREATE SEQUENCE IF NOT EXISTS public.honorarios_proposta_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.honorarios_proposta_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gerar_numero_proposta_honorarios()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq INT;
BEGIN
  seq := nextval('public.honorarios_proposta_seq');
  RETURN 'PROP-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_numero_proposta_honorarios() TO authenticated, service_role;