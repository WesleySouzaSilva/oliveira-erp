CREATE OR REPLACE FUNCTION public.fn_apos_mensagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _mencionado uuid;
  _autor_nome text;
BEGIN
  UPDATE public.conversas
     SET ultima_mensagem_em = NEW.created_at,
         ultima_mensagem_preview = left(NEW.conteudo, 140),
         updated_at = now()
   WHERE id = NEW.conversa_id;

  IF array_length(NEW.mencoes, 1) > 0 THEN
    SELECT COALESCE(nome, 'Alguém') INTO _autor_nome FROM public.profiles WHERE id = NEW.autor_id;
    FOREACH _mencionado IN ARRAY NEW.mencoes LOOP
      IF _mencionado <> NEW.autor_id THEN
        INSERT INTO public.notificacoes_sistema (user_id, tipo, mensagem)
        VALUES (
          _mencionado,
          'mencao_mensagem',
          _autor_nome || ' mencionou você: ' || left(NEW.conteudo, 200)
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Limpa dados de teste do stress
DELETE FROM public.conversas WHERE titulo = '__STRESS__';