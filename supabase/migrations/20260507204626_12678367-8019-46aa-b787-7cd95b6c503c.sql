DELETE FROM public.user_sessions
WHERE ended_at IS NULL
  AND EXTRACT(EPOCH FROM (last_seen_at - started_at)) < 5
  AND started_at < now() - interval '10 minutes';