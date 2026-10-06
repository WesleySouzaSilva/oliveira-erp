
CREATE TABLE public.rate_limits (
  id text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  window_seconds integer NOT NULL DEFAULT 60
);

CREATE INDEX idx_rate_limits_window ON public.rate_limits(window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = no user access, only SECURITY DEFINER functions or service role can touch it

CREATE OR REPLACE FUNCTION public.check_rate_limit(_key text, _max_requests integer DEFAULT 30, _window_seconds integer DEFAULT 60)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current record;
BEGIN
  SELECT * INTO _current FROM rate_limits WHERE id = _key;
  
  IF _current IS NULL THEN
    INSERT INTO rate_limits (id, count, window_start, window_seconds)
    VALUES (_key, 1, now(), _window_seconds);
    RETURN true;
  END IF;

  -- Window expired, reset
  IF _current.window_start + (_current.window_seconds || ' seconds')::interval < now() THEN
    UPDATE rate_limits SET count = 1, window_start = now() WHERE id = _key;
    RETURN true;
  END IF;

  -- Within window
  IF _current.count >= _max_requests THEN
    RETURN false; -- rate limited
  END IF;

  UPDATE rate_limits SET count = count + 1 WHERE id = _key;
  RETURN true;
END;
$$;
