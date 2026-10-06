CREATE OR REPLACE FUNCTION public.fn_cliente_auto_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escolhido uuid;
BEGIN
  IF NEW.responsavel_pos_venda IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.situacao, 'ativo') <> 'ativo' THEN
    RETURN NEW;
  END IF;
  IF NEW.organizacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.responsavel_pos_venda
    INTO escolhido
  FROM public.clientes c
  WHERE c.organizacao_id = NEW.organizacao_id
    AND c.responsavel_pos_venda IS NOT NULL
    AND c.deleted_at IS NULL
    AND COALESCE(c.situacao, 'ativo') = 'ativo'
  GROUP BY c.responsavel_pos_venda
  ORDER BY count(*) ASC, c.responsavel_pos_venda
  LIMIT 1;

  NEW.responsavel_pos_venda := escolhido;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cliente_auto_responsavel() FROM anon, public;

DROP TRIGGER IF EXISTS trg_cliente_auto_responsavel ON public.clientes;
CREATE TRIGGER trg_cliente_auto_responsavel
BEFORE INSERT ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.fn_cliente_auto_responsavel();