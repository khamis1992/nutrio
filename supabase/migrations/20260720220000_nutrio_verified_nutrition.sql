-- Nutrio Verified: version-bound nutrition verification with partner requests,
-- AAL2 admin review, sampling, suspension, and a privacy-safe public view.

CREATE TABLE IF NOT EXISTS public.meal_nutrition_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  requested_tier TEXT NOT NULL CHECK (
    requested_tier IN ('recipe_standardized', 'dietitian_reviewed', 'lab_tested')
  ),
  submitted_nutrition_version INTEGER NOT NULL CHECK (submitted_nutrition_version > 0),
  evidence_reference TEXT,
  partner_notes TEXT CHECK (partner_notes IS NULL OR char_length(partner_notes) <= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'needs_info', 'approved', 'rejected', 'withdrawn', 'superseded')
  ),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT CHECK (review_notes IS NULL OR char_length(review_notes) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS meal_nutrition_verification_requests_open_idx
  ON public.meal_nutrition_verification_requests (meal_id)
  WHERE status IN ('pending', 'needs_info');
CREATE INDEX IF NOT EXISTS meal_nutrition_verification_requests_queue_idx
  ON public.meal_nutrition_verification_requests (status, created_at);
CREATE INDEX IF NOT EXISTS meal_nutrition_verification_requests_restaurant_idx
  ON public.meal_nutrition_verification_requests (restaurant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.meal_nutrition_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE
    REFERENCES public.meal_nutrition_verification_requests(id) ON DELETE RESTRICT,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  nutrition_version INTEGER NOT NULL CHECK (nutrition_version > 0),
  tier TEXT NOT NULL CHECK (
    tier IN ('recipe_standardized', 'dietitian_reviewed', 'lab_tested')
  ),
  status TEXT NOT NULL DEFAULT 'current' CHECK (
    status IN ('current', 'suspended', 'revoked', 'superseded')
  ),
  verified_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  verification_basis JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(verification_basis) = 'object'),
  public_summary TEXT NOT NULL CHECK (char_length(public_summary) BETWEEN 10 AND 300),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  next_sample_due_at TIMESTAMPTZ NOT NULL,
  suspended_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT CHECK (
    suspension_reason IS NULL OR char_length(suspension_reason) BETWEEN 3 AND 500
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (meal_id, nutrition_version, tier)
);

CREATE UNIQUE INDEX IF NOT EXISTS meal_nutrition_verifications_current_idx
  ON public.meal_nutrition_verifications (meal_id)
  WHERE status = 'current';
CREATE INDEX IF NOT EXISTS meal_nutrition_verifications_expiry_idx
  ON public.meal_nutrition_verifications (expires_at)
  WHERE status = 'current';
CREATE INDEX IF NOT EXISTS meal_nutrition_verifications_sampling_idx
  ON public.meal_nutrition_verifications (next_sample_due_at)
  WHERE status = 'current';

CREATE TABLE IF NOT EXISTS public.meal_nutrition_verification_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL
    REFERENCES public.meal_nutrition_verifications(id) ON DELETE RESTRICT,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  sampled_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (outcome IN ('pass', 'fail', 'inconclusive')),
  observed_variance JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(observed_variance) = 'object'),
  notes TEXT NOT NULL CHECK (char_length(notes) BETWEEN 3 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS meal_nutrition_verification_samples_verification_idx
  ON public.meal_nutrition_verification_samples (verification_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.meal_nutrition_verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.meal_nutrition_verification_requests(id) ON DELETE RESTRICT,
  verification_id UUID REFERENCES public.meal_nutrition_verifications(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'requested', 'needs_info', 'approved', 'rejected', 'withdrawn',
      'superseded', 'suspended', 'sample_passed', 'sample_failed',
      'sample_inconclusive'
    )
  ),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS meal_nutrition_verification_events_meal_idx
  ON public.meal_nutrition_verification_events (meal_id, created_at DESC);

ALTER TABLE public.meal_nutrition_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_nutrition_verification_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meal_nutrition_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_nutrition_verifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meal_nutrition_verification_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_nutrition_verification_samples FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meal_nutrition_verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_nutrition_verification_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meal_nutrition_verification_requests_partner_read
  ON public.meal_nutrition_verification_requests;
CREATE POLICY meal_nutrition_verification_requests_partner_read
  ON public.meal_nutrition_verification_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS meal_nutrition_verification_requests_admin_read
  ON public.meal_nutrition_verification_requests;
CREATE POLICY meal_nutrition_verification_requests_admin_read
  ON public.meal_nutrition_verification_requests
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS meal_nutrition_verifications_admin_read
  ON public.meal_nutrition_verifications;
CREATE POLICY meal_nutrition_verifications_admin_read
  ON public.meal_nutrition_verifications
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS meal_nutrition_verification_samples_admin_read
  ON public.meal_nutrition_verification_samples;
CREATE POLICY meal_nutrition_verification_samples_admin_read
  ON public.meal_nutrition_verification_samples
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS meal_nutrition_verification_events_admin_read
  ON public.meal_nutrition_verification_events;
CREATE POLICY meal_nutrition_verification_events_admin_read
  ON public.meal_nutrition_verification_events
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

REVOKE ALL ON public.meal_nutrition_verification_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.meal_nutrition_verifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.meal_nutrition_verification_samples FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.meal_nutrition_verification_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meal_nutrition_verification_requests TO authenticated;
GRANT SELECT ON public.meal_nutrition_verifications TO authenticated;
GRANT SELECT ON public.meal_nutrition_verification_samples TO authenticated;
GRANT SELECT ON public.meal_nutrition_verification_events TO authenticated;
GRANT ALL ON public.meal_nutrition_verification_requests TO service_role;
GRANT ALL ON public.meal_nutrition_verifications TO service_role;
GRANT ALL ON public.meal_nutrition_verification_samples TO service_role;
GRANT ALL ON public.meal_nutrition_verification_events TO service_role;

CREATE OR REPLACE FUNCTION public.request_meal_nutrition_verification(
  p_meal_id UUID,
  p_tier TEXT,
  p_evidence_reference TEXT,
  p_partner_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_meal public.meals%ROWTYPE;
  v_request_id UUID;
  v_source TEXT;
  v_source_record_id TEXT;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_tier NOT IN ('recipe_standardized', 'dietitian_reviewed', 'lab_tested') THEN
    RAISE EXCEPTION 'VERIFICATION_TIER_INVALID';
  END IF;

  SELECT m.* INTO v_meal
  FROM public.meals m
  JOIN public.restaurants r ON r.id = m.restaurant_id
  WHERE m.id = p_meal_id AND r.owner_id = v_actor
  FOR UPDATE OF m;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEAL_NOT_FOUND'; END IF;

  IF COALESCE(v_meal.nutrient_completeness_score, 0) < 100
    OR COALESCE(cardinality(v_meal.nutrient_missing_codes), 0) > 0
    OR COALESCE(cardinality(v_meal.nutrient_invalid_codes), 0) > 0
  THEN
    RAISE EXCEPTION 'NUTRITION_DATA_INCOMPLETE';
  END IF;

  v_source := NULLIF(btrim(v_meal.nutrition_provenance ->> 'source'), '');
  v_source_record_id := NULLIF(btrim(v_meal.nutrition_provenance ->> 'source_record_id'), '');
  IF v_source IS NULL OR v_source_record_id IS NULL THEN
    RAISE EXCEPTION 'NUTRITION_SOURCE_REFERENCE_REQUIRED';
  END IF;
  IF p_tier IN ('dietitian_reviewed', 'lab_tested')
    AND char_length(COALESCE(btrim(p_evidence_reference), '')) < 3
  THEN
    RAISE EXCEPTION 'INDEPENDENT_EVIDENCE_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.meal_nutrition_verifications v
    WHERE v.meal_id = v_meal.id
      AND v.nutrition_version = v_meal.nutrition_version
      AND v.status = 'current'
      AND v.expires_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'MEAL_VERSION_ALREADY_VERIFIED';
  END IF;

  INSERT INTO public.meal_nutrition_verification_requests (
    meal_id, restaurant_id, requested_by, requested_tier,
    submitted_nutrition_version, evidence_reference, partner_notes
  ) VALUES (
    v_meal.id, v_meal.restaurant_id, v_actor, p_tier,
    v_meal.nutrition_version, NULLIF(btrim(p_evidence_reference), ''),
    NULLIF(btrim(p_partner_notes), '')
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.meal_nutrition_verification_events (
    meal_id, request_id, actor_id, event_type, metadata
  ) VALUES (
    v_meal.id, v_request_id, v_actor, 'requested',
    jsonb_build_object(
      'tier', p_tier,
      'nutrition_version', v_meal.nutrition_version,
      'source', v_source
    )
  );

  RETURN v_request_id;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'VERIFICATION_REQUEST_ALREADY_OPEN';
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_meal_nutrition_verification_request(
  p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_request public.meal_nutrition_verification_requests%ROWTYPE;
BEGIN
  SELECT q.* INTO v_request
  FROM public.meal_nutrition_verification_requests q
  JOIN public.restaurants r ON r.id = q.restaurant_id
  WHERE q.id = p_request_id
    AND q.requested_by = v_actor
    AND r.owner_id = v_actor
    AND q.status IN ('pending', 'needs_info')
  FOR UPDATE OF q;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERIFICATION_REQUEST_NOT_FOUND'; END IF;

  UPDATE public.meal_nutrition_verification_requests
  SET status = 'withdrawn', updated_at = clock_timestamp()
  WHERE id = v_request.id;
  INSERT INTO public.meal_nutrition_verification_events (
    meal_id, request_id, actor_id, event_type
  ) VALUES (v_request.meal_id, v_request.id, v_actor, 'withdrawn');
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_meal_nutrition_verification(
  p_request_id UUID,
  p_decision TEXT,
  p_public_summary TEXT DEFAULT NULL,
  p_review_notes TEXT DEFAULT NULL,
  p_valid_days INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_request public.meal_nutrition_verification_requests%ROWTYPE;
  v_meal public.meals%ROWTYPE;
  v_verification_id UUID;
  v_valid_days INTEGER;
  v_event_type TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'needs_info', 'rejected') THEN
    RAISE EXCEPTION 'VERIFICATION_DECISION_INVALID';
  END IF;

  SELECT * INTO v_request
  FROM public.meal_nutrition_verification_requests
  WHERE id = p_request_id AND status IN ('pending', 'needs_info')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERIFICATION_REQUEST_NOT_FOUND'; END IF;

  SELECT * INTO v_meal FROM public.meals WHERE id = v_request.meal_id FOR UPDATE;
  IF v_meal.nutrition_version <> v_request.submitted_nutrition_version THEN
    UPDATE public.meal_nutrition_verification_requests
    SET status = 'superseded', reviewed_by = v_actor,
        reviewed_at = clock_timestamp(), updated_at = clock_timestamp(),
        review_notes = 'Nutrition changed after submission.'
    WHERE id = v_request.id;
    INSERT INTO public.meal_nutrition_verification_events (
      meal_id, request_id, actor_id, event_type, reason
    ) VALUES (
      v_request.meal_id, v_request.id, v_actor, 'superseded',
      'Nutrition version changed before review.'
    );
    RAISE EXCEPTION 'NUTRITION_VERSION_CHANGED';
  END IF;

  IF p_decision = 'approved' THEN
    IF COALESCE(v_meal.nutrient_completeness_score, 0) < 100
      OR COALESCE(cardinality(v_meal.nutrient_missing_codes), 0) > 0
      OR COALESCE(cardinality(v_meal.nutrient_invalid_codes), 0) > 0
    THEN
      RAISE EXCEPTION 'NUTRITION_DATA_INCOMPLETE';
    END IF;
    IF char_length(COALESCE(btrim(p_public_summary), '')) NOT BETWEEN 10 AND 300 THEN
      RAISE EXCEPTION 'PUBLIC_VERIFICATION_SUMMARY_REQUIRED';
    END IF;
    IF v_request.requested_tier IN ('dietitian_reviewed', 'lab_tested')
      AND char_length(COALESCE(btrim(v_request.evidence_reference), '')) < 3
    THEN
      RAISE EXCEPTION 'INDEPENDENT_EVIDENCE_REQUIRED';
    END IF;

    v_valid_days := COALESCE(
      p_valid_days,
      CASE v_request.requested_tier
        WHEN 'recipe_standardized' THEN 90
        WHEN 'dietitian_reviewed' THEN 180
        ELSE 365
      END
    );
    IF v_valid_days NOT BETWEEN 7 AND 365 THEN
      RAISE EXCEPTION 'VERIFICATION_VALIDITY_INVALID';
    END IF;

    UPDATE public.meal_nutrition_verifications
    SET status = 'superseded', updated_at = clock_timestamp()
    WHERE meal_id = v_request.meal_id AND status = 'current';

    INSERT INTO public.meal_nutrition_verifications (
      request_id, meal_id, restaurant_id, nutrition_version, tier,
      verified_by, verification_basis, public_summary, expires_at,
      next_sample_due_at
    ) VALUES (
      v_request.id, v_request.meal_id, v_request.restaurant_id,
      v_request.submitted_nutrition_version, v_request.requested_tier,
      v_actor,
      jsonb_build_object(
        'evidence_reference', v_request.evidence_reference,
        'review_notes', NULLIF(btrim(p_review_notes), ''),
        'nutrition_source', v_meal.nutrition_provenance ->> 'source',
        'source_record_id', v_meal.nutrition_provenance ->> 'source_record_id'
      ),
      btrim(p_public_summary),
      clock_timestamp() + make_interval(days => v_valid_days),
      clock_timestamp() + make_interval(days => LEAST(v_valid_days, 90))
    ) RETURNING id INTO v_verification_id;
    v_event_type := 'approved';
  ELSE
    v_event_type := p_decision;
  END IF;

  UPDATE public.meal_nutrition_verification_requests
  SET status = p_decision, reviewed_by = v_actor, reviewed_at = clock_timestamp(),
      review_notes = NULLIF(btrim(p_review_notes), ''), updated_at = clock_timestamp()
  WHERE id = v_request.id;

  INSERT INTO public.meal_nutrition_verification_events (
    meal_id, request_id, verification_id, actor_id, event_type, reason,
    metadata
  ) VALUES (
    v_request.meal_id, v_request.id, v_verification_id, v_actor,
    v_event_type, NULLIF(btrim(p_review_notes), ''),
    jsonb_build_object(
      'tier', v_request.requested_tier,
      'nutrition_version', v_request.submitted_nutrition_version
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', v_request.id,
    'decision', p_decision,
    'verification_id', v_verification_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_suspend_meal_nutrition_verification(
  p_verification_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_verification public.meal_nutrition_verifications%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF char_length(COALESCE(btrim(p_reason), '')) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'SUSPENSION_REASON_REQUIRED';
  END IF;
  SELECT * INTO v_verification
  FROM public.meal_nutrition_verifications
  WHERE id = p_verification_id AND status = 'current'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CURRENT_VERIFICATION_NOT_FOUND'; END IF;

  UPDATE public.meal_nutrition_verifications
  SET status = 'suspended', suspended_by = v_actor,
      suspended_at = clock_timestamp(), suspension_reason = btrim(p_reason),
      updated_at = clock_timestamp()
  WHERE id = v_verification.id;
  INSERT INTO public.meal_nutrition_verification_events (
    meal_id, request_id, verification_id, actor_id, event_type, reason
  ) VALUES (
    v_verification.meal_id, v_verification.request_id, v_verification.id,
    v_actor, 'suspended', btrim(p_reason)
  );
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_meal_nutrition_verification_sample(
  p_verification_id UUID,
  p_outcome TEXT,
  p_observed_variance JSONB,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_verification public.meal_nutrition_verifications%ROWTYPE;
  v_sample_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_outcome NOT IN ('pass', 'fail', 'inconclusive') THEN
    RAISE EXCEPTION 'SAMPLE_OUTCOME_INVALID';
  END IF;
  IF jsonb_typeof(COALESCE(p_observed_variance, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'SAMPLE_VARIANCE_INVALID';
  END IF;
  IF char_length(COALESCE(btrim(p_notes), '')) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'SAMPLE_NOTES_REQUIRED';
  END IF;

  SELECT * INTO v_verification
  FROM public.meal_nutrition_verifications
  WHERE id = p_verification_id AND status = 'current'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CURRENT_VERIFICATION_NOT_FOUND'; END IF;

  INSERT INTO public.meal_nutrition_verification_samples (
    verification_id, meal_id, sampled_by, outcome, observed_variance, notes
  ) VALUES (
    v_verification.id, v_verification.meal_id, v_actor, p_outcome,
    COALESCE(p_observed_variance, '{}'::JSONB), btrim(p_notes)
  ) RETURNING id INTO v_sample_id;

  IF p_outcome = 'fail' THEN
    UPDATE public.meal_nutrition_verifications
    SET status = 'suspended', suspended_by = v_actor,
        suspended_at = clock_timestamp(),
        suspension_reason = 'Verification sample failed: ' || btrim(p_notes),
        updated_at = clock_timestamp()
    WHERE id = v_verification.id;
  ELSE
    UPDATE public.meal_nutrition_verifications
    SET next_sample_due_at = clock_timestamp() + interval '90 days',
        updated_at = clock_timestamp()
    WHERE id = v_verification.id;
  END IF;

  INSERT INTO public.meal_nutrition_verification_events (
    meal_id, request_id, verification_id, actor_id, event_type, reason,
    metadata
  ) VALUES (
    v_verification.meal_id, v_verification.request_id, v_verification.id,
    v_actor,
    CASE p_outcome
      WHEN 'pass' THEN 'sample_passed'
      WHEN 'fail' THEN 'sample_failed'
      ELSE 'sample_inconclusive'
    END,
    btrim(p_notes),
    jsonb_build_object('sample_id', v_sample_id, 'variance', COALESCE(p_observed_variance, '{}'::JSONB))
  );
  RETURN v_sample_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.supersede_meal_nutrition_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verification RECORD;
BEGIN
  IF OLD.nutrition_version IS NOT DISTINCT FROM NEW.nutrition_version THEN
    RETURN NEW;
  END IF;

  FOR v_verification IN
    UPDATE public.meal_nutrition_verifications
    SET status = 'superseded', updated_at = clock_timestamp()
    WHERE meal_id = NEW.id AND status = 'current'
    RETURNING id, request_id, verified_by
  LOOP
    INSERT INTO public.meal_nutrition_verification_events (
      meal_id, request_id, verification_id, actor_id, event_type, reason,
      metadata
    ) VALUES (
      NEW.id, v_verification.request_id, v_verification.id,
      COALESCE(auth.uid(), v_verification.verified_by), 'superseded',
      'Nutrition values changed after verification.',
      jsonb_build_object(
        'previous_nutrition_version', OLD.nutrition_version,
        'new_nutrition_version', NEW.nutrition_version
      )
    );
  END LOOP;

  UPDATE public.meal_nutrition_verification_requests
  SET status = 'superseded', updated_at = clock_timestamp(),
      review_notes = 'Nutrition values changed after submission.'
  WHERE meal_id = NEW.id AND status IN ('pending', 'needs_info');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supersede_meal_nutrition_verification_trigger
  ON public.meals;
CREATE TRIGGER supersede_meal_nutrition_verification_trigger
  AFTER UPDATE OF nutrition_version ON public.meals
  FOR EACH ROW
  WHEN (OLD.nutrition_version IS DISTINCT FROM NEW.nutrition_version)
  EXECUTE FUNCTION public.supersede_meal_nutrition_verification();

CREATE OR REPLACE VIEW public.current_meal_nutrition_verifications
WITH (security_barrier = true)
AS
SELECT
  v.meal_id,
  v.tier,
  v.nutrition_version,
  v.public_summary,
  v.verified_at,
  v.expires_at,
  v.next_sample_due_at,
  m.nutrition_provenance ->> 'source' AS nutrition_source
FROM public.meal_nutrition_verifications v
JOIN public.meals m ON m.id = v.meal_id
JOIN public.restaurants r ON r.id = v.restaurant_id
WHERE v.status = 'current'
  AND v.nutrition_version = m.nutrition_version
  AND v.expires_at > clock_timestamp()
  AND COALESCE(m.is_available, FALSE) = TRUE
  AND (m.approval_status IS NULL OR m.approval_status = 'approved')
  AND COALESCE(r.is_active, FALSE) = TRUE
  AND (r.approval_status IS NULL OR r.approval_status = 'approved');

REVOKE ALL ON public.current_meal_nutrition_verifications FROM PUBLIC;
GRANT SELECT ON public.current_meal_nutrition_verifications TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.request_meal_nutrition_verification(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_meal_nutrition_verification(UUID, TEXT, TEXT, TEXT)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.withdraw_meal_nutrition_verification_request(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_meal_nutrition_verification_request(UUID)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_review_meal_nutrition_verification(UUID, TEXT, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_meal_nutrition_verification(UUID, TEXT, TEXT, TEXT, INTEGER)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_suspend_meal_nutrition_verification(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_meal_nutrition_verification(UUID, TEXT)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_record_meal_nutrition_verification_sample(UUID, TEXT, JSONB, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_meal_nutrition_verification_sample(UUID, TEXT, JSONB, TEXT)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.supersede_meal_nutrition_verification()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supersede_meal_nutrition_verification() TO service_role;

COMMENT ON VIEW public.current_meal_nutrition_verifications IS
  'Privacy-safe, current Nutrio Verified claims bound to the live nutrition version.';
COMMENT ON FUNCTION public.request_meal_nutrition_verification(UUID, TEXT, TEXT, TEXT) IS
  'Partner-owned request for version-bound Nutrio nutrition verification.';
COMMENT ON FUNCTION public.admin_review_meal_nutrition_verification(UUID, TEXT, TEXT, TEXT, INTEGER) IS
  'AAL2 admin review that issues a time-bound, sampleable Nutrio Verified claim.';
