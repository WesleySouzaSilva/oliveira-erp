CREATE OR REPLACE FUNCTION public.fn_djen_prazo_sugerido()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  re text := '(?:no\s+)?prazo\s+(?:legal\s+|comum\s+|sucessivo\s+)?de\s+(\d{1,3})\s*(?:\([^)]{1,40}\)\s*)?dias(?:\s+[úu]teis)?';
  nums int[];
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.texto IS NOT DISTINCT FROM OLD.texto THEN RETURN NEW; END IF;
  SELECT array_agg(DISTINCT (m[1])::int) INTO nums FROM regexp_matches(coalesce(NEW.texto,''), re, 'gi') AS m;
  NEW.prazo_sugerido_dias := NULL; NEW.prazo_sugerido_trecho := NULL;
  NEW.prazo_sugerido_multiplo := coalesce(array_length(nums,1),0) > 1;
  IF array_length(nums,1) = 1 THEN
    NEW.prazo_sugerido_dias := nums[1];
    NEW.prazo_sugerido_trecho := (regexp_match(NEW.texto, '(' || re || ')', 'i'))[1];
  END IF;
  RETURN NEW;
END $$;