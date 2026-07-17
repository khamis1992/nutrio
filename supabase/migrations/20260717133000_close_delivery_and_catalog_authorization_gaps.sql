-- Close the remaining delivery, tracking, fleet projection, storage, and
-- public-catalog authorization gaps. Client-facing delivery mutations are
-- capabilities: table RLS never acts as the authorization API.

BEGIN;

-- ---------------------------------------------------------------------------
-- Private, one-time pickup capabilities
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS security;
-- Preserve existing USAGE grants required by unrelated audited crypto helpers.
-- The capability relation itself has no API grant, and clients cannot create
-- objects in this private schema.
REVOKE CREATE ON SCHEMA security FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS security.delivery_pickup_capabilities (
  delivery_job_id UUID PRIMARY KEY
    REFERENCES public.delivery_jobs(id) ON DELETE CASCADE,
  code_salt TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  qr_nonce_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0
    CHECK (failed_attempts BETWEEN 0 AND 5),
  locked_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  rotated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE security.delivery_pickup_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security.delivery_pickup_capabilities
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE security.delivery_pickup_capabilities IS
  'One-time pickup code and QR nonce hashes. This table is intentionally absent from API grants.';

-- Public delivery rows must never contain a reusable pickup secret. Existing
-- jobs require an authorized restaurant operator to rotate a fresh capability.
UPDATE public.delivery_jobs
SET pickup_verification_code = NULL,
    verification_code_hash = NULL,
    qr_verification_hash = NULL
WHERE pickup_verification_code IS NOT NULL
   OR verification_code_hash IS NOT NULL
   OR qr_verification_hash IS NOT NULL;

ALTER TABLE public.delivery_jobs
  DROP CONSTRAINT IF EXISTS delivery_jobs_no_public_pickup_secrets;
ALTER TABLE public.delivery_jobs
  ADD CONSTRAINT delivery_jobs_no_public_pickup_secrets CHECK (
    pickup_verification_code IS NULL
    AND verification_code_hash IS NULL
    AND qr_verification_hash IS NULL
  ) NOT VALID;
ALTER TABLE public.delivery_jobs
  VALIDATE CONSTRAINT delivery_jobs_no_public_pickup_secrets;

-- The delivery credit trigger is a trusted finance writer. Preserve the
-- existing self-service driver boundary while allowing only its exact counter
-- update when app.driver_finance_authorized is set by the credit trigger.
CREATE OR REPLACE FUNCTION public.enforce_driver_authorization_boundary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_is_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  v_is_admin BOOLEAN := false;
  v_is_fleet_operator BOOLEAN := false;
  v_assignment_change_authorized BOOLEAN := false;
  v_finance_change_authorized BOOLEAN := false;
BEGIN
  IF v_actor IS NOT NULL THEN
    v_is_admin := COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      AND public.has_role(v_actor, 'admin'::public.app_role);
    v_is_fleet_operator := COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      AND public.can_manage_fleet_city(NEW.city_id);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_is_service OR v_is_admin THEN
      RETURN NEW;
    END IF;

    IF v_is_fleet_operator THEN
      RAISE EXCEPTION 'DRIVER_CREATION_REQUIRES_REVIEWED_RPC';
    END IF;

    IF v_actor IS NULL OR NEW.user_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'DRIVER_SELF_REGISTRATION_REQUIRED';
    END IF;

    NEW.approval_status := 'pending'::public.approval_status;
    NEW.is_active := false;
    NEW.is_online := false;
    NEW.current_job_id := NULL;
    NEW.wallet_balance := 0;
    NEW.total_earnings := 0;
    NEW.total_deliveries := 0;
    NEW.rating := 0;
    NEW.cancellation_rate := 0;
    NEW.assigned_zone_ids := ARRAY[]::UUID[];
    NEW.payout_details := NULL;
    NEW.status := 'pending_verification';
    RETURN NEW;
  END IF;

  IF v_is_service OR v_is_admin THEN
    RETURN NEW;
  END IF;

  v_assignment_change_authorized :=
    COALESCE(current_setting('app.delivery_claim_authorized', true), '') = 'true'
    OR COALESCE(current_setting('app.delivery_mutation_scope', true), '') IN (
      'fleet_assignment', 'driver_transition'
    );
  v_finance_change_authorized :=
    COALESCE(current_setting('app.driver_finance_authorized', true), '') = 'true';

  IF v_assignment_change_authorized THEN
    IF (to_jsonb(NEW) - ARRAY['current_job_id', 'updated_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['current_job_id', 'updated_at']) THEN
      RAISE EXCEPTION 'DELIVERY_ASSIGNMENT_SCOPE_VIOLATION';
    END IF;
    RETURN NEW;
  END IF;

  IF v_finance_change_authorized THEN
    IF (to_jsonb(NEW) - ARRAY[
         'wallet_balance', 'total_earnings', 'total_deliveries', 'updated_at'
       ]) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY[
         'wallet_balance', 'total_earnings', 'total_deliveries', 'updated_at'
       ]) THEN
      RAISE EXCEPTION 'DRIVER_FINANCE_SCOPE_VIOLATION';
    END IF;
    RETURN NEW;
  END IF;

  IF v_is_fleet_operator THEN
    IF (to_jsonb(NEW) - ARRAY[
         'approval_status', 'is_active', 'is_online', 'status',
         'assigned_zone_ids', 'city_id', 'updated_at'
       ]) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY[
         'approval_status', 'is_active', 'is_online', 'status',
         'assigned_zone_ids', 'city_id', 'updated_at'
       ]) THEN
      RAISE EXCEPTION 'FLEET_DRIVER_OPERATIONAL_FIELDS_ONLY';
    END IF;
    RETURN NEW;
  END IF;

  IF v_actor IS NULL
     OR OLD.user_id IS DISTINCT FROM v_actor
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'DRIVER_UPDATE_FORBIDDEN';
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
     OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings
     OR NEW.total_deliveries IS DISTINCT FROM OLD.total_deliveries
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.cancellation_rate IS DISTINCT FROM OLD.cancellation_rate
     OR NEW.payout_details IS DISTINCT FROM OLD.payout_details
     OR NEW.city_id IS DISTINCT FROM OLD.city_id
     OR NEW.assigned_zone_ids IS DISTINCT FROM OLD.assigned_zone_ids
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.current_job_id IS DISTINCT FROM OLD.current_job_id THEN
    RAISE EXCEPTION 'DRIVER_PRIVILEGED_FIELDS_REQUIRE_FLEET_APPROVAL';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_driver_authorization_boundary()
  FROM PUBLIC, anon, authenticated;

-- Existing fleet write policies predate mandatory step-up authentication.
-- Keep their city scope while requiring AAL2 before a browser can reach the
-- field-level trigger boundary above.
DROP POLICY IF EXISTS drivers_fleet_create_scoped ON public.drivers;
CREATE POLICY drivers_fleet_create_scoped
  ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND public.can_manage_fleet_city(city_id)
  );
