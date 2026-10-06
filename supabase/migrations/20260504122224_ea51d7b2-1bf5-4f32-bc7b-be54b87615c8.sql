CREATE OR REPLACE FUNCTION public.fn_mirror_laudo_to_drive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_processo boolean;
  _nome_cli text;
  _path text;
  _arq text;
BEGIN
  -- Só espelha se houver pdf_url e ele tiver mudado
  IF NEW.pdf_url IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.pdf_url IS NOT DISTINCT FROM NEW.pdf_url THEN
    RETURN NEW;
  END IF;

  -- Só espelha laudos vinculados a um processo (Fase 1)
  SELECT EXISTS(SELECT 1 FROM processos WHERE laudo_id = NEW.id) INTO _is_processo;
  IF NOT _is_processo THEN RETURN NEW; END IF;

  _nome_cli := COALESCE(
    NEW.dados_etapa1->>'nomeProdutor',
    NEW.dados_etapa1->>'produtor',
    NEW.dados_etapa1->>'nome',
    NEW.dados_etapa1->>'nomePropriedade'
  );
  IF _nome_cli IS NULL THEN RETURN NEW; END IF;

  _path := split_part(NEW.pdf_url, '/laudos/', 2);
  IF _path = '' OR _path IS NULL THEN RETURN NEW; END IF;
  _arq := regexp_replace(_path, '.*/', '');

  -- Evita duplicidade
  IF EXISTS (SELECT 1 FROM arquivos_cliente WHERE storage_path = _path) THEN
    RETURN NEW;
  END IF;

  INSERT INTO arquivos_cliente (user_id, organizacao_id, nome_cliente, nome_arquivo, storage_path, tamanho_bytes, pasta)
  VALUES (NEW.user_id, NEW.organizacao_id, _nome_cli, _arq, _path, 0, 'Laudos');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_laudo_to_drive ON public.laudos;
CREATE TRIGGER trg_mirror_laudo_to_drive
AFTER INSERT OR UPDATE OF pdf_url, dados_etapa1 ON public.laudos
FOR EACH ROW
EXECUTE FUNCTION public.fn_mirror_laudo_to_drive();