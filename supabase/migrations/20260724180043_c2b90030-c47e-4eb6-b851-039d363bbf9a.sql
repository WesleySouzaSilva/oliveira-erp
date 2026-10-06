
CREATE OR REPLACE FUNCTION public.normalize_person_name(_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _words text[];
  _w text;
  _lower text;
  _out text := '';
  _i int := 0;
  _lowercase_words text[] := ARRAY['de','da','do','dos','das','e','di','du','del','della','van','von','la','le'];
  _upper_words text[] := ARRAY['ltda','sa','s.a','s/a','me','epp','eireli','mei','ss','cia','jr','ii','iii','iv'];
BEGIN
  IF _input IS NULL THEN RETURN NULL; END IF;
  _input := btrim(regexp_replace(_input, '\s+', ' ', 'g'));
  IF _input = '' THEN RETURN _input; END IF;
  _words := string_to_array(_input, ' ');
  FOREACH _w IN ARRAY _words LOOP
    _i := _i + 1;
    _lower := lower(_w);
    IF _lower = ANY(_upper_words) THEN
      _out := _out || upper(_w);
    ELSIF _i > 1 AND _lower = ANY(_lowercase_words) THEN
      _out := _out || _lower;
    ELSE
      -- Handle hyphens / apostrophes
      _out := _out || regexp_replace(
        initcap(_lower),
        '(^|[\s\-''])([a-zà-ÿ])',
        '\1' || '',
        'g'
      );
      -- initcap already capitalizes after non-alpha, use it directly
      _out := left(_out, length(_out) - length(regexp_replace(initcap(_lower),'(^|[\s\-''])([a-zà-ÿ])','\1','g'))) || initcap(_lower);
    END IF;
    _out := _out || ' ';
  END LOOP;
  RETURN btrim(_out);
END;
$$;

-- Simpler rewrite (replace the above complex body)
CREATE OR REPLACE FUNCTION public.normalize_person_name(_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _words text[];
  _w text;
  _lower text;
  _out text := '';
  _i int := 0;
  _lowercase_words text[] := ARRAY['de','da','do','dos','das','e','di','du','del','della','van','von','la','le'];
  _upper_words text[] := ARRAY['ltda','sa','s.a','s/a','me','epp','eireli','mei','ss','cia','jr','ii','iii','iv'];
BEGIN
  IF _input IS NULL THEN RETURN NULL; END IF;
  _input := btrim(regexp_replace(_input, '\s+', ' ', 'g'));
  IF _input = '' THEN RETURN _input; END IF;
  _words := string_to_array(_input, ' ');
  FOREACH _w IN ARRAY _words LOOP
    _i := _i + 1;
    _lower := lower(_w);
    IF _lower = ANY(_upper_words) THEN
      _out := _out || upper(_w) || ' ';
    ELSIF _i > 1 AND _lower = ANY(_lowercase_words) THEN
      _out := _out || _lower || ' ';
    ELSE
      _out := _out || initcap(_lower) || ' ';
    END IF;
  END LOOP;
  RETURN btrim(_out);
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_person_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_person_name(text) TO authenticated, service_role;

-- Mass normalization across related tables (only when the normalized value differs)
UPDATE public.clientes
   SET nome = public.normalize_person_name(nome)
 WHERE nome IS NOT NULL AND nome <> public.normalize_person_name(nome);

UPDATE public.contratos_vencimentos
   SET nome_cliente = public.normalize_person_name(nome_cliente)
 WHERE nome_cliente IS NOT NULL AND nome_cliente <> public.normalize_person_name(nome_cliente);

UPDATE public.atendimentos_notas
   SET cliente_nome = public.normalize_person_name(cliente_nome)
 WHERE cliente_nome IS NOT NULL AND cliente_nome <> public.normalize_person_name(cliente_nome);

UPDATE public.atividades_clientes
   SET nome_cliente = public.normalize_person_name(nome_cliente)
 WHERE nome_cliente IS NOT NULL AND nome_cliente <> public.normalize_person_name(nome_cliente);

UPDATE public.arquivos_cliente
   SET nome_cliente = public.normalize_person_name(nome_cliente)
 WHERE nome_cliente IS NOT NULL AND nome_cliente <> public.normalize_person_name(nome_cliente);
