BEGIN;

-- Financial configuration and delivery custody changes need enough context to
-- reconstruct who changed what without copying secrets or free-form PII into
-- the forensic ledger. These triggers fail closed with the business mutation.
CREATE OR REPLACE FUNCTION security.capture_critical_business_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_old JSONB;
  v_new JSONB;
  v_row JSONB;
  v_actor UUID := auth.uid();
  v_actor_role TEXT;
  v_actor_type TEXT;
  v_resource_id TEXT;
  v_changed_fields TEXT[];
  v_headers JSONB := '{}'::JSONB;
  v_ip INET;
  v_request_id TEXT;
  v_correlation_id TEXT;
  v_session_fingerprint TEXT := NULLIF(auth.jwt() ->> 'session_id', '');
  v_country_code TEXT;
  v_user_agent TEXT;
  v_event_type TEXT;
  v_category TEXT;
  v_metadata JSONB;
BEGIN
  v_old := CASE
    WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD)
    ELSE '{}'::JSONB
  END;
  v_new := CASE
    WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)
    ELSE '{}'::JSONB
  END;
  v_row := CASE WHEN TG_OP = 'DELETE' THEN v_old ELSE v_new END;

  IF v_actor IS NULL
     AND TG_TABLE_NAME = 'driver_assignment_history'
     AND COALESCE(v_row ->> 'performed_by', '') ~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    -- This table has no client write policy; trusted assignment functions set
    -- performed_by when a service-role transaction carries out the change.
    v_actor := (v_row ->> 'performed_by')::UUID;
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT ur.role::TEXT
    INTO v_actor_role
    FROM public.user_roles ur
    WHERE ur.user_id = v_actor
    ORDER BY CASE ur.role::TEXT
      WHEN 'admin' THEN 1
      WHEN 'partner' THEN 2
      WHEN 'driver' THEN 3
      WHEN 'coach' THEN 4
      ELSE 5
    END
    LIMIT 1;
  END IF;

  v_actor_type := CASE
    WHEN v_actor IS NULL THEN 'system'
    WHEN v_actor_role IN ('admin', 'partner', 'driver', 'coach') THEN v_actor_role
    ELSE 'user'
  END;

  v_resource_id := COALESCE(
    NULLIF(v_row ->> 'id', ''),
    NULLIF(v_row ->> 'key', ''),
    NULLIF(v_row ->> 'job_id', ''),
    NULLIF(v_row ->> 'restaurant_id', ''),
    'unknown'
  );

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(keys.key ORDER BY keys.key)
    INTO v_changed_fields
    FROM (
      SELECT key FROM jsonb_object_keys(v_old) AS key
      UNION
      SELECT key FROM jsonb_object_keys(v_new) AS key
    ) AS keys
    WHERE v_old -> keys.key IS DISTINCT FROM v_new -> keys.key;
  ELSE
    v_changed_fields := ARRAY[]::TEXT[];
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
      v_headers ->> 'x-forwarded-for',
      v_headers ->> 'cf-connecting-ip',
      ''
    ), ',', 1)), '')::INET;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip := NULL;
  END;

  v_request_id := left(NULLIF(COALESCE(
    v_headers ->> 'sb-request-id',
    v_headers ->> 'x-request-id',
    ''
  ), ''), 160);
  v_correlation_id := left(NULLIF(v_headers ->> 'x-correlation-id', ''), 160);
  v_user_agent := left(NULLIF(v_headers ->> 'user-agent', ''), 1000);
  v_country_code := upper(trim(COALESCE(v_headers ->> 'cf-ipcountry', '')));
  IF v_country_code !~ '^[A-Z]{2}$' THEN
    v_country_code := NULL;
  END IF;

  v_event_type := CASE
    WHEN TG_TABLE_NAME = 'delivery_jobs'
      THEN 'delivery.job.' || lower(TG_OP)
    WHEN TG_TABLE_NAME = 'driver_assignment_history'
      THEN 'delivery.assignment.' || lower(TG_OP)
    ELSE 'commercial.' || TG_TABLE_NAME || '.' || lower(TG_OP)
  END;
  v_category := CASE
    WHEN TG_TABLE_NAME IN ('delivery_jobs', 'driver_assignment_history')
      THEN 'data_change'
    ELSE 'configuration'
  END;

  v_metadata := jsonb_build_object(
    'changed_fields', COALESCE(to_jsonb(v_changed_fields), '[]'::JSONB),
    'transaction_id', txid_current()::TEXT
  );

  IF TG_TABLE_NAME = 'delivery_jobs' THEN
    v_metadata := v_metadata || jsonb_strip_nulls(jsonb_build_object(
      'previous_status', CASE WHEN TG_OP <> 'INSERT' THEN v_old ->> 'status' END,
      'new_status', CASE WHEN TG_OP <> 'DELETE' THEN v_new ->> 'status' END,
      'previous_driver_id', CASE WHEN TG_OP <> 'INSERT' THEN v_old ->> 'driver_id' END,
      'new_driver_id', CASE WHEN TG_OP <> 'DELETE' THEN v_new ->> 'driver_id' END,
      'schedule_id', COALESCE(v_new ->> 'schedule_id', v_old ->> 'schedule_id'),
      'handover_method', COALESCE(v_new ->> 'handover_method', v_old ->> 'handover_method')
    ));
  ELSIF TG_TABLE_NAME = 'driver_assignment_history' THEN
    v_metadata := v_metadata || jsonb_strip_nulls(jsonb_build_object(
      'job_id', v_row ->> 'job_id',
      'driver_id', v_row ->> 'driver_id',
      'assignment_action', v_row ->> 'action',
      'performed_by', v_row ->> 'performed_by'
    ));
  ELSIF TG_TABLE_NAME = 'subscription_plans' THEN
    v_metadata := v_metadata || jsonb_strip_nulls(jsonb_build_object(
      'previous_state', CASE WHEN TG_OP <> 'INSERT' THEN jsonb_strip_nulls(jsonb_build_object(
        'name', v_old ->> 'name',
        'tier', v_old ->> 'tier',
        'billing_interval', v_old ->> 'billing_interval',
        'price_qar', v_old -> 'price_qar',
        'meal_credits', v_old -> 'meal_credits',
        'meals_per_month', v_old -> 'meals_per_month',
        'meals_per_week', v_old -> 'meals_per_week',
        'snacks_per_month', v_old -> 'snacks_per_month',
        'daily_meals', v_old -> 'daily_meals',
        'daily_snacks', v_old -> 'daily_snacks',
        'price_per_meal', v_old -> 'price_per_meal',
        'price_per_snack', v_old -> 'price_per_snack',
        'discount_percent', v_old -> 'discount_percent',
        'is_active', v_old -> 'is_active'
      )) END,
      'new_state', CASE WHEN TG_OP <> 'DELETE' THEN jsonb_strip_nulls(jsonb_build_object(
        'name', v_new ->> 'name',
        'tier', v_new ->> 'tier',
        'billing_interval', v_new ->> 'billing_interval',
        'price_qar', v_new -> 'price_qar',
        'meal_credits', v_new -> 'meal_credits',
        'meals_per_month', v_new -> 'meals_per_month',
        'meals_per_week', v_new -> 'meals_per_week',
        'snacks_per_month', v_new -> 'snacks_per_month',
        'daily_meals', v_new -> 'daily_meals',
        'daily_snacks', v_new -> 'daily_snacks',
        'price_per_meal', v_new -> 'price_per_meal',
        'price_per_snack', v_new -> 'price_per_snack',
        'discount_percent', v_new -> 'discount_percent',
        'is_active', v_new -> 'is_active'
      )) END
    ));
  ELSIF TG_TABLE_NAME = 'promotions' THEN
    v_metadata := v_metadata || jsonb_strip_nulls(jsonb_build_object(
      'code', COALESCE(v_new ->> 'code', v_old ->> 'code'),
      'previous_state', CASE WHEN TG_OP <> 'INSERT' THEN jsonb_strip_nulls(jsonb_build_object(
        'discount_type', v_old ->> 'discount_type',
        'discount_value', v_old -> 'discount_value',
        'min_order_amount', v_old -> 'min_order_amount',
        'max_discount_amount', v_old -> 'max_discount_amount',
        'max_uses', v_old -> 'max_uses',
        'max_uses_per_user', v_old -> 'max_uses_per_user',
        'valid_from', v_old ->> 'valid_from',
        'valid_until', v_old ->> 'valid_until',
        'is_active', v_old -> 'is_active'
      )) END,
      'new_state', CASE WHEN TG_OP <> 'DELETE' THEN jsonb_strip_nulls(jsonb_build_object(
        'discount_type', v_new ->> 'discount_type',
        'discount_value', v_new -> 'discount_value',
        'min_order_amount', v_new -> 'min_order_amount',
        'max_discount_amount', v_new -> 'max_discount_amount',
        'max_uses', v_new -> 'max_uses',
        'max_uses_per_user', v_new -> 'max_uses_per_user',
        'valid_from', v_new ->> 'valid_from',
        'valid_until', v_new ->> 'valid_until',
        'is_active', v_new -> 'is_active'
      )) END
    ));
  ELSIF TG_TABLE_NAME = 'platform_settings' THEN
    v_metadata := v_metadata || jsonb_strip_nulls(jsonb_build_object(
      'setting_key', COALESCE(v_new ->> 'key', v_old ->> 'key'),
      'previous_value_sha256', CASE WHEN v_old ? 'value' THEN encode(
        extensions.digest(convert_to(COALESCE(v_old ->> 'value', ''), 'UTF8'), 'sha256'),
        'hex'
      ) END,
      'new_value_sha256', CASE WHEN v_new ? 'value' THEN encode(
        extensions.digest(convert_to(COALESCE(v_new ->> 'value', ''), 'UTF8'), 'sha256'),
        'hex'
      ) END
    ));
  ELSIF TG_TABLE_NAME = 'meals' THEN
    v_metadata := v_metadata || jsonb_strip_nulls(jsonb_build_object(
      'restaurant_id', COALESCE(v_new ->> 'restaurant_id', v_old ->> 'restaurant_id'),
      'previous_price', CASE WHEN TG_OP <> 'INSERT' THEN v_old -> 'price' END,
      'new_price', CASE WHEN TG_OP <> 'DELETE' THEN v_new -> 'price' END,
      'previous_availability', CASE WHEN TG_OP <> 'INSERT' THEN v_old -> 'is_available' END,
      'new_availability', CASE WHEN TG_OP <> 'DELETE' THEN v_new -> 'is_available' END
    ));
  END IF;

  INSERT INTO security.event_ledger (
    event_type, category, severity, source, outcome, actor_user_id,
    actor_role, actor_type, action, resource_type, resource_id, request_id,
    correlation_id, session_fingerprint, ip_address, country_code, user_agent,
    metadata, event_hash
  ) VALUES (
    v_event_type,
    v_category,
    'high',
    'database',
    'success',
    v_actor,
    v_actor_role,
    v_actor_type,
    lower(TG_OP),
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    v_resource_id,
    v_request_id,
    v_correlation_id,
    CASE WHEN v_session_fingerprint IS NULL THEN NULL ELSE 'session:' || v_session_fingerprint END,
    v_ip,
    v_country_code,
    v_user_agent,
    v_metadata,
    repeat('0', 64)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DO $do$
DECLARE
  v_subscription_plan_update_columns TEXT;
BEGIN
  IF to_regclass('public.delivery_jobs') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS security_critical_business_row_trigger
      ON public.delivery_jobs;
    DROP TRIGGER IF EXISTS security_critical_business_update_trigger
      ON public.delivery_jobs;
    CREATE TRIGGER security_critical_business_row_trigger
      AFTER INSERT OR DELETE ON public.delivery_jobs
      FOR EACH ROW EXECUTE FUNCTION security.capture_critical_business_change();
    CREATE TRIGGER security_critical_business_update_trigger
      AFTER UPDATE OF status, driver_id, handover_method, schedule_id
      ON public.delivery_jobs
      FOR EACH ROW EXECUTE FUNCTION security.capture_critical_business_change();
  END IF;

  IF to_regclass('public.driver_assignment_history') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS security_critical_business_audit_trigger
      ON public.driver_assignment_history;
    CREATE TRIGGER security_critical_business_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.driver_assignment_history
      FOR EACH ROW EXECUTE FUNCTION security.capture_critical_business_change();
  END IF;

  IF to_regclass('public.subscription_plans') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS security_critical_business_row_trigger
      ON public.subscription_plans;
    DROP TRIGGER IF EXISTS security_critical_business_update_trigger
      ON public.subscription_plans;
    CREATE TRIGGER security_critical_business_row_trigger
      AFTER INSERT OR DELETE ON public.subscription_plans
      FOR EACH ROW EXECUTE FUNCTION security.capture_critical_business_change();

    SELECT string_agg(format('%I', requested.column_name), ', ' ORDER BY requested.position)
    INTO v_subscription_plan_update_columns
    FROM unnest(ARRAY[
      'name',
      'tier',
      'billing_interval',
      'price_qar',
      'meal_credits',
      'meals_per_month',
      'meals_per_week',
      'snacks_per_month',
      'daily_meals',
      'daily_snacks',
      'price_per_meal',
      'price_per_snack',
      'discount_percent',
      'features',
      'is_active'
    ]::TEXT[]) WITH ORDINALITY AS requested(column_name, position)
    WHERE EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute attribute
      WHERE attribute.attrelid = 'public.subscription_plans'::regclass
        AND attribute.attname = requested.column_name
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    );

    IF v_subscription_plan_update_columns IS NULL THEN
      RAISE EXCEPTION 'No auditable subscription plan columns are available';
    END IF;

    EXECUTE format(
      'CREATE TRIGGER security_critical_business_update_trigger AFTER UPDATE OF %s ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION security.capture_critical_business_change()',
      v_subscription_plan_update_columns
    );
  END IF;

  IF to_regclass('public.promotions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS security_critical_business_row_trigger
      ON public.promotions;
    DROP TRIGGER IF EXISTS security_critical_business_update_trigger
      ON public.promotions;
    CREATE TRIGGER security_critical_business_row_trigger
      AFTER INSERT OR DELETE ON public.promotions
      FOR EACH ROW EXECUTE FUNCTION security.capture_critical_business_change();
    CREATE TRIGGER security_critical_business_update_trigger
      AFTER UPDATE OF code, discount_type, discount_value, min_order_amount,
        max_discount_amount, max_uses, max_uses_per_user, valid_from,
        valid_until, is_active
      ON public.promotions
      FOR EACH ROW EXECUTE FUNCTION security.capture_critical_business_change();
  END IF;

  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS security_critical_business_audit_trigger
      ON public.platform_settings;
    CREATE TRIGGER security_critical_business_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.platform_settings
      FOR EACH ROW EXECUTE FUNCTION security.capture_critical_business_change();
  END IF;

  IF to_regclass('public.meals') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS security_critical_business_row_trigger
      ON public.meals;
    DROP TRIGGER IF EXISTS security_critical_business_update_trigger
      ON public.meals;
    CREATE TRIGGER security_critical_business_row_trigger
      AFTER INSERT OR DELETE ON public.meals
      FOR EACH ROW EXECUTE FUNCTION security.capture_critical_business_change();
    CREATE TRIGGER security_critical_business_update_trigger
      AFTER UPDATE OF price, is_available, restaurant_id
      ON public.meals
      FOR EACH ROW EXECUTE FUNCTION security.capture_critical_business_change();
  END IF;
END;
$do$;

REVOKE ALL ON FUNCTION security.capture_critical_business_change()
  FROM PUBLIC, anon, authenticated, service_role;

-- Complete partner provisioning and its attributed evidence in one database
-- transaction. If the ledger write fails, role and ownership changes roll back.
CREATE OR REPLACE FUNCTION public.admin_finalize_partner_invitation(
  p_actor_user_id UUID,
  p_invited_user_id UUID,
  p_restaurant_id UUID,
  p_full_name TEXT,
  p_request_id TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_session_fingerprint TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_linked_restaurant UUID;
  v_event_id UUID;
  v_country_code TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_actor_user_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_roles ur
       WHERE ur.user_id = p_actor_user_id
         AND ur.role::TEXT = 'admin'
     ) THEN
    RAISE EXCEPTION 'Verified admin actor required';
  END IF;

  IF p_invited_user_id IS NULL OR p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Invitation target required';
  END IF;

  IF char_length(trim(COALESCE(p_full_name, ''))) NOT BETWEEN 1 AND 100
     OR p_full_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid partner profile';
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (p_invited_user_id, trim(p_full_name))
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_invited_user_id, 'partner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.restaurants
  SET owner_id = p_invited_user_id
  WHERE id = p_restaurant_id
    AND owner_id IS NULL
  RETURNING id INTO v_linked_restaurant;

  IF v_linked_restaurant IS NULL THEN
    RAISE EXCEPTION 'Restaurant owner conflict';
  END IF;

  v_country_code := upper(trim(COALESCE(p_country_code, '')));
  IF v_country_code !~ '^[A-Z]{2}$' THEN
    v_country_code := NULL;
  END IF;

  v_event_id := security.record_event(
    p_event_type := 'admin.partner_invitation_created',
    p_category := 'admin',
    p_severity := 'high',
    p_source := 'edge',
    p_outcome := 'success',
    p_actor_user_id := p_actor_user_id,
    p_actor_role := 'admin',
    p_actor_type := 'admin',
    p_action := 'invite_partner_owner',
    p_resource_type := 'restaurant',
    p_resource_id := p_restaurant_id::TEXT,
    p_request_id := left(NULLIF(trim(COALESCE(p_request_id, '')), ''), 160),
    p_correlation_id := left(NULLIF(trim(COALESCE(p_correlation_id, '')), ''), 160),
    p_session_fingerprint := left(NULLIF(trim(COALESCE(p_session_fingerprint, '')), ''), 200),
    p_ip_address := p_ip_address,
    p_country_code := v_country_code,
    p_user_agent := left(NULLIF(COALESCE(p_user_agent, ''), ''), 1000),
    p_metadata := jsonb_build_object('invited_user_id', p_invited_user_id)
  );

  RETURN v_event_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_finalize_partner_invitation(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_finalize_partner_invitation(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

-- Partner API authentication is fail closed on evidence failure. Use gateway
-- request headers rather than inet_client_addr(), which identifies the
-- PostgREST/database connection rather than the partner request source.
CREATE OR REPLACE FUNCTION public.authenticate_partner_api_request(
  p_api_key UUID,
  p_api_secret TEXT
)
RETURNS TABLE (
  partner_id UUID,
  name TEXT,
  permissions JSONB,
  rate_limit INTEGER,
  authenticated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
DECLARE
  v_partner RECORD;
  v_headers JSONB := '{}'::JSONB;
  v_ip_raw TEXT;
  v_ip INET;
  v_request_id TEXT;
  v_user_agent TEXT;
  v_ip_source TEXT := 'unavailable';
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  BEGIN
    v_headers := COALESCE(
      NULLIF(current_setting('request.headers', true), '')::JSONB,
      '{}'::JSONB
    );
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::JSONB;
  END;

  v_ip_raw := NULLIF(trim(split_part(COALESCE(
    v_headers ->> 'x-nutrio-origin-ip',
    v_headers ->> 'x-forwarded-for',
    v_headers ->> 'cf-connecting-ip',
    ''
  ), ',', 1)), '');
  IF v_ip_raw IS NOT NULL THEN
    BEGIN
      v_ip := v_ip_raw::INET;
      v_ip_source := CASE
        WHEN NULLIF(v_headers ->> 'x-nutrio-origin-ip', '') IS NOT NULL
          THEN 'trusted_gateway_forwarded'
        ELSE 'supabase_gateway_observed'
      END;
    EXCEPTION WHEN invalid_text_representation THEN
      v_ip := NULL;
      v_ip_source := 'invalid_or_unavailable';
    END;
  END IF;

  v_request_id := left(NULLIF(COALESCE(
    v_headers ->> 'sb-request-id',
    v_headers ->> 'x-request-id',
    ''
  ), ''), 160);
  v_user_agent := left(NULLIF(v_headers ->> 'user-agent', ''), 1000);

  SELECT p.id, p.name, p.permissions, p.rate_limit, p.api_secret_hash
  INTO v_partner
  FROM public.partners p
  WHERE p.api_key = p_api_key
    AND p.status = 'active'
  LIMIT 1;

  IF NOT FOUND
     OR char_length(COALESCE(p_api_secret, '')) NOT BETWEEN 32 AND 512
     OR security.verify_api_secret(p_api_secret, v_partner.api_secret_hash) IS NOT TRUE THEN
    IF v_partner.id IS NOT NULL THEN
      INSERT INTO security.api_auth_failures (
        partner_id, attempted_at, ip_address
      ) VALUES (
        v_partner.id, clock_timestamp(), v_ip
      );
    END IF;

    PERFORM security.record_event(
      p_event_type := 'partner.api_authentication_failed',
      p_category := 'authentication',
      p_severity := 'high',
      p_source := 'database',
      p_outcome := 'failure',
      p_actor_type := 'partner',
      p_action := 'authenticate_partner_api',
      p_resource_type := 'partner',
      p_resource_id := v_partner.id::TEXT,
      p_request_id := v_request_id,
      p_ip_address := v_ip::TEXT,
      p_user_agent := v_user_agent,
      p_metadata := jsonb_build_object(
        'api_key_known', v_partner.id IS NOT NULL,
        'ip_source', v_ip_source
      )
    );

    RETURN QUERY
    SELECT NULL::UUID, NULL::TEXT, NULL::JSONB, NULL::INTEGER, false;
    RETURN;
  END IF;

  UPDATE public.partners
  SET last_used_at = clock_timestamp()
  WHERE id = v_partner.id;

  PERFORM security.record_event(
    p_event_type := 'partner.api_authentication_succeeded',
    p_category := 'authentication',
    p_severity := 'info',
    p_source := 'database',
    p_outcome := 'success',
    p_actor_role := 'partner',
    p_actor_type := 'partner',
    p_action := 'authenticate_partner_api',
    p_resource_type := 'partner',
    p_resource_id := v_partner.id::TEXT,
    p_request_id := v_request_id,
    p_ip_address := v_ip::TEXT,
    p_user_agent := v_user_agent,
    p_metadata := jsonb_build_object('ip_source', v_ip_source)
  );

  RETURN QUERY
  SELECT
    v_partner.id::UUID,
    v_partner.name::TEXT,
    v_partner.permissions::JSONB,
    v_partner.rate_limit::INTEGER,
    true;
END;
$function$;

REVOKE ALL ON FUNCTION public.authenticate_partner_api_request(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authenticate_partner_api_request(UUID, TEXT)
  TO service_role;

COMMENT ON FUNCTION security.capture_critical_business_change() IS
  'Appends redacted, actor-attributed evidence for delivery custody and commercial configuration changes.';
COMMENT ON FUNCTION public.admin_finalize_partner_invitation(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Atomically provisions a partner profile, role, restaurant ownership, and a durable initiating-admin security event.';
COMMENT ON FUNCTION public.authenticate_partner_api_request(UUID, TEXT) IS
  'Authenticates partner API credentials and writes fail-closed success/failure evidence using gateway-observed network context.';

COMMIT;
