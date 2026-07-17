BEGIN;

-- Keep the existing broad and forensic-integrity posture checks, then append
-- deployment attestation for the event sources added in this security release.
ALTER FUNCTION public.admin_security_posture()
  RENAME TO admin_security_posture_integrity_v2;

REVOKE ALL ON FUNCTION public.admin_security_posture_integrity_v2()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_security_posture()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_base JSONB;
  v_checks JSONB;
  v_new_checks JSONB;
  v_failures INTEGER;
  v_warnings INTEGER;
  v_missing_trigger_count INTEGER := 0;
  v_missing_triggers JSONB := '[]'::JSONB;
  v_unsafe_rpc_count INTEGER := 0;
  v_unsafe_rpcs JSONB := '[]'::JSONB;
  v_latest_auth_event TIMESTAMPTZ;
  v_auth_events_30d BIGINT := 0;
  v_latest_delivery_event TIMESTAMPTZ;
  v_delivery_events_30d BIGINT := 0;
  v_latest_commercial_event TIMESTAMPTZ;
  v_commercial_events_30d BIGINT := 0;
  v_latest_partner_api_success TIMESTAMPTZ;
  v_partner_api_successes_30d BIGINT := 0;
  v_latest_partner_api_failure TIMESTAMPTZ;
  v_partner_api_failures_30d BIGINT := 0;
  v_auth_status TEXT;
  v_business_status TEXT;
  v_partner_api_status TEXT;
