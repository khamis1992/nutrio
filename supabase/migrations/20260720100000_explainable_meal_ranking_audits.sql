CREATE TABLE IF NOT EXISTS public.meal_ranking_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  engine_version TEXT NOT NULL CHECK (char_length(engine_version) BETWEEN 1 AND 80),
  generated_at TIMESTAMPTZ NOT NULL,
  input_freshness JSONB NOT NULL CHECK (jsonb_typeof(input_freshness) = 'object'),
  exclusions JSONB NOT NULL CHECK (jsonb_typeof(exclusions) = 'array'),
  ranked JSONB NOT NULL CHECK (jsonb_typeof(ranked) = 'array'),
  context JSONB NOT NULL CHECK (jsonb_typeof(context) = 'object'),
  offline BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_meal_ranking_audits_user_created
  ON public.meal_ranking_audits (user_id, created_at DESC);

ALTER TABLE public.meal_ranking_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_ranking_audits FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.meal_ranking_audits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meal_ranking_audits TO authenticated;
GRANT ALL ON public.meal_ranking_audits TO service_role;

DROP POLICY IF EXISTS meal_ranking_audits_owner_read ON public.meal_ranking_audits;
CREATE POLICY meal_ranking_audits_owner_read
  ON public.meal_ranking_audits FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.record_meal_ranking_audit(
  p_request_id UUID,
  p_engine_version TEXT,
  p_generated_at TIMESTAMPTZ,
  p_input_freshness JSONB,
  p_exclusions JSONB,
  p_ranked JSONB,
  p_context JSONB,
  p_offline BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_offline THEN
    RAISE EXCEPTION 'OFFLINE_AUDIT_NOT_ALLOWED' USING ERRCODE = '22023';
  END IF;
  IF p_generated_at > now() + interval '5 minutes' OR p_generated_at < now() - interval '48 hours' THEN
    RAISE EXCEPTION 'INVALID_GENERATED_AT' USING ERRCODE = '22023';
  END IF;
  IF char_length(p_engine_version) NOT BETWEEN 1 AND 80
     OR jsonb_typeof(p_input_freshness) <> 'object'
     OR jsonb_typeof(p_exclusions) <> 'array'
     OR jsonb_typeof(p_ranked) <> 'array'
     OR jsonb_typeof(p_context) <> 'object'
     OR jsonb_array_length(p_exclusions) > 250
     OR jsonb_array_length(p_ranked) > 50
     OR octet_length(p_input_freshness::TEXT) > 8192
     OR octet_length(p_exclusions::TEXT) > 65536
     OR octet_length(p_ranked::TEXT) > 131072
     OR octet_length(p_context::TEXT) > 8192 THEN
    RAISE EXCEPTION 'INVALID_AUDIT_PAYLOAD' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.meal_ranking_audits (
    user_id, request_id, engine_version, generated_at, input_freshness,
    exclusions, ranked, context, offline
  ) VALUES (
    v_user_id, p_request_id, p_engine_version, p_generated_at, p_input_freshness,
    p_exclusions, p_ranked, p_context, false
  )
  ON CONFLICT (user_id, request_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.meal_ranking_audits
    WHERE user_id = v_user_id AND request_id = p_request_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_meal_ranking_audit(
  UUID, TEXT, TIMESTAMPTZ, JSONB, JSONB, JSONB, JSONB, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_meal_ranking_audit(
  UUID, TEXT, TIMESTAMPTZ, JSONB, JSONB, JSONB, JSONB, BOOLEAN
) TO authenticated;

COMMENT ON TABLE public.meal_ranking_audits IS
  'Privacy-minimized immutable audit rows for deterministic meal ranking runs.';
