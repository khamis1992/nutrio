-- Close the remaining partner-banking exposure and make restaurant onboarding
-- atomic. This intentionally builds on, and does not modify,
-- 20260716130000_harden_partner_banking_payout_data.sql.

BEGIN;

-- Bank names are not payment credentials, but returning the full value lets a
-- browser correlate a partner with a financial institution. Keep the existing
-- helper signature for compatibility while masking every banking field.
CREATE OR REPLACE FUNCTION security.get_restaurant_banking_masked_value(
  p_details_id UUID,
  p_field TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
DECLARE
  v_restaurant_id UUID;
  v_encrypted BYTEA;
  v_value TEXT;
  v_compact TEXT;
BEGIN
  IF p_field NOT IN ('account_name', 'account_number', 'iban', 'swift', 'bank_name') THEN
    RAISE EXCEPTION 'Unsupported banking field';
  END IF;

  SELECT
    rd.restaurant_id,
    CASE p_field
      WHEN 'account_name' THEN rd.bank_account_name_encrypted
      WHEN 'account_number' THEN rd.bank_account_number_encrypted
      WHEN 'iban' THEN rd.bank_iban_encrypted
      WHEN 'swift' THEN rd.bank_swift_encrypted
      WHEN 'bank_name' THEN rd.bank_name_encrypted
    END
  INTO v_restaurant_id, v_encrypted
  FROM public.restaurant_details rd
  WHERE rd.id = p_details_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (
       auth.uid() IS NULL
       OR NOT (
         public.has_role(auth.uid(), 'admin'::public.app_role)
         OR EXISTS (
           SELECT 1
           FROM public.restaurants r
           WHERE r.id = v_restaurant_id
             AND r.owner_id = auth.uid()
         )
       )
     ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  v_value := NULLIF(trim(security.decrypt_sensitive_data(v_encrypted)), '');
  IF v_value IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_field IN ('bank_name', 'account_name') THEN
    IF char_length(v_value) <= 2 THEN
      RETURN repeat('*', char_length(v_value));
    END IF;

    RETURN left(v_value, 1)
      || repeat('*', LEAST(char_length(v_value) - 2, 8))
      || right(v_value, 1);
  END IF;

  v_compact := regexp_replace(v_value, '[^[:alnum:]]', '', 'g');

  IF p_field IN ('account_number', 'iban') THEN
    RETURN '****' || right(v_compact, 4);
  END IF;

  IF char_length(v_compact) <= 4 THEN
    RETURN repeat('*', char_length(v_compact));
  END IF;

  RETURN left(v_compact, 4)
    || '****'
    || CASE WHEN char_length(v_compact) > 6 THEN right(v_compact, 2) ELSE '' END;
END;
$function$;

COMMENT ON FUNCTION security.get_restaurant_banking_masked_value(UUID, TEXT) IS
  'Authorized banking display helper. Every field, including bank name, is masked.';

-- Preserve the old bank_name key for deployed clients, but make it an alias of
-- bank_name_masked. No plaintext banking value leaves this function.
CREATE OR REPLACE FUNCTION public.get_restaurant_banking_summary(
  p_restaurant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, security, extensions, pg_temp
AS $function$
DECLARE
  v_details public.restaurant_details%ROWTYPE;
  v_is_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  v_bank_name_masked TEXT;
BEGIN
  IF NOT v_is_service
     AND (
       auth.uid() IS NULL
       OR NOT (
         public.has_role(auth.uid(), 'admin'::public.app_role)
         OR EXISTS (
           SELECT 1
           FROM public.restaurants r
           WHERE r.id = p_restaurant_id
             AND r.owner_id = auth.uid()
         )
       )
     ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT rd.*
  INTO v_details
  FROM public.restaurant_details rd
  WHERE rd.restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'restaurant_id', p_restaurant_id,
      'bank_name', NULL,
      'bank_name_masked', NULL,
      'bank_account_name_masked', NULL,
      'bank_account_number_masked', NULL,
      'bank_iban_masked', NULL,
      'swift_code_masked', NULL,
      'payout_frequency', 'weekly',
      'is_configured', false,
      'updated_at', NULL
    );
  END IF;

  v_bank_name_masked := security.get_restaurant_banking_masked_value(
    v_details.id,
    'bank_name'
  );

  RETURN jsonb_build_object(
    'restaurant_id', p_restaurant_id,
    'bank_name', v_bank_name_masked,
    'bank_name_masked', v_bank_name_masked,
    'bank_account_name_masked', security.get_restaurant_banking_masked_value(v_details.id, 'account_name'),
    'bank_account_number_masked', security.get_restaurant_banking_masked_value(v_details.id, 'account_number'),
    'bank_iban_masked', security.get_restaurant_banking_masked_value(v_details.id, 'iban'),
    'swift_code_masked', security.get_restaurant_banking_masked_value(v_details.id, 'swift'),
    'payout_frequency', COALESCE(v_details.payout_frequency, 'weekly'),
    'is_configured', (
      v_details.bank_name_encrypted IS NOT NULL
      AND v_details.bank_account_name_encrypted IS NOT NULL
      AND v_details.bank_account_number_encrypted IS NOT NULL
    ),
    'updated_at', v_details.updated_at
  );
END;
$function$;

-- A request key makes retries after a network timeout idempotent without ever
-- persisting a hash or copy of the banking payload.
CREATE TABLE IF NOT EXISTS security.partner_onboarding_requests (
  request_key UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS partner_onboarding_requests_actor_completed_idx
  ON security.partner_onboarding_requests (actor_id, completed_at DESC);

ALTER TABLE security.partner_onboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.partner_onboarding_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE security.partner_onboarding_requests
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE security.partner_onboarding_requests IS
  'Server-only idempotency receipts for atomic partner onboarding. Contains no banking payload.';

-- Record successful banking changes without copying ciphertext or plaintext
-- into the evidence ledger. Failed writes roll back and therefore leave no
-- misleading success event.
CREATE OR REPLACE FUNCTION security.audit_partner_banking_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_restaurant_id UUID;
  v_changed_fields TEXT[];
  v_actor UUID := auth.uid();
  v_actor_role TEXT;
  v_headers JSONB := '{}'::JSONB;
  v_ip INET;
  v_country_code TEXT;
  v_session_id TEXT := NULLIF(auth.jwt() ->> 'session_id', '');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(field_name ORDER BY field_name)
    INTO v_changed_fields
    FROM (
      VALUES
        ('bank_name_encrypted', OLD.bank_name_encrypted IS DISTINCT FROM NEW.bank_name_encrypted),
        ('bank_account_name_encrypted', OLD.bank_account_name_encrypted IS DISTINCT FROM NEW.bank_account_name_encrypted),
        ('bank_account_number_encrypted', OLD.bank_account_number_encrypted IS DISTINCT FROM NEW.bank_account_number_encrypted),
        ('bank_iban_encrypted', OLD.bank_iban_encrypted IS DISTINCT FROM NEW.bank_iban_encrypted),
        ('bank_swift_encrypted', OLD.bank_swift_encrypted IS DISTINCT FROM NEW.bank_swift_encrypted),
        ('payout_frequency', OLD.payout_frequency IS DISTINCT FROM NEW.payout_frequency)
    ) AS changes(field_name, changed)
    WHERE changed;
    v_restaurant_id := NEW.restaurant_id;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT array_agg(field_name ORDER BY field_name)
    INTO v_changed_fields
    FROM (
      VALUES
        ('bank_name_encrypted', NEW.bank_name_encrypted IS NOT NULL),
        ('bank_account_name_encrypted', NEW.bank_account_name_encrypted IS NOT NULL),
        ('bank_account_number_encrypted', NEW.bank_account_number_encrypted IS NOT NULL),
        ('bank_iban_encrypted', NEW.bank_iban_encrypted IS NOT NULL),
        ('bank_swift_encrypted', NEW.bank_swift_encrypted IS NOT NULL)
    ) AS changes(field_name, changed)
    WHERE changed;
    v_restaurant_id := NEW.restaurant_id;
  ELSE
    SELECT array_agg(field_name ORDER BY field_name)
    INTO v_changed_fields
    FROM (
      VALUES
        ('bank_name_encrypted', OLD.bank_name_encrypted IS NOT NULL),
        ('bank_account_name_encrypted', OLD.bank_account_name_encrypted IS NOT NULL),
        ('bank_account_number_encrypted', OLD.bank_account_number_encrypted IS NOT NULL),
        ('bank_iban_encrypted', OLD.bank_iban_encrypted IS NOT NULL),
        ('bank_swift_encrypted', OLD.bank_swift_encrypted IS NOT NULL)
    ) AS changes(field_name, changed)
    WHERE changed;
    v_restaurant_id := OLD.restaurant_id;
  END IF;

  IF COALESCE(cardinality(v_changed_fields), 0) = 0 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT ur.role::TEXT
    INTO v_actor_role
    FROM public.user_roles ur
    WHERE ur.user_id = v_actor
    ORDER BY CASE ur.role::TEXT WHEN 'admin' THEN 1 ELSE 2 END
    LIMIT 1;
  END IF;

  BEGIN
    v_headers := COALESCE(
      NULLIF(current_setting('request.headers', true), '')::JSONB,
      '{}'::JSONB
    );
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::JSONB;
  END;

  BEGIN
    v_ip := NULLIF(trim(split_part(COALESCE(
      v_headers ->> 'cf-connecting-ip',
      v_headers ->> 'x-forwarded-for',
      ''
    ), ',', 1)), '')::INET;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip := NULL;
  END;

  v_country_code := upper(trim(COALESCE(v_headers ->> 'cf-ipcountry', '')));
  IF v_country_code !~ '^[A-Z]{2}$' THEN
    v_country_code := NULL;
  END IF;

  INSERT INTO security.event_ledger (
    event_type,
    category,
    severity,
    source,
    outcome,
    actor_user_id,
    actor_role,
    actor_type,
    action,
    resource_type,
    resource_id,
    request_id,
    correlation_id,
    session_fingerprint,
    ip_address,
    country_code,
    user_agent,
    metadata,
    event_hash
  ) VALUES (
    'partner.banking.' || lower(TG_OP),
    'payment',
    'high',
    'database',
    'success',
    v_actor,
    v_actor_role,
    CASE
      WHEN v_actor_role = 'admin' THEN 'admin'
      WHEN v_actor_role IN ('partner', 'restaurant') THEN 'partner'
      WHEN v_actor IS NULL THEN 'system'
      ELSE 'user'
    END,
    lower(TG_OP),
    'public.restaurant_details.banking',
    v_restaurant_id::TEXT,
    left(COALESCE(v_headers ->> 'sb-request-id', v_headers ->> 'x-request-id'), 128),
    left(v_headers ->> 'x-correlation-id', 128),
    CASE WHEN v_session_id IS NULL THEN NULL ELSE 'session:' || v_session_id END,
    v_ip,
    v_country_code,
    left(v_headers ->> 'user-agent', 512),
    jsonb_build_object(
      'changed_fields', to_jsonb(v_changed_fields),
      'transaction_id', txid_current()::TEXT,
      'contains_banking_payload', false
    ),
    repeat('0', 64)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION security.audit_partner_banking_change()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS restaurant_details_banking_audit_trigger
  ON public.restaurant_details;
CREATE TRIGGER restaurant_details_banking_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.restaurant_details
FOR EACH ROW EXECUTE FUNCTION security.audit_partner_banking_change();

CREATE OR REPLACE FUNCTION public.complete_partner_onboarding(
  p_request_key UUID,
  p_name TEXT,
  p_description TEXT,
  p_address TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_website_url TEXT,
  p_logo_url TEXT,
  p_cuisine_types TEXT[],
  p_dietary_tags TEXT[],
  p_operating_hours JSONB,
  p_avg_prep_time_minutes INTEGER,
  p_max_meals_per_day INTEGER,
  p_bank_name TEXT,
  p_bank_account_name TEXT,
  p_bank_account_number TEXT,
  p_bank_iban TEXT,
  p_swift_code TEXT,
  p_payout_frequency TEXT,
  p_terms_accepted BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, security, extensions, pg_temp
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_request_actor UUID;
  v_restaurant_id UUID;
  v_existing_request_restaurant UUID;
  v_reused_existing BOOLEAN := false;
  v_name TEXT := NULLIF(trim(p_name), '');
  v_description TEXT := NULLIF(trim(p_description), '');
  v_address TEXT := NULLIF(trim(p_address), '');
  v_phone TEXT := NULLIF(trim(p_phone), '');
  v_email TEXT := NULLIF(trim(p_email), '');
  v_website_url TEXT := NULLIF(trim(p_website_url), '');
  v_logo_url TEXT := NULLIF(trim(p_logo_url), '');
  v_cuisine_types TEXT[];
  v_dietary_tags TEXT[];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF NOT (
    public.has_role(v_actor, 'partner'::public.app_role)
    OR public.has_role(v_actor, 'restaurant'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'PARTNER_ROLE_REQUIRED';
  END IF;

  IF p_request_key IS NULL THEN
    RAISE EXCEPTION 'ONBOARDING_REQUEST_KEY_REQUIRED';
  END IF;

  IF p_terms_accepted IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'TERMS_ACCEPTANCE_REQUIRED';
  END IF;

  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 2 AND 160 THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_NAME';
  END IF;

  IF v_description IS NULL OR char_length(v_description) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_DESCRIPTION';
  END IF;

  IF v_address IS NULL OR char_length(v_address) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_ADDRESS';
  END IF;

  IF v_phone IS NULL OR char_length(v_phone) NOT BETWEEN 5 AND 32 THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_PHONE';
  END IF;

  IF v_email IS NOT NULL
     AND (char_length(v_email) > 320 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_EMAIL';
  END IF;

  IF v_website_url IS NOT NULL AND char_length(v_website_url) > 500 THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_WEBSITE';
  END IF;

  IF v_logo_url IS NOT NULL
     AND (char_length(v_logo_url) > 1000 OR v_logo_url !~* '^https://') THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_LOGO_URL';
  END IF;

  IF p_avg_prep_time_minutes IS NULL
     OR p_avg_prep_time_minutes NOT BETWEEN 1 AND 600
     OR p_max_meals_per_day IS NULL
     OR p_max_meals_per_day NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_CAPACITY';
  END IF;

  IF p_operating_hours IS NULL
     OR jsonb_typeof(p_operating_hours) <> 'object'
     OR pg_column_size(p_operating_hours) > 16384 THEN
    RAISE EXCEPTION 'INVALID_OPERATING_HOURS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_operating_hours) AS day(day_name)
    WHERE day_name NOT IN (
      'monday', 'tuesday', 'wednesday', 'thursday',
      'friday', 'saturday', 'sunday'
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_OPERATING_HOURS_DAY';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_operating_hours) AS schedule(day_name, hours)
    WHERE jsonb_typeof(schedule.hours) <> 'object'
       OR NOT (schedule.hours ? 'is_open')
       OR jsonb_typeof(schedule.hours -> 'is_open') <> 'boolean'
       OR COALESCE(schedule.hours ->> 'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR COALESCE(schedule.hours ->> 'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ) THEN
    RAISE EXCEPTION 'INVALID_OPERATING_HOURS_VALUE';
  END IF;

  IF cardinality(COALESCE(p_cuisine_types, ARRAY[]::TEXT[])) NOT BETWEEN 1 AND 20
     OR cardinality(COALESCE(p_dietary_tags, ARRAY[]::TEXT[])) > 30 THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_TAGS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_cuisine_types, ARRAY[]::TEXT[])) AS cuisine(value)
    WHERE NULLIF(trim(cuisine.value), '') IS NULL
       OR char_length(trim(cuisine.value)) > 80
  ) OR EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_dietary_tags, ARRAY[]::TEXT[])) AS tag(value)
    WHERE NULLIF(trim(tag.value), '') IS NULL
       OR char_length(trim(tag.value)) > 80
  ) THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_TAG_VALUE';
  END IF;

  SELECT array_agg(value ORDER BY value)
  INTO v_cuisine_types
  FROM (
    SELECT DISTINCT trim(cuisine.value) AS value
    FROM unnest(p_cuisine_types) AS cuisine(value)
  ) normalized_cuisines;

  SELECT COALESCE(array_agg(value ORDER BY value), ARRAY[]::TEXT[])
  INTO v_dietary_tags
  FROM (
    SELECT DISTINCT trim(tag.value) AS value
    FROM unnest(COALESCE(p_dietary_tags, ARRAY[]::TEXT[])) AS tag(value)
  ) normalized_tags;

  -- Serialize retries for the same actor and request key. This closes both the
  -- duplicate-submit race and the response-lost retry race.
  PERFORM pg_advisory_xact_lock(
    pg_catalog.hashtextextended('partner-onboarding-actor:' || v_actor::TEXT, 0)
  );
  PERFORM pg_advisory_xact_lock(
    pg_catalog.hashtextextended('partner-onboarding-request:' || p_request_key::TEXT, 0)
  );

  SELECT por.actor_id, por.restaurant_id
  INTO v_request_actor, v_existing_request_restaurant
  FROM security.partner_onboarding_requests por
  WHERE por.request_key = p_request_key;

  IF FOUND THEN
    IF v_request_actor <> v_actor THEN
      RAISE EXCEPTION 'ONBOARDING_REQUEST_KEY_CONFLICT';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.restaurants r
      JOIN public.restaurant_details rd ON rd.restaurant_id = r.id
      WHERE r.id = v_existing_request_restaurant
        AND r.owner_id = v_actor
        AND rd.onboarding_completed = true
    ) THEN
      RAISE EXCEPTION 'ONBOARDING_RECEIPT_INCONSISTENT';
    END IF;

    RETURN jsonb_build_object(
      'restaurant_id', v_existing_request_restaurant,
      'onboarding_completed', true,
      'duplicate', true,
      'reused_existing', true
    );
  END IF;

  -- Reuse the oldest incomplete pending application. This repairs signup
  -- placeholders and legacy partial rows instead of creating duplicates.
  SELECT r.id
  INTO v_restaurant_id
  FROM public.restaurants r
  LEFT JOIN public.restaurant_details rd ON rd.restaurant_id = r.id
  WHERE r.owner_id = v_actor
    AND r.approval_status = 'pending'::public.approval_status
    AND (rd.id IS NULL OR COALESCE(rd.onboarding_completed, false) = false)
  ORDER BY r.created_at ASC
  LIMIT 1
  FOR UPDATE OF r;

  v_reused_existing := FOUND;

  IF v_restaurant_id IS NULL THEN
    INSERT INTO public.restaurants (
      owner_id,
      name,
      description,
      address,
      phone,
      email,
      logo_url,
      approval_status,
      is_active,
      cuisine_types,
      operating_hours,
      avg_prep_time_minutes,
      max_meals_per_day
    ) VALUES (
      v_actor,
      v_name,
      v_description,
      v_address,
      v_phone,
      v_email,
      v_logo_url,
      'pending'::public.approval_status,
      false,
      v_cuisine_types,
      p_operating_hours,
      p_avg_prep_time_minutes,
      p_max_meals_per_day
    )
    RETURNING id INTO v_restaurant_id;
  ELSE
    UPDATE public.restaurants
    SET name = v_name,
        description = v_description,
        address = v_address,
        phone = v_phone,
        email = v_email,
        logo_url = COALESCE(v_logo_url, logo_url),
        is_active = false,
        cuisine_types = v_cuisine_types,
        operating_hours = p_operating_hours,
        avg_prep_time_minutes = p_avg_prep_time_minutes,
        max_meals_per_day = p_max_meals_per_day,
        updated_at = clock_timestamp()
    WHERE id = v_restaurant_id
      AND owner_id = v_actor
      AND approval_status = 'pending'::public.approval_status;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ONBOARDING_RESTAURANT_CHANGED';
    END IF;
  END IF;

  INSERT INTO public.restaurant_details (
    restaurant_id,
    cuisine_type,
    dietary_tags,
    website_url,
    operating_hours,
    avg_prep_time_minutes,
    max_meals_per_day,
    onboarding_step,
    onboarding_completed,
    terms_accepted,
    terms_accepted_at
  ) VALUES (
    v_restaurant_id,
    v_cuisine_types,
    v_dietary_tags,
    v_website_url,
    p_operating_hours,
    p_avg_prep_time_minutes,
    p_max_meals_per_day,
    4,
    false,
    true,
    clock_timestamp()
  )
  ON CONFLICT (restaurant_id) DO UPDATE
  SET cuisine_type = EXCLUDED.cuisine_type,
      dietary_tags = EXCLUDED.dietary_tags,
      website_url = EXCLUDED.website_url,
      operating_hours = EXCLUDED.operating_hours,
      avg_prep_time_minutes = EXCLUDED.avg_prep_time_minutes,
      max_meals_per_day = EXCLUDED.max_meals_per_day,
      onboarding_step = 4,
      onboarding_completed = false,
      terms_accepted = true,
      terms_accepted_at = clock_timestamp(),
      updated_at = clock_timestamp();

  -- This call validates and encrypts every banking value. Any exception rolls
  -- back the restaurant, details, role, and idempotency receipt together.
  PERFORM public.set_restaurant_banking_info(
    v_restaurant_id,
    p_bank_name,
    p_bank_account_name,
    p_bank_account_number,
    p_bank_iban,
    p_swift_code,
    p_payout_frequency
  );

  UPDATE public.restaurant_details
  SET onboarding_step = 5,
      onboarding_completed = true,
      updated_at = clock_timestamp()
  WHERE restaurant_id = v_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_DETAILS_NOT_FOUND';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_actor, 'restaurant'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO security.partner_onboarding_requests (
    request_key,
    actor_id,
    restaurant_id
  ) VALUES (
    p_request_key,
    v_actor,
    v_restaurant_id
  );

  RETURN jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'onboarding_completed', true,
    'duplicate', false,
    'reused_existing', v_reused_existing
  );
END;
$function$;

COMMENT ON FUNCTION public.complete_partner_onboarding(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], JSONB,
  INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) IS
  'Atomically creates or repairs a partner application and encrypts banking data. Returns identifiers only.';

REVOKE ALL ON FUNCTION public.complete_partner_onboarding(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], JSONB,
  INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.complete_partner_onboarding(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], JSONB,
  INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;

COMMIT;
