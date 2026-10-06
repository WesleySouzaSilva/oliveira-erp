CREATE OR REPLACE FUNCTION public.fn_operacao_protege_prazo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _papel text := papel_radar(auth.uid(), NEW.organizacao_id);
  _admin boolean := _papel IN ('admin','sistema');
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

  IF NEW.notificado_em IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.notificado_em IS DISTINCT FROM NEW.notificado_em)
     AND NOT pode_protocolar(_uid, NEW.organizacao_id) THEN
    RAISE EXCEPTION 'Somente quem protocola pode marcar a operação como protocolada.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF _papel = 'laudos' AND (
         OLD.vence_em IS DISTINCT FROM NEW.vence_em
      OR OLD.notificado_em IS DISTINCT FROM NEW.notificado_em
      OR OLD.protocolo_ref IS DISTINCT FROM NEW.protocolo_ref
      OR coalesce(OLD.dispensar_alerta,false) IS DISTINCT FROM coalesce(NEW.dispensar_alerta,false)
      OR OLD.banco IS DISTINCT FROM NEW.banco
      OR OLD.numero IS DISTINCT FROM NEW.numero
      OR OLD.saldo_devedor IS DISTINCT FROM NEW.saldo_devedor
      OR OLD.cliente_id IS DISTINCT FROM NEW.cliente_id
      OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
    ) THEN
      RAISE EXCEPTION 'Sem permissão: você só pode alterar o laudo desta operação.';
    END IF;

    IF _papel = 'comercial' AND (
         coalesce(OLD.cadastrado_por, OLD.created_by) IS DISTINCT FROM _uid
      OR coalesce(OLD.created_at, now()) < now() - interval '48 hours'
    ) THEN
      RAISE EXCEPTION 'Sem permissão: o comercial altera apenas o que cadastrou, nas primeiras 48 horas.';
    END IF;

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

    _no_radar := OLD.vence_em IS NOT NULL
      AND OLD.vence_em >= current_date - 90
      AND OLD.vence_em <= current_date + 60
      AND OLD.notificado_em IS NULL
      AND NOT coalesce(OLD.dispensar_alerta,false);

    IF NOT coalesce(OLD.dispensar_alerta,false) AND coalesce(NEW.dispensar_alerta,false)
       AND _no_radar AND NOT _admin THEN
      RAISE EXCEPTION 'Operação no radar: somente o administrador pode dispensar o alerta.';
    END IF;

    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      IF _motivo IS NULL THEN
        RAISE EXCEPTION 'Informe o motivo para arquivar a operação.';
      END IF;
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
      IF _resp IS NOT NULL AND _resp <> coalesce(_uid, '00000000-0000-0000-0000-000000000000'::uuid) THEN
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

CREATE OR REPLACE FUNCTION public.fn_cliente_protege_gestao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _papel text := papel_radar(auth.uid(), NEW.organizacao_id);
  _sit_mudou boolean := coalesce(OLD.situacao,'ativo') IS DISTINCT FROM coalesce(NEW.situacao,'ativo');
BEGIN
  IF _papel IN ('sistema','admin') THEN
    IF _sit_mudou AND nullif(btrim(coalesce(NEW.situacao_motivo,'')),'') IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo da mudança de situação do cliente.';
    END IF;
    RETURN NEW;
  END IF;

  IF _sit_mudou THEN
    RAISE EXCEPTION 'Somente o administrador pode mudar a situação do cliente.';
  END IF;

  IF OLD.responsavel_pos_venda IS DISTINCT FROM NEW.responsavel_pos_venda THEN
    RAISE EXCEPTION 'Somente o administrador pode trocar o responsável de carteira.';
  END IF;

  IF _papel = 'comercial' AND (
       coalesce(OLD.cadastrado_por, OLD.user_id) IS DISTINCT FROM _uid
    OR coalesce(OLD.cadastrado_em, OLD.created_at, now()) < now() - interval '48 hours'
  ) THEN
    RAISE EXCEPTION 'Sem permissão: o comercial altera apenas as fichas que cadastrou, nas primeiras 48 horas.';
  END IF;

  RETURN NEW;
END;
$function$;