DROP POLICY IF EXISTS "Fleet operators can update scoped drivers"
  ON public.drivers;
CREATE POLICY "Fleet operators can update scoped drivers"
  ON public.drivers FOR UPDATE TO authenticated
  USING (
    COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND public.can_manage_fleet_city(city_id)
  )
  WITH CHECK (
    COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND public.can_manage_fleet_city(city_id)
  );

-- A second boundary protects server-derived money, source identity, assignment,
-- status, and handoff metadata even when an old SECURITY DEFINER function is
-- accidentally left callable. Each reviewed RPC sets one narrow transaction
-- scope immediately before its write.
CREATE OR REPLACE FUNCTION public.enforce_delivery_job_rpc_boundary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_is_service BOOLEAN :=
    COALESCE(auth.role(), '') = 'service_role'
    OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin'));
  v_scope TEXT := COALESCE(
    current_setting('app.delivery_mutation_scope', true),
    CASE
      WHEN COALESCE(current_setting('app.delivery_claim_authorized', true), '') = 'true'
        THEN 'claim'
    END,
    ''
  );
  v_status_changed BOOLEAN;
  v_assignment_changed BOOLEAN;
  v_source_changed BOOLEAN;
  v_finance_changed BOOLEAN;
  v_handoff_changed BOOLEAN;
BEGIN
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_scope <> 'fleet_assignment' THEN
      RAISE EXCEPTION 'DELIVERY_JOB_INSERT_REQUIRES_RPC';
    END IF;
    RETURN NEW;
  END IF;

  v_status_changed := NEW.status IS DISTINCT FROM OLD.status;
  v_assignment_changed := NEW.driver_id IS DISTINCT FROM OLD.driver_id;
  v_source_changed := NEW.schedule_id IS DISTINCT FROM OLD.schedule_id
    OR NEW.order_id IS DISTINCT FROM OLD.order_id
    OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
    OR NEW.city_id IS DISTINCT FROM OLD.city_id;
  v_finance_changed := NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
    OR NEW.tip_amount IS DISTINCT FROM OLD.tip_amount
    OR NEW.driver_earnings IS DISTINCT FROM OLD.driver_earnings
    OR NEW.estimated_distance_km IS DISTINCT FROM OLD.estimated_distance_km;
  v_handoff_changed := NEW.picked_up_at IS DISTINCT FROM OLD.picked_up_at
    OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
    OR NEW.failed_at IS DISTINCT FROM OLD.failed_at
    OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
    OR NEW.handover_method IS DISTINCT FROM OLD.handover_method
    OR NEW.qr_scanned_at IS DISTINCT FROM OLD.qr_scanned_at
    OR NEW.qr_generated_at IS DISTINCT FROM OLD.qr_generated_at
    OR NEW.verification_expires_at IS DISTINCT FROM OLD.verification_expires_at
    OR NEW.verification_attempts IS DISTINCT FROM OLD.verification_attempts
    OR NEW.is_verification_locked IS DISTINCT FROM OLD.is_verification_locked
    OR NEW.pickup_verification_code IS DISTINCT FROM OLD.pickup_verification_code
    OR NEW.verification_code_hash IS DISTINCT FROM OLD.verification_code_hash
    OR NEW.qr_verification_hash IS DISTINCT FROM OLD.qr_verification_hash;

  IF v_finance_changed AND v_scope <> 'fleet_assignment' THEN
    RAISE EXCEPTION 'DELIVERY_FINANCIAL_FIELDS_REQUIRE_RPC';
  END IF;

  IF v_status_changed
     AND v_scope NOT IN (
       'claim', 'driver_transition', 'pickup', 'partner_override', 'fleet_assignment'
     ) THEN
    RAISE EXCEPTION 'DELIVERY_STATUS_REQUIRES_RPC';
  END IF;

  IF v_assignment_changed
     AND v_scope NOT IN ('claim', 'driver_transition', 'fleet_assignment') THEN
    RAISE EXCEPTION 'DELIVERY_ASSIGNMENT_REQUIRES_RPC';
  END IF;

  IF v_source_changed AND v_scope <> 'fleet_assignment' THEN
    RAISE EXCEPTION 'DELIVERY_SOURCE_FIELDS_REQUIRE_RPC';
  END IF;

  IF v_handoff_changed
     AND v_scope NOT IN (
       'driver_transition', 'pickup', 'partner_override', 'verification_refresh',
       'fleet_assignment'
     ) THEN
    RAISE EXCEPTION 'DELIVERY_HANDOFF_FIELDS_REQUIRE_RPC';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_delivery_job_rpc_boundary()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_delivery_job_rpc_boundary ON public.delivery_jobs;
CREATE TRIGGER enforce_delivery_job_rpc_boundary
  BEFORE INSERT OR UPDATE ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_delivery_job_rpc_boundary();

-- Direct API INSERT/UPDATE is denied. SECURITY DEFINER capabilities below and
-- service-role workers remain the only write paths.
DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'delivery_jobs'
      AND cmd IN ('INSERT', 'UPDATE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.delivery_jobs', v_policy.policyname);
  END LOOP;
END;
$do$;

CREATE POLICY delivery_jobs_rpc_only_insert
  ON public.delivery_jobs FOR INSERT TO authenticated
  WITH CHECK (false);
