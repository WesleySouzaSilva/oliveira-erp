ALTER TABLE public.operacoes_credito
  ADD COLUMN IF NOT EXISTS numero_invalido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS numero_anterior text;

CREATE OR REPLACE FUNCTION public.fn_operacao_numero_nao_documento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n text; hit boolean;
BEGIN
  n := regexp_replace(coalesce(NEW.numero, ''), '\D', '', 'g');
  IF n = '' THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.deleted_at IS NULL
      AND c.organizacao_id IS NOT DISTINCT FROM NEW.organizacao_id
      AND (c.id = NEW.cliente_id OR (NEW.grupo IS NOT NULL AND c.grupo = NEW.grupo))
      AND length(regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g')) IN (11, 14)
      AND (
        regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g') = n
        OR (
          length(n) = 9
          AND length(regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g')) = 11
          AND left(regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g'), 9) = n
        )
      )
  ) INTO hit;

  IF hit THEN
    RAISE EXCEPTION 'Esse número é o CPF do titular, não o número do contrato';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_operacao_numero_nao_documento() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_operacao_numero_nao_documento ON public.operacoes_credito;
CREATE TRIGGER trg_operacao_numero_nao_documento
BEFORE INSERT OR UPDATE OF numero ON public.operacoes_credito
FOR EACH ROW EXECUTE FUNCTION public.fn_operacao_numero_nao_documento();

WITH c AS (
  SELECT id, nome, grupo, organizacao_id, regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') AS d
  FROM public.clientes WHERE deleted_at IS NULL
), o AS (
  SELECT id, cliente_id, grupo, banco, numero, responsavel, origem_arquivo, cedula_path, organizacao_id,
         regexp_replace(coalesce(numero, ''), '\D', '', 'g') AS n
  FROM public.operacoes_credito WHERE deleted_at IS NULL AND numero IS NOT NULL AND numero_invalido = false
), alvo AS (
  SELECT DISTINCT ON (o.id)
    o.id, o.numero, o.banco, o.responsavel, o.origem_arquivo, o.cedula_path, o.organizacao_id,
    c.nome AS titular, o.grupo
  FROM o
  JOIN c ON c.organizacao_id = o.organizacao_id
        AND length(c.d) = 11 AND length(o.n) = 9 AND left(c.d, 9) = o.n
        AND (c.id = o.cliente_id OR (o.grupo IS NOT NULL AND c.grupo = o.grupo))
  ORDER BY o.id, c.nome
), upd AS (
  UPDATE public.operacoes_credito op
  SET numero_invalido = true,
      numero_anterior = op.numero,
      numero = '',
      updated_at = now()
  FROM alvo
  WHERE op.id = alvo.id
  RETURNING op.id
)
INSERT INTO public.advbox_pendencias (organizacao_id, tipo, titulo, descricao, status)
SELECT
  a.organizacao_id,
  'mapeamento',
  'Corrigir número da operação pela cédula — ' || coalesce(a.titular, 'titular a definir') || coalesce(' / ' || a.banco, ''),
  'O número estava preenchido com o CPF do titular (' || a.numero || ') e foi limpo. Conferir o número correto na cédula e lançar na operação. Responsável: '
  || CASE lower(coalesce(a.responsavel, ''))
       WHEN 'willian' THEN 'Maycon' WHEN 'maycon' THEN 'Maycon'
       WHEN 'fernanda' THEN 'Fernanda' WHEN 'vitoria' THEN 'Fernanda'
       ELSE 'Maycon' END
  || coalesce('. Grupo: ' || a.grupo, '')
  || coalesce('. Arquivo de origem: ' || a.origem_arquivo, '')
  || coalesce('. Cédula anexa: ' || a.cedula_path, '')
  || '. Operação: ' || a.id::text,
  'aberta'
FROM alvo a
JOIN upd ON upd.id = a.id;