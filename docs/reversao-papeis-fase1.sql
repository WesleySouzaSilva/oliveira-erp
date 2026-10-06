-- Reversão da fase 1 dos papéis (item 6) — Oliveira Agro
-- Rodar este arquivo devolve o sistema ao estado anterior às travas de papel:
-- qualquer pessoa da organização volta a poder marcar protocolo, dispensar
-- alerta, mudar situação do cliente e trocar responsável de carteira.
-- As proteções dos itens 4 e 5 (arquivamento com motivo, protocolo com
-- referência, data não futura, desmarcar protocolo só admin) continuam valendo.

BEGIN;

-- 1) Tira a trava de situação e responsável do cliente
DROP TRIGGER IF EXISTS protege_gestao_clientes ON public.clientes;

-- 2) Volta a regra das operações à versão sem papéis
CREATE OR REPLACE FUNCTION public.fn_operacao_protege_prazo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _admin boolean := is_admin_in_org(auth.uid(), NEW.organizacao_id);
  _motivo text := nullif(btrim(coalesce(NEW.alteracao_motivo,'')), '');
  _resp uuid;
  _no_radar boolean;
BEGIN
  IF NEW.notificado_em IS NOT NULL AND NEW.notificado_em > current_date THEN
    RAISE EXCEPTION 'A data do protocolo não pode ser futura.';
  END IF;

  IF NEW.notificado_em IS NOT NULL AND nullif(btrim(coalesce(NEW.protocolo_ref,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Informe a referência do protocolo.';
  END IF;

  IF NEW.dispensar_alerta AND nullif(btrim(coalesce(NEW.dispensa_motivo,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da dispensa do alerta.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.notificado_em IS NOT NULL AND NEW.notificado_em IS NULL)
       OR (nullif(btrim(coalesce(OLD.protocolo_ref,'')),'') IS NOT NULL
           AND nullif(btrim(coalesce(NEW.protocolo_ref,'')),'') IS NULL) THEN
      IF NOT _admin THEN
        RAISE EXCEPTION 'Somente o administrador pode desmarcar o protocolo.';
      END IF;
      IF _motivo IS NULL THEN
        RAISE EXCEPTION 'Informe o motivo para desmarcar o protocolo.';
      END IF;
    END IF;

    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      IF _motivo IS NULL THEN
        RAISE EXCEPTION 'Informe o motivo para arquivar a operação.';
      END IF;
      _no_radar := OLD.vence_em IS NOT NULL
        AND OLD.vence_em >= current_date - 90
        AND OLD.vence_em <= current_date + 60
        AND OLD.notificado_em IS NULL
        AND NOT coalesce(OLD.dispensar_alerta,false);
      IF _no_radar AND NOT _admin THEN
        RAISE EXCEPTION 'Operação no radar: somente o administrador pode arquivar.';
      END IF;
    END IF;

    IF OLD.vence_em IS DISTINCT FROM NEW.vence_em AND coalesce(OLD.data_conferida,false) THEN
      IF _motivo IS NULL THEN
        RAISE EXCEPTION 'Informe o motivo para alterar a data de vencimento já conferida.';
      END IF;
      NEW.data_conferida := false;

      SELECT c.responsavel_pos_venda INTO _resp FROM public.clientes c WHERE c.id = NEW.cliente_id;
      IF _resp IS NOT NULL AND _resp <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notificacoes_sistema (user_id, mensagem, tipo, lida)
        VALUES (_resp,
          format('Vencimento alterado: %s %s — de %s para %s. Motivo: %s',
                 coalesce(NEW.banco,''), coalesce(NEW.numero,''),
                 coalesce(to_char(OLD.vence_em,'DD/MM/YYYY'),'sem data'),
                 coalesce(to_char(NEW.vence_em,'DD/MM/YYYY'),'sem data'), _motivo),
          'prazo', false);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) (opcional) remover a lista de funções da equipe
-- DROP TABLE IF EXISTS public.radar_funcoes;
-- DROP FUNCTION IF EXISTS public.pode_protocolar(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.papel_radar(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.fn_cliente_protege_gestao();

COMMIT;
