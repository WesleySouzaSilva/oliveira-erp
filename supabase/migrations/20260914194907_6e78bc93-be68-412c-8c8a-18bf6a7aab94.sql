ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cadastrado_por uuid,
  ADD COLUMN IF NOT EXISTS cadastrado_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS aguardando_distribuicao boolean NOT NULL DEFAULT false;

ALTER TABLE public.operacoes_credito
  ADD COLUMN IF NOT EXISTS cadastrado_por uuid,
  ADD COLUMN IF NOT EXISTS cadastrado_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS cedula_path text;

CREATE OR REPLACE FUNCTION public.fn_cliente_auto_responsavel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  escolhido uuid;
BEGIN
  IF NEW.responsavel_pos_venda IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Cadastro do comercial: fica na fila "Clientes a distribuir".
  IF COALESCE(NEW.aguardando_distribuicao, false) THEN
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
$function$;