-- ============ 1) Jeisson: juntar as duas fichas ============
UPDATE public.clientes
SET grafias_alternativas = (
      SELECT array_agg(DISTINCT g) FROM unnest(
        coalesce(grafias_alternativas, '{}'::text[]) || ARRAY['Jeisson Rolando Lipink']
      ) g),
    updated_at = now()
WHERE id = '66ff592e-3b6a-46f6-8d4f-3ddc2740de2a';

UPDATE public.clientes
SET deleted_at = now(),
    situacao = 'encerrado',
    situacao_motivo = 'juntada',
    situacao_alterada_em = now(),
    updated_at = now()
WHERE id = 'c1968192-e370-4ed5-b595-df47d3ff7d56';

-- ============ 2) Funções da equipe no radar ============
CREATE TABLE IF NOT EXISTS public.radar_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  user_id uuid NOT NULL,
  funcao text NOT NULL CHECK (funcao IN ('mapeamento','protocolo','laudos')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, user_id)
);

GRANT SELECT ON public.radar_funcoes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.radar_funcoes TO authenticated;
GRANT ALL ON public.radar_funcoes TO service_role;

ALTER TABLE public.radar_funcoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS radar_funcoes_select ON public.radar_funcoes;
CREATE POLICY radar_funcoes_select ON public.radar_funcoes
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

DROP POLICY IF EXISTS radar_funcoes_admin ON public.radar_funcoes;
CREATE POLICY radar_funcoes_admin ON public.radar_funcoes
  FOR ALL TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

DROP TRIGGER IF EXISTS set_updated_at_radar_funcoes ON public.radar_funcoes;
CREATE TRIGGER set_updated_at_radar_funcoes BEFORE UPDATE ON public.radar_funcoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.radar_funcoes (organizacao_id, user_id, funcao) VALUES
  ('c937a42c-a30b-4c80-a595-7887926683fd','0b78b856-fccf-4a7a-af7a-639c247f0f33','mapeamento'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','d569ac8c-d44f-4f77-a655-c497fa6d1606','mapeamento'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','dc6e00ec-51a2-489e-bdda-ad5a00d1bd72','protocolo')
ON CONFLICT (organizacao_id, user_id) DO UPDATE SET funcao = EXCLUDED.funcao;

CREATE OR REPLACE FUNCTION public.papel_radar(_user_id uuid, _org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _org_id IS NULL THEN 'sistema'
    WHEN is_admin_in_org(_user_id, _org_id) THEN 'admin'
    ELSE coalesce(
      (SELECT f.funcao FROM public.radar_funcoes f
        WHERE f.user_id = _user_id AND f.organizacao_id = _org_id),
      (SELECT CASE WHEN m.papel = 'comercial'::app_role THEN 'comercial' ELSE 'outro' END
         FROM public.membros m
        WHERE m.user_id = _user_id AND m.organizacao_id = _org_id LIMIT 1),
      'outro')
  END
$$;

REVOKE ALL ON FUNCTION public.papel_radar(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papel_radar(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pode_protocolar(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.papel_radar(_user_id, _org_id) IN ('admin','protocolo','sistema')
$$;

REVOKE ALL ON FUNCTION public.pode_protocolar(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_protocolar(uuid, uuid) TO authenticated, service_role;

-- ============ 3) Operações: protocolo, dispensa, laudo ============
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

  -- Marcar protocolo: só quem protocola (Vitoria) e o administrador.
  IF NEW.notificado_em IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.notificado_em IS DISTINCT FROM NEW.notificado_em)
     AND NOT pode_protocolar(_uid, NEW.organizacao_id) THEN
    RAISE EXCEPTION 'Somente quem protocola pode marcar a operação como protocolada.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Quem cuida de laudos só mexe no campo de laudo.
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

    -- Comercial: só o que cadastrou, nas primeiras 48 horas.
    IF _papel = 'comercial' AND (
         coalesce(OLD.created_at, now()) < now() - interval '48 hours'
      OR coalesce(OLD.user_id, '00000000-0000-0000-0000-000000000000'::uuid) IS DISTINCT FROM _uid
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

    -- Dispensar alerta de operação no radar: só o administrador.
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

-- ============ 4) Clientes: situação e responsável ============
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
  IF _papel = 'sistema' OR _papel = 'admin' THEN
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

REVOKE ALL ON FUNCTION public.fn_cliente_protege_gestao() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS protege_gestao_clientes ON public.clientes;
CREATE TRIGGER protege_gestao_clientes
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_cliente_protege_gestao();