BEGIN
  -- This inherited call performs the AAL2 admin check before returning data.
  v_base := public.admin_security_posture_integrity_v2();

  WITH subscription_plan_columns AS (
    SELECT COALESCE(
      array_agg(requested.column_name ORDER BY requested.position),
      ARRAY[]::TEXT[]
    ) AS required_columns
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
      WHERE attribute.attrelid = to_regclass('public.subscription_plans')
        AND attribute.attname = requested.column_name
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    )
  ), expected(
    table_schema,
    table_name,
    trigger_name,
    function_schema,
    function_name,
    event_mask,
    required_columns
  ) AS (
    SELECT *
    FROM (VALUES
      ('auth', 'audit_log_entries', 'nutrio_security_auth_audit_trigger', 'security', 'capture_auth_audit_entry', 4, ARRAY[]::TEXT[]),
      ('public', 'delivery_jobs', 'security_critical_business_row_trigger', 'security', 'capture_critical_business_change', 12, ARRAY[]::TEXT[]),
      ('public', 'delivery_jobs', 'security_critical_business_update_trigger', 'security', 'capture_critical_business_change', 16, ARRAY['status', 'driver_id', 'handover_method', 'schedule_id']::TEXT[]),
      ('public', 'driver_assignment_history', 'security_critical_business_audit_trigger', 'security', 'capture_critical_business_change', 28, ARRAY[]::TEXT[]),
      ('public', 'subscription_plans', 'security_critical_business_row_trigger', 'security', 'capture_critical_business_change', 12, ARRAY[]::TEXT[]),
      ('public', 'promotions', 'security_critical_business_row_trigger', 'security', 'capture_critical_business_change', 12, ARRAY[]::TEXT[]),
      ('public', 'promotions', 'security_critical_business_update_trigger', 'security', 'capture_critical_business_change', 16, ARRAY['code', 'discount_type', 'discount_value', 'min_order_amount', 'max_discount_amount', 'max_uses', 'max_uses_per_user', 'valid_from', 'valid_until', 'is_active']::TEXT[]),
      ('public', 'platform_settings', 'security_critical_business_audit_trigger', 'security', 'capture_critical_business_change', 28, ARRAY[]::TEXT[]),
      ('public', 'meals', 'security_critical_business_row_trigger', 'security', 'capture_critical_business_change', 12, ARRAY[]::TEXT[]),
      ('public', 'meals', 'security_critical_business_update_trigger', 'security', 'capture_critical_business_change', 16, ARRAY['price', 'is_available', 'restaurant_id']::TEXT[])
    ) AS static_expected(
      table_schema,
      table_name,
      trigger_name,
      function_schema,
      function_name,
      event_mask,
      required_columns
    )
    UNION ALL
    SELECT
      'public',
      'subscription_plans',
      'security_critical_business_update_trigger',
      'security',
      'capture_critical_business_change',
      16,
      subscription_plan_columns.required_columns
    FROM subscription_plan_columns
  ), missing AS (
    SELECT
      e.table_schema,
      e.table_name,
      e.trigger_name,
      e.function_schema,
      e.function_name
    FROM expected e
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger trigger_row
      JOIN pg_catalog.pg_class relation
        ON relation.oid = trigger_row.tgrelid
      JOIN pg_catalog.pg_namespace relation_namespace
        ON relation_namespace.oid = relation.relnamespace
      JOIN pg_catalog.pg_proc trigger_function
        ON trigger_function.oid = trigger_row.tgfoid
      JOIN pg_catalog.pg_namespace function_namespace
        ON function_namespace.oid = trigger_function.pronamespace
      WHERE relation_namespace.nspname = e.table_schema
        AND relation.relname = e.table_name
        AND trigger_row.tgname = e.trigger_name
        AND function_namespace.nspname = e.function_schema
        AND trigger_function.proname = e.function_name
        -- pg_trigger.tgtype bits: ROW=1, BEFORE=2, INSERT=4,
        -- DELETE=8, UPDATE=16, TRUNCATE=32, INSTEAD=64.
        AND (trigger_row.tgtype::INTEGER & 1) = 1
        AND (trigger_row.tgtype::INTEGER & 2) = 0
        AND (trigger_row.tgtype::INTEGER & 64) = 0
        AND (trigger_row.tgtype::INTEGER & 60) = e.event_mask
        AND trigger_row.tgenabled IN ('O', 'A')
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgqual IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(e.required_columns) AS required_column(column_name)
          WHERE NOT EXISTS (
            SELECT 1
            FROM unnest(trigger_row.tgattr::SMALLINT[]) AS trigger_attribute(attribute_number)
            JOIN pg_catalog.pg_attribute attribute
              ON attribute.attrelid = trigger_row.tgrelid
             AND attribute.attnum = trigger_attribute.attribute_number
            WHERE attribute.attname = required_column.column_name
              AND NOT attribute.attisdropped
          )
        )
    )
  )
  SELECT
    count(*),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'table', table_schema || '.' || table_name,
          'trigger', trigger_name,
          'function', function_schema || '.' || function_name
        )
        ORDER BY table_schema, table_name, trigger_name
      ),
      '[]'::JSONB
    )
  INTO v_missing_trigger_count, v_missing_triggers
  FROM missing;

  WITH required(signature) AS (
    VALUES
      ('public.admin_finalize_partner_invitation(uuid,uuid,uuid,text,text,text,text,text,text,text)'),
      ('public.authenticate_partner_api_request(uuid,text)')
  ), resolved AS (
    SELECT signature, to_regprocedure(signature) AS function_oid
    FROM required
  ), unsafe AS (
    SELECT signature
    FROM resolved
    WHERE function_oid IS NULL
       OR NOT COALESCE(
         pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE'),
         false
       )
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.pg_proc function_row
         CROSS JOIN LATERAL pg_catalog.aclexplode(
           COALESCE(
             function_row.proacl,
             pg_catalog.acldefault('f', function_row.proowner)
           )
         ) AS function_acl
         LEFT JOIN pg_catalog.pg_roles grantee_role
           ON grantee_role.oid = function_acl.grantee
         WHERE function_row.oid = function_oid
           AND function_acl.privilege_type = 'EXECUTE'
           AND function_acl.grantee <> function_row.proowner
           AND COALESCE(grantee_role.rolname, 'PUBLIC') <> 'service_role'
       )
  )
  SELECT
    count(*),
    COALESCE(jsonb_agg(signature ORDER BY signature), '[]'::JSONB)
  INTO v_unsafe_rpc_count, v_unsafe_rpcs
  FROM unsafe;

  SELECT
    max(e.occurred_at),
    count(*) FILTER (WHERE e.occurred_at >= clock_timestamp() - interval '30 days')
  INTO v_latest_auth_event, v_auth_events_30d
  FROM security.event_ledger e
  WHERE e.event_type LIKE 'authentication.supabase.%';

  SELECT
    max(e.occurred_at),
    count(*) FILTER (WHERE e.occurred_at >= clock_timestamp() - interval '30 days')
  INTO v_latest_delivery_event, v_delivery_events_30d
  FROM security.event_ledger e
  WHERE e.event_type LIKE 'delivery.%';

  SELECT
    max(e.occurred_at),
    count(*) FILTER (WHERE e.occurred_at >= clock_timestamp() - interval '30 days')
  INTO v_latest_commercial_event, v_commercial_events_30d
  FROM security.event_ledger e
  WHERE e.event_type LIKE 'commercial.%';

  SELECT
    max(e.occurred_at),
    count(*) FILTER (WHERE e.occurred_at >= clock_timestamp() - interval '30 days')
  INTO v_latest_partner_api_success, v_partner_api_successes_30d
  FROM security.event_ledger e
  WHERE e.event_type = 'partner.api_authentication_succeeded';

  SELECT
    max(e.occurred_at),
    count(*) FILTER (WHERE e.occurred_at >= clock_timestamp() - interval '30 days')
  INTO v_latest_partner_api_failure, v_partner_api_failures_30d
  FROM security.event_ledger e
  WHERE e.event_type = 'partner.api_authentication_failed';

  v_auth_status := CASE
    WHEN v_latest_auth_event IS NULL THEN 'warning'
    WHEN v_latest_auth_event < clock_timestamp() - interval '30 days' THEN 'warning'
    ELSE 'pass'
  END;
  v_business_status := CASE
    WHEN v_latest_delivery_event IS NULL OR v_latest_commercial_event IS NULL
      THEN 'warning'
    WHEN v_latest_delivery_event < clock_timestamp() - interval '30 days'
      OR v_latest_commercial_event < clock_timestamp() - interval '30 days'
      THEN 'warning'
    ELSE 'pass'
  END;
  v_partner_api_status := CASE
    WHEN v_latest_partner_api_success IS NULL OR v_latest_partner_api_failure IS NULL
      THEN 'warning'
    WHEN v_latest_partner_api_success < clock_timestamp() - interval '30 days'
      OR v_latest_partner_api_failure < clock_timestamp() - interval '30 days'
      THEN 'warning'
    ELSE 'pass'
  END;

  v_new_checks := jsonb_build_array(
    jsonb_build_object(
      'id', 'security_event_sources_installed',
      'label', 'Security event source installation',
      'status', CASE WHEN v_missing_trigger_count = 0 THEN 'pass' ELSE 'fail' END,
      'count', v_missing_trigger_count,
      'summary', CASE WHEN v_missing_trigger_count = 0
        THEN 'Auth, delivery, and commercial evidence triggers are installed and enabled'
        ELSE 'Required evidence triggers are missing, inactive for normal traffic, or have the wrong event/column/function binding' END,
      'items', v_missing_triggers
    ),
    jsonb_build_object(
      'id', 'service_only_security_rpcs',
      'label', 'Service-only security operations',
      'status', CASE WHEN v_unsafe_rpc_count = 0 THEN 'pass' ELSE 'fail' END,
      'count', v_unsafe_rpc_count,
      'summary', CASE WHEN v_unsafe_rpc_count = 0
        THEN 'Partner provisioning and API authentication RPCs are restricted to service role'
        ELSE 'A required security RPC is missing or exposed to a client role' END,
      'items', v_unsafe_rpcs
    ),
    jsonb_build_object(
      'id', 'auth_event_flow_verified',
      'label', 'Authentication evidence flow',
      'status', v_auth_status,
      'count', v_auth_events_30d,
      'summary', CASE
        WHEN v_latest_auth_event IS NULL THEN 'No Supabase Auth event has reached the Nutrio ledger yet; run a staging login and MFA verification'
        WHEN v_auth_status = 'warning' THEN 'The latest mirrored Auth event is stale; verify the Auth audit trigger and log drain'
        ELSE 'Supabase Auth events are reaching the immutable Nutrio ledger'
      END,
      'items', jsonb_build_array(jsonb_build_object(
        'latest_event', v_latest_auth_event,
        'events_30d', v_auth_events_30d
      ))
    ),
    jsonb_build_object(
      'id', 'critical_business_event_flow_verified',
      'label', 'Delivery and commercial evidence flow',
      'status', v_business_status,
      'count', v_delivery_events_30d + v_commercial_events_30d,
      'summary', CASE
        WHEN v_latest_delivery_event IS NULL AND v_latest_commercial_event IS NULL
          THEN 'No delivery or commercial evidence has been observed yet; exercise both paths in staging'
        WHEN v_latest_delivery_event IS NULL
          THEN 'Commercial evidence is present, but no delivery custody event has been observed'
        WHEN v_latest_commercial_event IS NULL
          THEN 'Delivery evidence is present, but no commercial control event has been observed'
        WHEN v_business_status = 'warning'
          THEN 'Delivery or commercial evidence is older than 30 days; exercise both paths again'
        ELSE 'Delivery and commercial control changes are both producing immutable evidence'
      END,
      'items', jsonb_build_array(
        jsonb_build_object(
          'path', 'delivery',
          'latest_event', v_latest_delivery_event,
          'events_30d', v_delivery_events_30d
        ),
        jsonb_build_object(
          'path', 'commercial',
          'latest_event', v_latest_commercial_event,
          'events_30d', v_commercial_events_30d
        )
      )
    ),
    jsonb_build_object(
      'id', 'partner_api_event_flow_verified',
      'label', 'Partner API authentication evidence',
      'status', v_partner_api_status,
      'count', v_partner_api_successes_30d + v_partner_api_failures_30d,
      'summary', CASE
        WHEN v_latest_partner_api_success IS NULL AND v_latest_partner_api_failure IS NULL
          THEN 'No Partner API authentication evidence exists yet; test one success and one failure in staging'
        WHEN v_latest_partner_api_success IS NULL
          THEN 'Partner API failures are recorded, but a successful authentication has not been verified'
        WHEN v_latest_partner_api_failure IS NULL
          THEN 'Partner API success is recorded, but the rejection path has not been verified'
        WHEN v_partner_api_status = 'warning'
          THEN 'Partner API success or failure evidence is older than 30 days; retest both paths'
        ELSE 'Partner API success and failure attempts are both producing immutable evidence'
      END,
      'items', jsonb_build_array(
        jsonb_build_object(
          'outcome', 'success',
          'latest_event', v_latest_partner_api_success,
          'events_30d', v_partner_api_successes_30d
        ),
        jsonb_build_object(
          'outcome', 'failure',
          'latest_event', v_latest_partner_api_failure,
          'events_30d', v_partner_api_failures_30d
        )
      )
    )
  );

  v_checks := COALESCE(v_base -> 'checks', '[]'::JSONB) || v_new_checks;
  v_failures := COALESCE((v_base ->> 'failure_count')::INTEGER, 0)
    + CASE WHEN v_missing_trigger_count > 0 THEN 1 ELSE 0 END
    + CASE WHEN v_unsafe_rpc_count > 0 THEN 1 ELSE 0 END;
  v_warnings := COALESCE((v_base ->> 'warning_count')::INTEGER, 0)
    + CASE WHEN v_auth_status = 'warning' THEN 1 ELSE 0 END
    + CASE WHEN v_business_status = 'warning' THEN 1 ELSE 0 END
    + CASE WHEN v_partner_api_status = 'warning' THEN 1 ELSE 0 END;

  RETURN v_base || jsonb_build_object(
    'generated_at', clock_timestamp(),
    'release_version', '20260717100000',
    'status', CASE
      WHEN v_failures > 0 THEN 'action_required'
      WHEN v_warnings > 0 THEN 'review'
      ELSE 'healthy'
    END,
    'failure_count', v_failures,
    'warning_count', v_warnings,
    'checks', v_checks
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_security_posture()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_security_posture()
  TO authenticated;

COMMENT ON FUNCTION public.admin_security_posture() IS
  'AAL2-admin-only live posture plus runtime evidence-source attestation for security release 20260717100000.';

NOTIFY pgrst, 'reload schema';

COMMIT;
