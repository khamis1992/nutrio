-- Complete the server-owned Nutrio x SportHub integration lifecycle.

ALTER TABLE public.partner_integrations
  DROP CONSTRAINT IF EXISTS partner_integrations_consent_status_check;

UPDATE public.partner_integrations
SET consent_status = 'reauth_required'
WHERE consent_status = 'needs_reauth';

ALTER TABLE public.partner_integrations
  ADD CONSTRAINT partner_integrations_consent_status_check
  CHECK (consent_status IN ('not_linked', 'pending', 'linked', 'revoked', 'failed', 'reauth_required'));

-- Integration state is confirmed by trusted server callbacks only.
DROP POLICY IF EXISTS "Users can create their partner integrations" ON public.partner_integrations;
DROP POLICY IF EXISTS "Users can update their partner integrations" ON public.partner_integrations;

CREATE TABLE IF NOT EXISTS public.partner_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner TEXT NOT NULL,
  code_verifier TEXT,
  redirect_path TEXT NOT NULL DEFAULT '/dashboard/activity',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_oauth_states_expiry
  ON public.partner_oauth_states(expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.partner_oauth_states ENABLE ROW LEVEL SECURITY;
-- No client policies: Edge Functions use the service role.

CREATE TABLE IF NOT EXISTS public.partner_credentials (
  integration_id UUID PRIMARY KEY REFERENCES public.partner_integrations(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scope TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_credentials ENABLE ROW LEVEL SECURITY;
-- No client policies: credentials are server-only.

CREATE TABLE IF NOT EXISTS public.partner_activity_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner TEXT NOT NULL,
  external_session_id TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  venue_name TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440),
  calories_burned INTEGER CHECK (calories_burned IS NULL OR calories_burned BETWEEN 0 AND 20000),
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'confirmed', 'completed', 'cancelled', 'no_show')),
  workout_session_id UUID REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner, external_session_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_activity_sessions_user_start
  ON public.partner_activity_sessions(user_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_activity_sessions_partner_user
  ON public.partner_activity_sessions(partner, external_user_id, status);

ALTER TABLE public.partner_activity_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their partner activity sessions" ON public.partner_activity_sessions;
CREATE POLICY "Users can read their partner activity sessions"
  ON public.partner_activity_sessions
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can manage partner activity sessions" ON public.partner_activity_sessions;
CREATE POLICY "Admins can manage partner activity sessions"
  ON public.partner_activity_sessions
  FOR ALL
  USING (public.has_role((select auth.uid()), 'admin'))
  WITH CHECK (public.has_role((select auth.uid()), 'admin'));

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS source_external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DROP INDEX IF EXISTS public.idx_workout_sessions_source_external;
CREATE UNIQUE INDEX idx_workout_sessions_source_external
  ON public.workout_sessions(source, source_external_id);

CREATE OR REPLACE FUNCTION public.cleanup_expired_partner_oauth_states()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.partner_oauth_states
  WHERE expires_at < now() - interval '1 day'
     OR consumed_at < now() - interval '1 day';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_partner_oauth_states() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_partner_oauth_states() TO service_role;
