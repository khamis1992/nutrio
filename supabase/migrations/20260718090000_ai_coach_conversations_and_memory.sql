-- Persistent, user-private conversation and memory storage for Nutrio AI Coach.

CREATE TABLE IF NOT EXISTS public.ai_data_consents (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  status text NOT NULL CHECK (status IN ('granted', 'revoked')),
  policy_version text NOT NULL CHECK (char_length(policy_version) BETWEEN 3 AND 80),
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, purpose)
);

ALTER TABLE public.ai_data_consents
  DROP CONSTRAINT IF EXISTS ai_data_consent_purpose_allowed;
ALTER TABLE public.ai_data_consents
  ADD CONSTRAINT ai_data_consent_purpose_allowed
  CHECK (purpose IN ('blood_work_analysis', 'nutrition_coaching'));

ALTER TABLE public.ai_data_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_data_consents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_data_consents_owner_read ON public.ai_data_consents;
CREATE POLICY ai_data_consents_owner_read
  ON public.ai_data_consents FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON TABLE public.ai_data_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ai_data_consents TO authenticated;

CREATE TABLE IF NOT EXISTS public.ai_coach_consent_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted boolean NOT NULL,
  policy_version text NOT NULL CHECK (char_length(policy_version) BETWEEN 3 AND 80),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.ai_coach_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_consent_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_coach_consent_events FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.ai_coach_request_ledger (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('reserved', 'completed', 'failed', 'rejected')),
  input_chars integer NOT NULL DEFAULT 0 CHECK (input_chars >= 0),
  output_chars integer NOT NULL DEFAULT 0 CHECK (output_chars >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_coach_request_ledger_user_day
  ON public.ai_coach_request_ledger (user_id, created_at DESC);
ALTER TABLE public.ai_coach_request_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_request_ledger FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_coach_request_ledger FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_ai_coach_consent(
  p_granted boolean,
  p_policy_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_policy_version <> '2026-07-health-ai-v1' THEN
    RAISE EXCEPTION 'INVALID_AI_CONSENT_VERSION';
  END IF;

  INSERT INTO public.ai_data_consents (
    user_id, purpose, status, policy_version, granted_at, revoked_at, updated_at
  ) VALUES (
    v_actor,
    'nutrition_coaching',
    CASE WHEN p_granted THEN 'granted' ELSE 'revoked' END,
    p_policy_version,
    CASE WHEN p_granted THEN clock_timestamp() ELSE NULL END,
    CASE WHEN p_granted THEN NULL ELSE clock_timestamp() END,
    clock_timestamp()
  )
  ON CONFLICT (user_id, purpose) DO UPDATE
  SET status = EXCLUDED.status,
      policy_version = EXCLUDED.policy_version,
      granted_at = CASE
        WHEN EXCLUDED.status = 'granted' THEN clock_timestamp()
        ELSE public.ai_data_consents.granted_at
      END,
      revoked_at = CASE
        WHEN EXCLUDED.status = 'revoked' THEN clock_timestamp()
        ELSE NULL
      END,
      updated_at = clock_timestamp();

  INSERT INTO public.ai_coach_consent_events (user_id, granted, policy_version)
  VALUES (v_actor, p_granted, p_policy_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_coach_consent(p_policy_version text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_policy_version = '2026-07-health-ai-v1'
    AND EXISTS (
      SELECT 1
      FROM public.ai_data_consents consent
      WHERE consent.user_id = auth.uid()
        AND consent.purpose = 'nutrition_coaching'
        AND consent.status = 'granted'
        AND consent.policy_version = p_policy_version
    );
$$;

CREATE OR REPLACE FUNCTION public.reserve_ai_coach_request(
  p_user_id uuid,
  p_request_id uuid,
  p_daily_limit integer,
  p_input_chars integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.ai_coach_request_ledger%ROWTYPE;
  v_current_count integer;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'AI_REQUEST_IDENTITY_REQUIRED';
  END IF;
  IF p_daily_limit NOT BETWEEN 1 AND 100
     OR p_input_chars NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'INVALID_AI_BUDGET_REQUEST';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':nutrition_coach:' || current_date::text, 0)
  );

  SELECT * INTO v_existing
  FROM public.ai_coach_request_ledger
  WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.user_id <> p_user_id THEN
      RAISE EXCEPTION 'AI_REQUEST_ID_REUSE';
    END IF;
    RETURN jsonb_build_object(
      'allowed', v_existing.status IN ('reserved', 'completed'),
      'duplicate', true,
      'status', v_existing.status
    );
  END IF;

  SELECT count(*)::integer INTO v_current_count
  FROM public.ai_coach_request_ledger
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('day', clock_timestamp())
    AND status IN ('reserved', 'completed');

  IF v_current_count >= p_daily_limit THEN
    INSERT INTO public.ai_coach_request_ledger (
      request_id, user_id, status, input_chars
    ) VALUES (p_request_id, p_user_id, 'rejected', p_input_chars);
    RETURN jsonb_build_object('allowed', false, 'duplicate', false, 'remaining', 0);
  END IF;

  INSERT INTO public.ai_coach_request_ledger (
    request_id, user_id, status, input_chars
  ) VALUES (p_request_id, p_user_id, 'reserved', p_input_chars);
  RETURN jsonb_build_object(
    'allowed', true,
    'duplicate', false,
    'remaining', p_daily_limit - v_current_count - 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_ai_coach_request(
  p_user_id uuid,
  p_request_id uuid,
  p_status text,
  p_output_chars integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;
  IF p_status NOT IN ('completed', 'failed') OR p_output_chars < 0 THEN
    RAISE EXCEPTION 'INVALID_AI_COMPLETION';
  END IF;

  UPDATE public.ai_coach_request_ledger
  SET status = p_status,
      output_chars = p_output_chars,
      completed_at = clock_timestamp()
  WHERE request_id = p_request_id
    AND user_id = p_user_id
    AND status = 'reserved';
END;
$$;

CREATE TABLE IF NOT EXISTS public.ai_coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation'
    CHECK (char_length(title) BETWEEN 1 AND 120),
  summary text NOT NULL DEFAULT ''
    CHECK (char_length(summary) <= 4000),
  locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('ar', 'en')),
  archived_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_coach_conversations_user_recent
  ON public.ai_coach_conversations (user_id, last_message_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.ai_coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES public.ai_coach_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 8000),
  request_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_coach_messages_conversation_recent
  ON public.ai_coach_messages (conversation_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_coach_messages_request_role
  ON public.ai_coach_messages (user_id, request_id, role)
  WHERE request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_coach_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL
    CHECK (memory_type IN ('preference', 'routine', 'constraint', 'goal', 'context')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 600),
  confidence numeric(4,3) NOT NULL DEFAULT 1
    CHECK (confidence >= 0 AND confidence <= 1),
  source_conversation_id uuid
    REFERENCES public.ai_coach_conversations(id) ON DELETE SET NULL,
  source_message_id uuid
    REFERENCES public.ai_coach_messages(id) ON DELETE SET NULL,
  last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, memory_type, content)
);

CREATE INDEX IF NOT EXISTS idx_ai_coach_memories_user_active
  ON public.ai_coach_memories (user_id, last_confirmed_at DESC);

CREATE OR REPLACE FUNCTION public.set_ai_coach_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_ai_coach_conversations_updated_at
  ON public.ai_coach_conversations;
CREATE TRIGGER set_ai_coach_conversations_updated_at
  BEFORE UPDATE ON public.ai_coach_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_coach_updated_at();

DROP TRIGGER IF EXISTS set_ai_coach_memories_updated_at
  ON public.ai_coach_memories;
CREATE TRIGGER set_ai_coach_memories_updated_at
  BEFORE UPDATE ON public.ai_coach_memories
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_coach_updated_at();

ALTER TABLE public.ai_coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_memories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_coach_conversations_select_own
  ON public.ai_coach_conversations;
CREATE POLICY ai_coach_conversations_select_own
  ON public.ai_coach_conversations
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS ai_coach_conversations_delete_own
  ON public.ai_coach_conversations;
CREATE POLICY ai_coach_conversations_delete_own
  ON public.ai_coach_conversations
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS ai_coach_messages_select_own
  ON public.ai_coach_messages;
CREATE POLICY ai_coach_messages_select_own
  ON public.ai_coach_messages
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.ai_coach_conversations conversation
      WHERE conversation.id = ai_coach_messages.conversation_id
        AND conversation.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS ai_coach_memories_select_own
  ON public.ai_coach_memories;
CREATE POLICY ai_coach_memories_select_own
  ON public.ai_coach_memories
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS ai_coach_memories_delete_own
  ON public.ai_coach_memories;
CREATE POLICY ai_coach_memories_delete_own
  ON public.ai_coach_memories
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.ai_coach_conversations FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_coach_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_coach_memories FROM anon, authenticated;

GRANT SELECT, DELETE ON TABLE public.ai_coach_conversations TO authenticated;
GRANT SELECT ON TABLE public.ai_coach_messages TO authenticated;
GRANT SELECT, DELETE ON TABLE public.ai_coach_memories TO authenticated;

REVOKE ALL ON FUNCTION public.set_ai_coach_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_ai_coach_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.set_ai_coach_consent(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ai_coach_consent(boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_ai_coach_consent(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_coach_consent(text) TO authenticated;
REVOKE ALL ON FUNCTION public.reserve_ai_coach_request(uuid, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_coach_request(uuid, uuid, integer, integer)
  TO service_role;
REVOKE ALL ON FUNCTION public.complete_ai_coach_request(uuid, uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ai_coach_request(uuid, uuid, text, integer)
  TO service_role;

COMMENT ON TABLE public.ai_coach_conversations IS
  'Private AI Coach conversation headers and bounded rolling summaries.';
COMMENT ON TABLE public.ai_coach_messages IS
  'Private user and assistant messages. Writes are restricted to the service role.';
COMMENT ON TABLE public.ai_coach_memories IS
  'User-visible long-term coaching memories extracted only from explicit statements.';
