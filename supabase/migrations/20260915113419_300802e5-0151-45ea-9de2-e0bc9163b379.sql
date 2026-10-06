-- ============ ITEM 4: arquivar em vez de excluir ============
ALTER TABLE public.operacoes_credito ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.arquivos_cliente   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.atividades_clientes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.operacoes_credito ADD COLUMN IF NOT EXISTS alteracao_motivo text;

CREATE OR REPLACE FUNCTION public.fn_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', TG_TABLE_NAME)
  USING OLD.id;
  RETURN NULL; -- cancela a exclusão definitiva
END;
$$;
REVOKE ALL ON FUNCTION public.fn_soft_delete() FROM PUBLIC, anon;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','operacoes_credito','contratos_vencimentos','arquivos_cliente','atividades_clientes']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS soft_delete_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER soft_delete_%1$s BEFORE DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.fn_soft_delete()', t);
  END LOOP;
END $$;

-- ============ ITEM 5: proteção dos prazos ============
CREATE OR REPLACE FUNCTION public.fn_operacao_protege_prazo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin boolean := is_admin_in_org(auth.uid(), NEW.organizacao_id);
  _motivo text := nullif(btrim(coalesce(NEW.alteracao_motivo,'')), '');
  _resp uuid;
BEGIN
  -- data de notificação não pode ser futura
  IF NEW.notificado_em IS NOT NULL AND NEW.notificado_em > current_date THEN
    RAISE EXCEPTION 'A data do protocolo não pode ser futura.';
  END IF;

  -- protocolo exige referência
  IF NEW.notificado_em IS NOT NULL AND nullif(btrim(coalesce(NEW.protocolo_ref,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Informe a referência do protocolo.';
  END IF;

  -- dispensa exige motivo
  IF NEW.dispensar_alerta AND nullif(btrim(coalesce(NEW.dispensa_motivo,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da dispensa do alerta.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- desmarcar protocolo: só admin e com motivo
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

    -- mudar o vencimento de uma operação conferida: motivo obrigatório,
    -- volta para "não conferida" e avisa o responsável
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
$$;
REVOKE ALL ON FUNCTION public.fn_operacao_protege_prazo() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS protege_prazo_operacoes ON public.operacoes_credito;
CREATE TRIGGER protege_prazo_operacoes
BEFORE INSERT OR UPDATE ON public.operacoes_credito
FOR EACH ROW EXECUTE FUNCTION public.fn_operacao_protege_prazo();

-- ============ Fusão de fichas (só admin, com motivo) ============
CREATE OR REPLACE FUNCTION public.fundir_clientes(_manter uuid, _absorver uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE a public.clientes; b public.clientes;
BEGIN
  IF _manter = _absorver THEN RAISE EXCEPTION 'Escolha duas fichas diferentes.'; END IF;
  IF nullif(btrim(coalesce(_motivo,'')),'') IS NULL THEN RAISE EXCEPTION 'Informe o motivo da fusão.'; END IF;

  SELECT * INTO a FROM public.clientes WHERE id = _manter;
  SELECT * INTO b FROM public.clientes WHERE id = _absorver;
  IF a.id IS NULL OR b.id IS NULL THEN RAISE EXCEPTION 'Ficha não encontrada.'; END IF;
  IF NOT is_admin_in_org(auth.uid(), a.organizacao_id) THEN
    RAISE EXCEPTION 'Somente o administrador pode juntar fichas.';
  END IF;

  -- a ficha que fica recebe sempre o valor mais completo; nunca troca preenchido por vazio
  UPDATE public.clientes SET
    nome       = CASE WHEN length(coalesce(b.nome,'')) > length(coalesce(a.nome,'')) THEN b.nome ELSE a.nome END,
    cpf_cnpj   = coalesce(nullif(btrim(coalesce(a.cpf_cnpj,'')),''), nullif(btrim(coalesce(b.cpf_cnpj,'')),'')),
    grupo      = coalesce(nullif(btrim(coalesce(a.grupo,'')),''), nullif(btrim(coalesce(b.grupo,'')),'')),
    responsavel_pos_venda = coalesce(a.responsavel_pos_venda, b.responsavel_pos_venda),
    telefone   = coalesce(nullif(btrim(coalesce(a.telefone,'')),''), nullif(btrim(coalesce(b.telefone,'')),'')),
    email      = coalesce(nullif(btrim(coalesce(a.email,'')),''), nullif(btrim(coalesce(b.email,'')),'')),
    endereco   = coalesce(nullif(btrim(coalesce(a.endereco,'')),''), nullif(btrim(coalesce(b.endereco,'')),'')),
    municipio  = coalesce(nullif(btrim(coalesce(a.municipio,'')),''), nullif(btrim(coalesce(b.municipio,'')),'')),
    uf         = coalesce(nullif(btrim(coalesce(a.uf,'')),''), nullif(btrim(coalesce(b.uf,'')),'')),
    grafias_alternativas = (
      SELECT ARRAY(SELECT DISTINCT e FROM unnest(
        coalesce(a.grafias_alternativas,'{}') || coalesce(b.grafias_alternativas,'{}') || ARRAY[b.nome]
      ) e WHERE nullif(btrim(e),'') IS NOT NULL AND e <> a.nome)
    )
  WHERE id = _manter;

  UPDATE public.operacoes_credito SET cliente_id = _manter WHERE cliente_id = _absorver;
  UPDATE public.arquivos_cliente  SET nome_cliente = a.nome WHERE nome_cliente = b.nome;
  UPDATE public.atividades_clientes SET nome_cliente = a.nome WHERE nome_cliente = b.nome;

  UPDATE public.clientes
     SET deleted_at = now(), situacao_motivo = concat('Ficha unida a ', a.nome, ' — ', _motivo)
   WHERE id = _absorver;
END;
$$;
REVOKE ALL ON FUNCTION public.fundir_clientes(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fundir_clientes(uuid, uuid, text) TO authenticated;