CREATE POLICY delivery_jobs_rpc_only_update
  ON public.delivery_jobs FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.refresh_verification_code(
  p_delivery_job_id UUID,
  p_partner_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
  v_code TEXT;
  v_code_salt TEXT := replace(gen_random_uuid()::TEXT, '-', '');
  v_qr_nonce TEXT := replace(gen_random_uuid()::TEXT, '-', '')
    || replace(gen_random_uuid()::TEXT, '-', '');
  v_expires_at TIMESTAMPTZ := now() + interval '15 minutes';
  v_entropy BIGINT;
BEGIN
  IF v_actor IS NULL OR p_partner_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT dj.*
  INTO v_job
  FROM public.delivery_jobs dj
  LEFT JOIN public.meal_schedules ms ON ms.id = dj.schedule_id
  LEFT JOIN public.meals m ON m.id = ms.meal_id
  WHERE dj.id = p_delivery_job_id
    AND dj.status IN ('pending', 'assigned', 'accepted')
    AND (
      public.has_role(v_actor, 'admin'::public.app_role)
      OR public.is_restaurant_operator(
        COALESCE(dj.restaurant_id, ms.restaurant_id, m.restaurant_id),
        v_actor
      )
    )
  FOR UPDATE OF dj;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery is not available for this restaurant'
    );
  END IF;

  v_entropy := (
    ('x' || substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8))::BIT(32)::BIGINT
  );
  v_code := lpad((v_entropy % 1000000)::TEXT, 6, '0');

  INSERT INTO security.delivery_pickup_capabilities (
    delivery_job_id,
    code_salt,
    code_hash,
    qr_nonce_hash,
    expires_at,
    failed_attempts,
    locked_at,
    used_at,
    rotated_by,
    created_at,
    updated_at
  ) VALUES (
    v_job.id,
    v_code_salt,
    encode(sha256(convert_to(v_code_salt || ':' || v_code, 'UTF8')), 'hex'),
    encode(sha256(convert_to(v_qr_nonce, 'UTF8')), 'hex'),
    v_expires_at,
    0,
    NULL,
    NULL,
    v_actor,
    now(),
    now()
  )
  ON CONFLICT (delivery_job_id) DO UPDATE
  SET code_salt = EXCLUDED.code_salt,
      code_hash = EXCLUDED.code_hash,
      qr_nonce_hash = EXCLUDED.qr_nonce_hash,
      expires_at = EXCLUDED.expires_at,
      failed_attempts = 0,
      locked_at = NULL,
      used_at = NULL,
      rotated_by = EXCLUDED.rotated_by,
      updated_at = now();

  PERFORM set_config('app.delivery_mutation_scope', 'verification_refresh', true);
  UPDATE public.delivery_jobs
  SET pickup_verification_code = NULL,
      verification_code_hash = NULL,
      qr_verification_hash = NULL,
      verification_expires_at = v_expires_at,
      verification_attempts = 0,
      is_verification_locked = false,
      qr_generated_at = now(),
      updated_at = now()
  WHERE id = v_job.id;

  -- Plain capabilities are returned once to the authorized restaurant UI and
  -- are never persisted in an API-readable relation.
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification capability refreshed',
    'verification_code', v_code,
    'qr_nonce', v_qr_nonce,
    'expires_at', v_expires_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_delivery_verification(
  p_delivery_job_id UUID,
  p_partner_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR (p_partner_user_id IS NOT NULL AND p_partner_user_id <> v_actor) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN public.refresh_verification_code(p_delivery_job_id, v_actor);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_delivery_pickup(
  p_delivery_job_id UUID,
  p_capability TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
  v_cap security.delivery_pickup_capabilities%ROWTYPE;
  v_candidate_hash TEXT;
  v_is_code BOOLEAN;
  v_attempts INTEGER;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF p_delivery_job_id IS NULL
     OR p_capability IS NULL
     OR length(p_capability) NOT BETWEEN 6 AND 256 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid pickup capability');
  END IF;

  SELECT dj.*
  INTO v_job
  FROM public.delivery_jobs dj
  JOIN public.drivers d ON d.id = dj.driver_id
  WHERE dj.id = p_delivery_job_id
    AND d.user_id = v_actor
    AND d.city_id = dj.city_id
    AND dj.status IN ('assigned', 'accepted')
  FOR UPDATE OF dj;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pickup is not available');
  END IF;

  SELECT c.*
  INTO v_cap
  FROM security.delivery_pickup_capabilities c
  WHERE c.delivery_job_id = v_job.id
  FOR UPDATE;

  IF NOT FOUND
     OR v_cap.used_at IS NOT NULL
     OR v_cap.locked_at IS NOT NULL
     OR v_cap.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pickup capability is unavailable');
  END IF;

  v_is_code := p_capability ~ '^[0-9]{6}$';
  v_candidate_hash := CASE
    WHEN v_is_code THEN encode(
      sha256(convert_to(v_cap.code_salt || ':' || p_capability, 'UTF8')),
      'hex'
    )
    ELSE encode(sha256(convert_to(p_capability, 'UTF8')), 'hex')
  END;

  IF (v_is_code AND v_candidate_hash <> v_cap.code_hash)
     OR (NOT v_is_code AND v_candidate_hash <> v_cap.qr_nonce_hash) THEN
    v_attempts := LEAST(v_cap.failed_attempts + 1, 5);
    UPDATE security.delivery_pickup_capabilities
    SET failed_attempts = v_attempts,
        locked_at = CASE WHEN v_attempts >= 5 THEN now() ELSE NULL END,
        updated_at = now()
    WHERE delivery_job_id = v_job.id;

    PERFORM set_config('app.delivery_mutation_scope', 'verification_refresh', true);
    UPDATE public.delivery_jobs
    SET verification_attempts = v_attempts,
        is_verification_locked = v_attempts >= 5,
        updated_at = now()
    WHERE id = v_job.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid pickup capability',
      'remaining_attempts', GREATEST(0, 5 - v_attempts)
    );
  END IF;

  UPDATE security.delivery_pickup_capabilities
  SET used_at = now(), updated_at = now()
  WHERE delivery_job_id = v_job.id;

  PERFORM set_config('app.delivery_mutation_scope', 'pickup', true);
  UPDATE public.delivery_jobs
  SET status = 'picked_up',
      accepted_at = COALESCE(accepted_at, now()),
      picked_up_at = COALESCE(picked_up_at, now()),
      qr_scanned_at = CASE WHEN v_is_code THEN NULL ELSE now() END,
      handover_method = CASE WHEN v_is_code THEN 'manual' ELSE 'qr' END,
      verification_attempts = 0,
      is_verification_locked = false,
      pickup_verification_code = NULL,
      verification_code_hash = NULL,
      qr_verification_hash = NULL,
      verification_expires_at = NULL,
      updated_at = now()
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pickup verified successfully',
    'job_id', v_job.id,
    'status', 'picked_up'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.partner_confirm_handover(
  p_delivery_job_id UUID,
  p_partner_user_id UUID,
  p_reason TEXT DEFAULT 'Partner override'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_partner_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF length(trim(COALESCE(p_reason, ''))) NOT BETWEEN 3 AND 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A short handover reason is required');
  END IF;

  SELECT dj.*
  INTO v_job
  FROM public.delivery_jobs dj
  LEFT JOIN public.meal_schedules ms ON ms.id = dj.schedule_id
  LEFT JOIN public.meals m ON m.id = ms.meal_id
  WHERE dj.id = p_delivery_job_id
    AND dj.status IN ('assigned', 'accepted')
    AND dj.driver_id IS NOT NULL
    AND (
      public.has_role(v_actor, 'admin'::public.app_role)
      OR public.is_restaurant_operator(
        COALESCE(dj.restaurant_id, ms.restaurant_id, m.restaurant_id),
        v_actor
      )
    )
  FOR UPDATE OF dj;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery is not ready for handover');
  END IF;

  UPDATE security.delivery_pickup_capabilities
  SET used_at = COALESCE(used_at, now()), updated_at = now()
  WHERE delivery_job_id = v_job.id;

  PERFORM set_config('app.delivery_mutation_scope', 'partner_override', true);
  UPDATE public.delivery_jobs
  SET status = 'picked_up',
      accepted_at = COALESCE(accepted_at, now()),
      picked_up_at = COALESCE(picked_up_at, now()),
      handover_method = 'partner_override',
      verification_attempts = 0,
      is_verification_locked = false,
      pickup_verification_code = NULL,
      verification_code_hash = NULL,
      qr_verification_hash = NULL,
      verification_expires_at = NULL,
      delivery_notes = concat_ws(
        E'\n',
        NULLIF(delivery_notes, ''),
        'Handover override: ' || trim(p_reason)
      ),
      updated_at = now()
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Handover confirmed by partner',
    'job_id', v_job.id,
    'status', 'picked_up'
  );
END;
$function$;

-- Legacy pickup verifiers accepted either a public row value or the job UUID.
-- Keep the definitions for migration compatibility but remove every API grant.
REVOKE ALL ON FUNCTION public.verify_pickup_by_code(TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.verify_pickup_by_qr(UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.partner_confirm_handover(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.partner_confirm_handover_trusted(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.refresh_verification_code(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.initialize_delivery_verification(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_confirm_handover(UUID, UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_delivery_pickup(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_verification_code(UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_delivery_verification(UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_confirm_handover(UUID, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_delivery_pickup(UUID, TEXT)
  TO authenticated;

-- Reviewed driver lifecycle transitions. Pickup is deliberately absent and is
-- possible only through complete_delivery_pickup or the audited partner override.
CREATE OR REPLACE FUNCTION public.transition_delivery_job(
  p_delivery_job_id UUID,
  p_new_status TEXT,
  p_delivery_notes TEXT DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
  v_is_driver BOOLEAN := false;
  v_is_fleet BOOLEAN := false;
  v_target TEXT := lower(trim(COALESCE(p_new_status, '')));
  v_clear_driver BOOLEAN := false;
  v_release_driver BOOLEAN := false;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF length(COALESCE(p_delivery_notes, '')) > 1000
     OR length(COALESCE(p_failure_reason, '')) > 500 THEN
    RAISE EXCEPTION 'DELIVERY_TRANSITION_TEXT_TOO_LONG';
  END IF;

  SELECT dj.* INTO v_job
  FROM public.delivery_jobs dj
  WHERE dj.id = p_delivery_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_JOB_NOT_FOUND';
  END IF;

  v_is_driver := EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = v_job.driver_id
      AND d.user_id = v_actor
      AND d.city_id = v_job.city_id
  );
  v_is_fleet := COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND public.can_manage_fleet_city(v_job.city_id);

  IF v_is_driver THEN
    IF NOT (
      (v_job.status = 'assigned' AND v_target IN ('accepted', 'pending', 'failed'))
      OR (v_job.status = 'accepted' AND v_target = 'failed')
      OR (v_job.status = 'picked_up' AND v_target IN ('in_transit', 'failed'))
      OR (v_job.status = 'in_transit' AND v_target IN ('delivered', 'failed'))
    ) THEN
      RAISE EXCEPTION 'DRIVER_TRANSITION_NOT_ALLOWED';
    END IF;
    v_clear_driver := v_job.status = 'assigned' AND v_target = 'pending';
  ELSIF v_is_fleet THEN
    IF NOT (
      (v_job.status = 'pending' AND v_target IN ('cancelled', 'failed'))
      OR (v_job.status = 'assigned' AND v_target IN ('pending', 'cancelled', 'failed'))
      OR (v_job.status = 'accepted' AND v_target IN ('cancelled', 'failed'))
      OR (v_job.status = 'picked_up' AND v_target IN ('in_transit', 'failed'))
      OR (v_job.status = 'in_transit' AND v_target IN ('delivered', 'failed'))
    ) THEN
      RAISE EXCEPTION 'FLEET_TRANSITION_NOT_ALLOWED';
    END IF;
    v_clear_driver := v_job.status = 'assigned' AND v_target = 'pending';
  ELSE
    RAISE EXCEPTION 'DELIVERY_TRANSITION_FORBIDDEN';
  END IF;

  v_release_driver := v_target IN ('pending', 'delivered', 'failed', 'cancelled');

  PERFORM set_config('app.delivery_mutation_scope', 'driver_transition', true);
  UPDATE public.delivery_jobs
  SET status = v_target,
      driver_id = CASE WHEN v_clear_driver THEN NULL ELSE driver_id END,
      assigned_at = CASE WHEN v_clear_driver THEN NULL ELSE assigned_at END,
      accepted_at = CASE
        WHEN v_target = 'accepted' THEN COALESCE(accepted_at, now())
        WHEN v_clear_driver THEN NULL
        ELSE accepted_at
      END,
      delivered_at = CASE
        WHEN v_target = 'delivered' THEN COALESCE(delivered_at, now())
        ELSE delivered_at
      END,
      failed_at = CASE
        WHEN v_target = 'failed' THEN COALESCE(failed_at, now())
        ELSE failed_at
      END,
      delivery_notes = CASE
        WHEN v_target = 'delivered' AND p_delivery_notes IS NOT NULL
          THEN trim(p_delivery_notes)
        ELSE delivery_notes
      END,
      failure_reason = CASE
        WHEN v_target IN ('failed', 'cancelled')
          THEN NULLIF(trim(COALESCE(p_failure_reason, '')), '')
        WHEN v_clear_driver THEN NULL
        ELSE failure_reason
      END,
      updated_at = now()
  WHERE id = v_job.id;

  IF v_release_driver AND v_job.driver_id IS NOT NULL THEN
    UPDATE public.drivers
    SET current_job_id = NULL,
        updated_at = now()
    WHERE id = v_job.driver_id
      AND current_job_id = v_job.id;

    IF v_clear_driver THEN
      INSERT INTO public.driver_assignment_history (
        job_id, driver_id, action, reason, performed_by, performed_at
      ) VALUES (
        v_job.id,
        v_job.driver_id,
        'unassigned',
        COALESCE(NULLIF(trim(p_failure_reason), ''), 'Driver rejected assignment'),
        v_actor,
        now()
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job.id,
    'status', v_target
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.transition_delivery_job(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_delivery_job(UUID, TEXT, TEXT, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Driver detail and customer live-tracking projections
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_delivery_details_for_driver(
  p_delivery_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
  v_source JSONB;
  v_restaurant JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT dj.* INTO v_job
  FROM public.delivery_jobs dj
  WHERE dj.id = p_delivery_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_JOB_NOT_FOUND';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = v_job.driver_id
        AND d.user_id = v_actor
        AND d.city_id = v_job.city_id
    )
    OR (
      COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      AND (
        public.can_manage_fleet_city(v_job.city_id)
        OR public.has_role(v_actor, 'admin'::public.app_role)
      )
    )
    OR COALESCE(auth.role(), '') = 'service_role'
  ) THEN
    RAISE EXCEPTION 'DELIVERY_JOB_ACCESS_DENIED';
  END IF;

  SELECT jsonb_build_object(
    'name', r.name,
    'address', r.address,
    'phone', COALESCE(r.phone, r.phone_number)
  )
  INTO v_restaurant
  FROM public.restaurants r
  WHERE r.id = v_job.restaurant_id;

  IF v_job.schedule_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'source', 'meal_schedule',
      'source_id', ms.id,
      'meal_name', COALESCE(m.name, 'Meal'),
      'meal_calories', COALESCE(m.calories, 0),
      'customer_name', COALESCE(p.full_name, 'Customer'),
      'customer_phone', ua.phone,
      'delivery_instructions', COALESCE(ua.delivery_instructions, v_job.delivery_notes)
    )
    INTO v_source
    FROM public.meal_schedules ms
    LEFT JOIN public.meals m ON m.id = ms.meal_id
    LEFT JOIN public.profiles p ON p.user_id = ms.user_id
    LEFT JOIN public.user_addresses ua ON ua.id = ms.delivery_address_id
    WHERE ms.id = v_job.schedule_id
      AND ms.city_id = v_job.city_id;
  ELSE
    SELECT jsonb_build_object(
      'source', 'order',
      'source_id', o.id,
      'meal_name', COALESCE(m.name, 'Order'),
      'meal_calories', COALESCE(m.calories, 0),
      'customer_name', COALESCE(p.full_name, 'Customer'),
      'customer_phone', o.phone_number,
      'delivery_instructions', COALESCE(
        o.special_instructions,
        o.notes,
        v_job.delivery_notes
      )
    )
    INTO v_source
    FROM public.orders o
    LEFT JOIN public.order_items oi ON oi.id = (
      SELECT oi2.id
      FROM public.order_items oi2
      WHERE oi2.order_id = o.id
      ORDER BY oi2.created_at, oi2.id
      LIMIT 1
    )
    LEFT JOIN public.meals m ON m.id = COALESCE(o.meal_id, oi.meal_id)
    LEFT JOIN public.profiles p ON p.user_id = o.user_id
    WHERE o.id = v_job.order_id
      AND o.city_id = v_job.city_id;
  END IF;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'DELIVERY_SOURCE_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object(
    'id', v_job.id,
    'schedule_id', v_job.schedule_id,
    'order_id', v_job.order_id,
    'driver_id', v_job.driver_id,
    'status', v_job.status,
    'pickup_address', v_job.pickup_address,
    'delivery_address', v_job.delivery_address,
    'delivery_lat', v_job.delivery_lat,
    'delivery_lng', v_job.delivery_lng,
    'estimated_distance_km', v_job.estimated_distance_km,
    'delivery_fee', v_job.delivery_fee,
    'tip_amount', v_job.tip_amount,
    'driver_earnings', v_job.driver_earnings,
    'delivery_notes', v_job.delivery_notes,
    'delivery_photo_url', v_job.delivery_photo_url,
    'restaurant', v_restaurant
  ) || v_source;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_delivery_details_for_driver(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_details_for_driver(UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_customer_delivery_tracking(
  p_source_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
  v_driver JSONB;
  v_location JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT dj.* INTO v_job
  FROM public.delivery_jobs dj
  WHERE (dj.schedule_id = p_source_id OR dj.order_id = p_source_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.meal_schedules ms
        WHERE ms.id = dj.schedule_id AND ms.user_id = v_actor
      )
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = dj.order_id AND o.user_id = v_actor
      )
    )
  ORDER BY dj.created_at DESC, dj.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('delivery_job', NULL, 'latest_location', NULL);
  END IF;

  IF v_job.driver_id IS NOT NULL
     AND v_job.status IN ('assigned', 'accepted', 'picked_up', 'in_transit') THEN
    SELECT jsonb_build_object(
      'id', d.id,
      'full_name', d.full_name,
      'phone_number', d.phone_number,
      'vehicle_type', d.vehicle_type,
      'vehicle_make', d.vehicle_make,
      'vehicle_model', d.vehicle_model,
      'license_plate', d.license_plate,
      'rating', d.rating,
      'total_deliveries', d.total_deliveries
    )
    INTO v_driver
    FROM public.drivers d
    WHERE d.id = v_job.driver_id
      AND d.city_id = v_job.city_id;
  END IF;

  -- Return exactly one snapshot, and only while this customer's own delivery is
  -- active. Historical points remain inaccessible through base-table RLS.
  IF v_job.driver_id IS NOT NULL
     AND v_job.status IN ('assigned', 'accepted', 'picked_up', 'in_transit') THEN
    SELECT jsonb_build_object(
      'lat', d.current_lat,
      'lng', d.current_lng,
      'updated_at', GREATEST(dl.timestamp, d.last_location_update, d.last_location_at),
      'speed_kmh', dl.speed_kmh,
      'heading', dl.heading
    )
    INTO v_location
    FROM public.drivers d
    LEFT JOIN LATERAL (
      SELECT l.timestamp, l.speed_kmh, l.heading
      FROM public.driver_locations l
      WHERE l.driver_id = d.id
      ORDER BY l.timestamp DESC NULLS LAST, l.id DESC
      LIMIT 1
    ) dl ON true
    WHERE d.id = v_job.driver_id
      AND d.city_id = v_job.city_id
      AND d.current_lat IS NOT NULL
      AND d.current_lng IS NOT NULL
      AND GREATEST(dl.timestamp, d.last_location_update, d.last_location_at)
        >= COALESCE(v_job.accepted_at, v_job.assigned_at, v_job.created_at);
  END IF;

  RETURN jsonb_build_object(
    'delivery_job', jsonb_build_object(
      'id', v_job.id,
      'status', v_job.status,
      'schedule_id', v_job.schedule_id,
      'order_id', v_job.order_id,
      'driver_id', v_job.driver_id,
      'assigned_at', v_job.assigned_at,
      'picked_up_at', v_job.picked_up_at,
      'delivered_at', v_job.delivered_at,
      'created_at', v_job.created_at,
      'driver', v_driver
    ),
    'latest_location', v_location
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_delivery_tracking(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_delivery_tracking(UUID)
  TO authenticated;

-- Customers no longer receive base driver rows or location history. Drivers
-- retain their own row; AAL2 admins and fleet users consume narrow projections.
DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drivers'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.drivers', v_policy.policyname);
  END LOOP;
END;
$do$;

CREATE POLICY drivers_self_select
  ON public.drivers FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY drivers_aal2_admin_select
  ON public.drivers FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Customers can view driver locations for their orders"
  ON public.driver_locations;
DROP POLICY IF EXISTS "Drivers can view own locations"
  ON public.driver_locations;
CREATE POLICY driver_locations_self_select
  ON public.driver_locations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND d.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY driver_locations_aal2_fleet_select
  ON public.driver_locations FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND public.can_manage_fleet_city(d.city_id)
    )
  );

-- Remove every fleet profile policy that exposes the full health/affiliate row.
DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND cmd IN ('SELECT', 'ALL')
      AND lower(COALESCE(qual, '')) LIKE '%can_manage_fleet_city%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', v_policy.policyname);
  END LOOP;
END;
$do$;

-- ---------------------------------------------------------------------------
-- AAL2, city-scoped fleet projections and atomic assignment
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_fleet_dispatch_customers(
  p_user_ids UUID[]
)
RETURNS TABLE(user_id UUID, full_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'FLEET_AAL2_REQUIRED';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.full_name
  FROM public.profiles p
  WHERE p.user_id = ANY(COALESCE(p_user_ids, ARRAY[]::UUID[]))
    AND (
      EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.user_id = p.user_id
          AND o.status IN ('preparing', 'ready_for_pickup')
          AND public.can_manage_fleet_city(o.city_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.meal_schedules ms
        WHERE ms.user_id = p.user_id
          AND ms.order_status IN ('preparing', 'ready')
          AND COALESCE(ms.delivery_type, 'delivery') <> 'pickup'
          AND public.can_manage_fleet_city(ms.city_id)
      )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_fleet_dispatch_drivers(
  p_driver_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  full_name TEXT,
  phone_number TEXT,
  rating NUMERIC,
  total_deliveries BIGINT,
  is_online BOOLEAN,
  is_active BOOLEAN,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  last_location_update TIMESTAMPTZ,
  approval_status TEXT,
  vehicle_plate TEXT,
  active_jobs JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'FLEET_AAL2_REQUIRED';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.full_name,
    d.phone_number,
    d.rating::NUMERIC,
    COALESCE(d.total_deliveries, 0)::BIGINT,
    COALESCE(d.is_online, false),
    COALESCE(d.is_active, false),
    d.current_lat::DOUBLE PRECISION,
    d.current_lng::DOUBLE PRECISION,
    d.last_location_update,
    d.approval_status::TEXT,
    v.plate_number,
    COALESCE(j.jobs, '[]'::JSONB)
  FROM public.drivers d
  LEFT JOIN LATERAL (
    SELECT ve.plate_number
    FROM public.vehicles ve
    WHERE ve.assigned_driver_id = d.id
    ORDER BY ve.updated_at DESC NULLS LAST, ve.id
    LIMIT 1
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', dj.id,
        'status', dj.status,
        'delivery_lat', dj.delivery_lat,
        'delivery_lng', dj.delivery_lng,
        'delivery_address', dj.delivery_address
      ) ORDER BY dj.created_at, dj.id
    ) AS jobs
    FROM public.delivery_jobs dj
    WHERE dj.driver_id = d.id
      AND dj.city_id = d.city_id
      AND dj.status IN ('assigned', 'accepted', 'picked_up', 'in_transit')
  ) j ON true
  WHERE public.can_manage_fleet_city(d.city_id)
    AND (p_driver_ids IS NULL OR d.id = ANY(p_driver_ids))
  ORDER BY d.is_online DESC NULLS LAST, d.full_name, d.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_fleet_dispatch_customers(UUID[])
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fleet_dispatch_drivers(UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fleet_dispatch_customers(UUID[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fleet_dispatch_drivers(UUID[])
  TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_fleet_delivery_job(
  p_source_type TEXT,
  p_source_id UUID,
  p_driver_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_source_type TEXT := lower(trim(COALESCE(p_source_type, '')));
  v_order public.orders%ROWTYPE;
  v_schedule public.meal_schedules%ROWTYPE;
  v_driver public.drivers%ROWTYPE;
  v_job public.delivery_jobs%ROWTYPE;
  v_job_id UUID;
  v_city_id UUID;
  v_restaurant_id UUID;
  v_pickup_address TEXT;
  v_delivery_address TEXT;
  v_delivery_lat NUMERIC;
  v_delivery_lng NUMERIC;
  v_delivery_fee NUMERIC := 0;
  v_tip_amount NUMERIC := 0;
  v_previous_driver_id UUID;
  v_action TEXT;
  v_reason TEXT;
BEGIN
  IF v_actor IS NULL
     OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'FLEET_AAL2_REQUIRED';
  END IF;

  IF v_source_type NOT IN ('order', 'meal_schedule') THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_SOURCE';
  END IF;

  IF length(COALESCE(p_reason, '')) > 500
     OR length(COALESCE(p_notes, '')) > 500 THEN
    RAISE EXCEPTION 'ASSIGNMENT_REASON_TOO_LONG';
  END IF;

  SELECT d.* INTO v_driver
  FROM public.drivers d
  WHERE d.id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT COALESCE(v_driver.is_active, false)
     OR COALESCE(v_driver.approval_status::TEXT, 'pending') <> 'approved' THEN
    RAISE EXCEPTION 'DRIVER_NOT_AVAILABLE';
  END IF;

  IF v_source_type = 'order' THEN
    SELECT o.* INTO v_order
    FROM public.orders o
    WHERE o.id = p_source_id
      AND o.status IN ('preparing', 'ready_for_pickup')
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DISPATCH_ORDER_NOT_AVAILABLE';
    END IF;

    v_city_id := v_order.city_id;
    v_restaurant_id := v_order.restaurant_id;
    v_delivery_address := v_order.delivery_address;
    v_delivery_lat := v_order.delivery_lat;
    v_delivery_lng := v_order.delivery_lng;
    v_delivery_fee := GREATEST(COALESCE(v_order.delivery_fee, 0), 0);
    v_tip_amount := GREATEST(COALESCE(v_order.tip_amount, 0), 0);

    SELECT COALESCE(rb.address, r.address)
    INTO v_pickup_address
    FROM public.restaurants r
    LEFT JOIN public.restaurant_branches rb ON rb.id = v_order.restaurant_branch_id
    WHERE r.id = v_order.restaurant_id;
  ELSE
    SELECT ms.* INTO v_schedule
    FROM public.meal_schedules ms
    WHERE ms.id = p_source_id
      AND ms.order_status IN ('preparing', 'ready')
      AND COALESCE(ms.delivery_type, 'delivery') <> 'pickup'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DISPATCH_SCHEDULE_NOT_AVAILABLE';
    END IF;

    v_city_id := v_schedule.city_id;
    v_restaurant_id := v_schedule.restaurant_id;
    IF v_restaurant_id IS NULL THEN
      SELECT m.restaurant_id INTO v_restaurant_id
      FROM public.meals m
      WHERE m.id = v_schedule.meal_id;
    END IF;

    SELECT r.address INTO v_pickup_address
    FROM public.restaurants r
    WHERE r.id = v_restaurant_id;

    SELECT
      NULLIF(concat_ws(', ', ua.address_line1, ua.address_line2, ua.city), ''),
      ua.latitude,
      ua.longitude
    INTO v_delivery_address, v_delivery_lat, v_delivery_lng
    FROM public.user_addresses ua
    WHERE ua.user_id = v_schedule.user_id
      AND (ua.id = v_schedule.delivery_address_id OR COALESCE(ua.is_default, false))
    ORDER BY (ua.id = v_schedule.delivery_address_id) DESC, ua.updated_at DESC
    LIMIT 1;

    v_delivery_fee := GREATEST(COALESCE(v_schedule.delivery_fee, 0), 0);
    v_tip_amount := 0;
  END IF;

  IF v_city_id IS NULL OR NOT public.can_manage_fleet_city(v_city_id) THEN
    RAISE EXCEPTION 'FLEET_CITY_ACCESS_DENIED';
  END IF;
  IF v_driver.city_id IS NULL OR v_driver.city_id <> v_city_id THEN
    RAISE EXCEPTION 'CROSS_CITY_DRIVER_ASSIGNMENT';
  END IF;

  SELECT dj.* INTO v_job
  FROM public.delivery_jobs dj
  WHERE (
    (v_source_type = 'order' AND dj.order_id = p_source_id)
    OR (v_source_type = 'meal_schedule' AND dj.schedule_id = p_source_id)
  )
  ORDER BY dj.created_at DESC, dj.id
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_job.status NOT IN ('pending', 'assigned', 'accepted') THEN
    RAISE EXCEPTION 'DELIVERY_CAN_NO_LONGER_BE_ASSIGNED';
  END IF;

  IF FOUND
     AND v_job.status = 'accepted'
     AND v_job.driver_id = p_driver_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'job_id', v_job.id,
      'driver_id', p_driver_id,
      'action', 'unchanged'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.delivery_jobs dj
    WHERE dj.driver_id = p_driver_id
      AND dj.status IN ('assigned', 'accepted', 'picked_up', 'in_transit')
      AND (v_job.id IS NULL OR dj.id <> v_job.id)
  ) THEN
    RAISE EXCEPTION 'DRIVER_BUSY';
  END IF;

  v_previous_driver_id := v_job.driver_id;
  PERFORM set_config('app.delivery_mutation_scope', 'fleet_assignment', true);

  IF v_job.id IS NULL THEN
    INSERT INTO public.delivery_jobs (
      schedule_id,
      order_id,
      restaurant_id,
      city_id,
      pickup_address,
      delivery_address,
      delivery_lat,
      delivery_lng,
      delivery_fee,
      tip_amount,
      driver_id,
      status,
      assigned_at,
      updated_at
    ) VALUES (
      CASE WHEN v_source_type = 'meal_schedule' THEN p_source_id END,
      CASE WHEN v_source_type = 'order' THEN p_source_id END,
      v_restaurant_id,
      v_city_id,
      v_pickup_address,
      v_delivery_address,
      v_delivery_lat,
      v_delivery_lng,
      v_delivery_fee,
      v_tip_amount,
      p_driver_id,
      'assigned',
      now(),
      now()
    )
    RETURNING id INTO v_job_id;

    UPDATE public.drivers
    SET current_job_id = v_job_id,
        updated_at = now()
    WHERE id = p_driver_id;

    v_action := 'assigned';
  ELSE
    v_job_id := v_job.id;
    UPDATE public.delivery_jobs
    SET driver_id = p_driver_id,
        status = 'assigned',
        assigned_at = now(),
        accepted_at = CASE
          WHEN v_previous_driver_id IS DISTINCT FROM p_driver_id THEN NULL
          ELSE accepted_at
        END,
        updated_at = now()
    WHERE id = v_job.id;

    IF v_previous_driver_id IS NOT NULL
       AND v_previous_driver_id <> p_driver_id THEN
      UPDATE public.drivers
      SET current_job_id = NULL,
          updated_at = now()
      WHERE id = v_previous_driver_id
        AND current_job_id = v_job.id;
    END IF;

    UPDATE public.drivers
    SET current_job_id = v_job_id,
        updated_at = now()
    WHERE id = p_driver_id;

    v_action := CASE
      WHEN v_previous_driver_id IS NOT NULL AND v_previous_driver_id <> p_driver_id
        THEN 'reassigned'
      ELSE 'assigned'
    END;
  END IF;

  IF v_source_type = 'order' THEN
    UPDATE public.delivery_queue
    SET assigned_driver_id = p_driver_id,
        assigned_at = now(),
        manual_assignment_notes = COALESCE(NULLIF(trim(p_reason), ''), 'Assigned from fleet portal')
    WHERE order_id = p_source_id;
  END IF;

  v_reason := left(
    concat_ws(
      ' - ',
      COALESCE(NULLIF(trim(p_reason), ''), 'Manual dispatch from fleet portal'),
      NULLIF(trim(p_notes), '')
    ),
    1000
  );

  IF v_previous_driver_id IS DISTINCT FROM p_driver_id OR v_job.id IS NULL THEN
    IF v_previous_driver_id IS NOT NULL THEN
      INSERT INTO public.driver_assignment_history (
        job_id, driver_id, action, reason, performed_by, performed_at
      ) VALUES (
        v_job_id, v_previous_driver_id, 'unassigned', v_reason, v_actor, now()
      );
    END IF;

    INSERT INTO public.driver_assignment_history (
      job_id, driver_id, action, reason, performed_by, performed_at
    ) VALUES (
      v_job_id, p_driver_id, 'assigned', v_reason, v_actor, now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'driver_id', p_driver_id,
    'action', v_action
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_fleet_delivery_job(TEXT, UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_fleet_delivery_job(TEXT, UUID, UUID, TEXT, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Sensitive fleet documents require step-up authentication
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_fleet_document_storage(
  p_city_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_city_id UUID;
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN true;
  END IF;
  IF v_user_id IS NULL
     OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RETURN false;
  END IF;
  IF public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF p_city_id IS NULL OR btrim(p_city_id) = '' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.fleet_managers fm
      WHERE fm.auth_user_id = v_user_id
        AND fm.is_active = true
        AND fm.role = 'super_admin'
    );
  END IF;

  v_city_id := p_city_id::UUID;
  RETURN public.can_manage_fleet_city(v_city_id);
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.can_access_fleet_document_storage(TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_fleet_document_storage(TEXT)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- restaurant-photos ownership, role, path, MIME, and size boundaries
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-photos',
  'restaurant-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.can_write_restaurant_photo_object(
  p_name TEXT,
  p_owner_id TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p_user_id IS NOT NULL
    AND COALESCE((storage.foldername(p_name))[1], '') = 'photos'
    AND cardinality(storage.foldername(p_name)) = 1
    AND storage.filename(p_name) ~* '\.(jpe?g|png|webp)$'
    AND (
      (
        public.has_role(p_user_id, 'admin'::public.app_role)
        AND p_owner_id = p_user_id::TEXT
      )
      OR (
        p_owner_id = p_user_id::TEXT
        AND (
          (
            storage.filename(p_name) LIKE p_user_id::TEXT || '-photo-%'
            AND (
              public.has_role(p_user_id, 'partner'::public.app_role)
              OR public.has_role(p_user_id, 'restaurant'::public.app_role)
            )
          )
          OR EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE storage.filename(p_name) LIKE r.id::TEXT || '-%'
              AND public.is_restaurant_operator(r.id, p_user_id)
          )
        )
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_write_restaurant_photo_object(TEXT, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_restaurant_photo_object(TEXT, TEXT, UUID)
  TO authenticated, service_role;

DO $do$
DECLARE
  v_policy RECORD;
  v_expression TEXT;
BEGIN
  FOR v_policy IN
    SELECT policyname, qual, with_check
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    v_expression := lower(
      COALESCE(v_policy.qual, '') || ' ' || COALESCE(v_policy.with_check, '')
    );
    IF v_expression LIKE '%restaurant-photos%'
       OR lower(v_policy.policyname) LIKE '%restaurant photo%' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
    END IF;
  END LOOP;
END;
$do$;

CREATE POLICY restaurant_photos_partner_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-photos'
    AND lower(COALESCE(metadata ->> 'mimetype', '')) IN (
      'image/jpeg', 'image/png', 'image/webp'
    )
    AND public.can_write_restaurant_photo_object(name, owner_id, (SELECT auth.uid()))
  );
CREATE POLICY restaurant_photos_partner_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'restaurant-photos'
    AND public.can_write_restaurant_photo_object(name, owner_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'restaurant-photos'
    AND lower(COALESCE(metadata ->> 'mimetype', '')) IN (
      'image/jpeg', 'image/png', 'image/webp'
    )
    AND public.can_write_restaurant_photo_object(name, owner_id, (SELECT auth.uid()))
  );
CREATE POLICY restaurant_photos_partner_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'restaurant-photos'
    AND public.can_write_restaurant_photo_object(name, owner_id, (SELECT auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Safe public catalog projections
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.public_restaurant_catalog
WITH (security_barrier = true)
AS
SELECT
  r.id,
  r.name,
  r.description,
  r.address,
  r.phone,
  r.phone_number,
  r.website,
  r.logo_url,
  r.image_url,
  r.latitude,
  r.longitude,
  r.cuisine_type,
  r.cuisine_types,
  r.dietary_tags,
  r.operating_hours,
  r.avg_prep_time_minutes,
  r.rating,
  r.avg_rating,
  r.review_count,
  r.reviews_count,
  r.total_orders
FROM public.restaurants r
WHERE r.approval_status = 'approved'::public.approval_status
  AND COALESCE(r.is_active, false) = true
  AND r.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.public_meal_catalog
WITH (security_barrier = true)
AS
SELECT
  m.id,
  m.restaurant_id,
  m.name,
  m.description,
  m.image_url,
  m.category,
  m.category_id,
  m.meal_type,
  m.ingredients,
  m.calories,
  m.protein,
  m.protein_g,
  m.carbs,
  m.carbs_g,
  m.fats,
  m.fat_g,
  m.fiber_g,
  m.price,
  m.prep_time_minutes,
  m.rating,
  m.avg_rating,
  m.review_count,
  m.order_count,
  m.is_featured,
  m.is_vip_exclusive,
  m.supports_high_protein,
  m.high_protein_price_adjustment,
  m.high_protein_calories_increase,
  m.high_protein_protein_increase,
  m.supports_large,
  m.large_price_adjustment,
  m.large_calories_increase,
  m.large_protein_increase,
  m.primary_language
FROM public.meals m
JOIN public.restaurants r ON r.id = m.restaurant_id
WHERE m.approval_status = 'approved'
  AND COALESCE(m.is_available, false) = true
  AND m.deleted_at IS NULL
  AND r.approval_status = 'approved'::public.approval_status
  AND COALESCE(r.is_active, false) = true
  AND r.deleted_at IS NULL;

REVOKE ALL ON public.public_restaurant_catalog, public.public_meal_catalog
  FROM PUBLIC;
GRANT SELECT ON public.public_restaurant_catalog, public.public_meal_catalog
  TO anon, authenticated;

-- Anonymous catalog reads must use the projections above. Authenticated portal
-- policies remain available for owner/admin workflows until their callers are
-- migrated to role-specific projections.
REVOKE SELECT ON public.restaurants, public.meals FROM PUBLIC, anon;

COMMENT ON VIEW public.public_restaurant_catalog IS
  'Approved public restaurant fields; excludes ownership, banking, commission, payout, and moderation metadata.';
COMMENT ON VIEW public.public_meal_catalog IS
  'Approved public meal fields; excludes estimated_cost and internal ranking/moderation metadata.';

COMMIT;
