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
    NEW.aguardando_distribuicao := false;
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.situacao, 'ativo') <> 'ativo' THEN
    RETURN NEW;
  END IF;
  IF NEW.organizacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Continuidade do grupo familiar: herda o responsável de quem já está no mesmo grupo.
  IF COALESCE(NEW.grupo, '') <> '' THEN
    SELECT c.responsavel_pos_venda
      INTO escolhido
    FROM public.clientes c
    WHERE c.organizacao_id = NEW.organizacao_id
      AND c.responsavel_pos_venda IS NOT NULL
      AND c.deleted_at IS NULL
      AND (NEW.id IS NULL OR c.id <> NEW.id)
      AND lower(f_unaccent(COALESCE(c.grupo, ''))) = lower(f_unaccent(NEW.grupo))
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  -- 2) Grupo novo: distribuição equilibrada entre a equipe de carteira ativa.
  IF escolhido IS NULL THEN
    SELECT cr.user_id
      INTO escolhido
    FROM public.carteira_responsaveis cr
    LEFT JOIN public.clientes c
      ON c.responsavel_pos_venda = cr.user_id
     AND c.organizacao_id = NEW.organizacao_id
     AND c.deleted_at IS NULL
     AND COALESCE(c.situacao, 'ativo') = 'ativo'
    WHERE cr.ativo
    GROUP BY cr.user_id, cr.nome_curto
    ORDER BY count(c.id) ASC, cr.nome_curto
    LIMIT 1;
  END IF;

  IF escolhido IS NOT NULL THEN
    NEW.responsavel_pos_venda := escolhido;
    NEW.aguardando_distribuicao := false;
  END IF;
  RETURN NEW;
END;
$function$;