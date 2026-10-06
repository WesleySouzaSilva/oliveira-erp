
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organizacao_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id, started_at DESC);
CREATE INDEX idx_user_sessions_org ON public.user_sessions(organizacao_id, last_seen_at DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own session"
ON public.user_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session"
ON public.user_sessions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own session"
ON public.user_sessions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view org sessions"
ON public.user_sessions FOR SELECT TO authenticated
USING (organizacao_id IS NOT NULL AND is_admin_in_org(auth.uid(), organizacao_id));
