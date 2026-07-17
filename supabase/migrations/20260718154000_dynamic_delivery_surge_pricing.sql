-- Server-authoritative dynamic delivery pricing with auditable customer quotes.

CREATE TABLE IF NOT EXISTS public.delivery_surge_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  priority INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 10000),
  days_of_week SMALLINT[] NOT NULL DEFAULT ARRAY[]::SMALLINT[],
  start_time TIME,
  end_time TIME,
  cities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  demand_threshold INTEGER NOT NULL DEFAULT 0 CHECK (demand_threshold BETWEEN 0 AND 10000),
  multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1 CHECK (multiplier BETWEEN 1 AND 5),
  flat_surcharge NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (flat_surcharge BETWEEN 0 AND 500),
  max_surcharge NUMERIC(10, 2) NOT NULL DEFAULT 25 CHECK (max_surcharge BETWEEN 0 AND 500),
  customer_message TEXT NOT NULL DEFAULT 'Higher demand applies for this delivery window.'
    CHECK (char_length(customer_message) BETWEEN 2 AND 180),
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT delivery_surge_rules_days_check CHECK (
    days_of_week <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]
  ),
  CONSTRAINT delivery_surge_rules_window_check CHECK (
    effective_until IS NULL OR effective_from IS NULL OR effective_until > effective_from
  )
);

CREATE INDEX IF NOT EXISTS delivery_surge_rules_matching_idx
  ON public.delivery_surge_rules (enabled, priority DESC, demand_threshold DESC)
  WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS public.delivery_fee_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  delivery_time_slot TEXT NOT NULL,
  delivery_address_id UUID NOT NULL REFERENCES public.user_addresses(id) ON DELETE CASCADE,
  delivery_type TEXT NOT NULL DEFAULT 'standard' CHECK (delivery_type IN ('standard', 'express')),
  city TEXT NOT NULL,
  base_fee NUMERIC(10, 2) NOT NULL CHECK (base_fee >= 0),
  surge_fee NUMERIC(10, 2) NOT NULL CHECK (surge_fee >= 0),
  total_fee NUMERIC(10, 2) NOT NULL CHECK (total_fee >= 0),
  rule_id UUID REFERENCES public.delivery_surge_rules(id) ON DELETE SET NULL,
  rule_name TEXT,
  customer_message TEXT,
  demand_count INTEGER NOT NULL DEFAULT 0 CHECK (demand_count >= 0),
  pricing_context JSONB NOT NULL DEFAULT '{}'::JSONB,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_fee_quotes_user_created_idx
  ON public.delivery_fee_quotes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_fee_quotes_expiry_idx
  ON public.delivery_fee_quotes (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.delivery_surge_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fee_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_surge_rules_admin_all ON public.delivery_surge_rules;
CREATE POLICY delivery_surge_rules_admin_all
  ON public.delivery_surge_rules
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS delivery_fee_quotes_user_select ON public.delivery_fee_quotes;
CREATE POLICY delivery_fee_quotes_user_select
  ON public.delivery_fee_quotes
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

REVOKE INSERT, UPDATE, DELETE ON public.delivery_fee_quotes FROM anon, authenticated;
GRANT SELECT ON public.delivery_fee_quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_surge_rules TO authenticated;

ALTER TABLE public.meal_schedules
  ADD COLUMN IF NOT EXISTS delivery_fee_base NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_surge NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_rule_id UUID REFERENCES public.delivery_surge_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_fee_quote_id UUID REFERENCES public.delivery_fee_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_fee_context JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS delivery_fee_calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_fee_group_primary BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.calculate_delivery_fee_breakdown(
  p_user_id UUID,
  p_scheduled_date DATE,
  p_delivery_time_slot TEXT,
  p_delivery_address_id UUID,
  p_delivery_type TEXT DEFAULT 'standard',
  p_order_total NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings JSONB := '{}'::JSONB;
  v_enabled BOOLEAN := FALSE;
  v_surge_enabled BOOLEAN := FALSE;
  v_base_fee NUMERIC(10, 2) := 0;
  v_free_threshold NUMERIC(10, 2) := 0;
  v_global_max_surcharge NUMERIC(10, 2) := 25;
  v_slot_time TIME;
  v_city TEXT;
  v_demand_count INTEGER := 0;
  v_rule public.delivery_surge_rules%ROWTYPE;
  v_surge_fee NUMERIC(10, 2) := 0;
  v_total_fee NUMERIC(10, 2) := 0;
BEGIN
  IF p_user_id IS NULL OR p_scheduled_date IS NULL
    OR NULLIF(TRIM(p_delivery_time_slot), '') IS NULL
    OR p_delivery_address_id IS NULL THEN
    RETURN jsonb_build_object(
      'base_fee', 0, 'surge_fee', 0, 'total_fee', 0,
      'demand_count', 0, 'message', 'Delivery details are incomplete.'
    );
  END IF;

  IF p_delivery_type NOT IN ('standard', 'express') THEN
    RAISE EXCEPTION 'DELIVERY_TYPE_INVALID';
  END IF;

  BEGIN
    v_slot_time := to_timestamp(UPPER(TRIM(p_delivery_time_slot)), 'HH12:MI AM')::TIME;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'DELIVERY_TIME_SLOT_INVALID';
  END;

  SELECT ua.city
    INTO v_city
  FROM public.user_addresses ua
  WHERE ua.id = p_delivery_address_id
    AND ua.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_ADDRESS_NOT_FOUND';
  END IF;

  SELECT ps.value
    INTO v_settings
  FROM public.platform_settings ps
  WHERE ps.key = 'delivery_fees';

  v_settings := COALESCE(v_settings, '{}'::JSONB);
  v_enabled := COALESCE((v_settings ->> 'enabled')::BOOLEAN, FALSE);
  v_surge_enabled := COALESCE((v_settings ->> 'surge_enabled')::BOOLEAN, FALSE);
  v_free_threshold := GREATEST(COALESCE((v_settings ->> 'free_threshold')::NUMERIC, 0), 0);
  v_global_max_surcharge := GREATEST(COALESCE((v_settings ->> 'max_surcharge')::NUMERIC, 25), 0);

  IF v_enabled THEN
    v_base_fee := CASE p_delivery_type
      WHEN 'express' THEN GREATEST(COALESCE((v_settings ->> 'express')::NUMERIC, 0), 0)
      ELSE GREATEST(COALESCE((v_settings ->> 'standard')::NUMERIC, 0), 0)
    END;
  END IF;

  IF v_free_threshold > 0 AND COALESCE(p_order_total, 0) >= v_free_threshold THEN
    v_base_fee := 0;
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_demand_count
  FROM public.meal_schedules ms
  JOIN public.user_addresses ua ON ua.id = ms.delivery_address_id
  WHERE ms.scheduled_date = p_scheduled_date
    AND ms.delivery_time_slot = p_delivery_time_slot
    AND LOWER(COALESCE(ua.city, '')) = LOWER(COALESCE(v_city, ''))
    AND COALESCE(ms.order_status, 'pending') NOT IN ('cancelled', 'rejected');

  IF v_enabled AND v_surge_enabled AND v_base_fee > 0 THEN
    SELECT rule.*
      INTO v_rule
    FROM public.delivery_surge_rules rule
    WHERE rule.enabled = TRUE
      AND (rule.effective_from IS NULL OR rule.effective_from <= now())
      AND (rule.effective_until IS NULL OR rule.effective_until > now())
      AND (
        cardinality(rule.days_of_week) = 0
        OR EXTRACT(DOW FROM p_scheduled_date)::SMALLINT = ANY(rule.days_of_week)
      )
      AND (
        rule.start_time IS NULL OR rule.end_time IS NULL
        OR CASE
          WHEN rule.start_time <= rule.end_time
            THEN v_slot_time BETWEEN rule.start_time AND rule.end_time
          ELSE v_slot_time >= rule.start_time OR v_slot_time <= rule.end_time
        END
      )
      AND (
        cardinality(rule.cities) = 0
        OR EXISTS (
          SELECT 1 FROM unnest(rule.cities) city_name
          WHERE LOWER(city_name) = LOWER(v_city)
        )
      )
      AND v_demand_count >= rule.demand_threshold
    ORDER BY rule.priority DESC, rule.demand_threshold DESC, rule.created_at ASC
    LIMIT 1;

    IF FOUND THEN
      v_surge_fee := LEAST(
        GREATEST(ROUND(v_base_fee * (v_rule.multiplier - 1) + v_rule.flat_surcharge, 2), 0),
        v_rule.max_surcharge,
        v_global_max_surcharge
      );
    END IF;
  END IF;

  v_total_fee := ROUND(v_base_fee + v_surge_fee, 2);

  RETURN jsonb_build_object(
    'base_fee', v_base_fee,
    'surge_fee', v_surge_fee,
    'total_fee', v_total_fee,
    'rule_id', v_rule.id,
    'rule_name', v_rule.name,
    'message', CASE
      WHEN v_surge_fee > 0 THEN v_rule.customer_message
      WHEN v_total_fee = 0 THEN 'Free delivery'
      ELSE 'Standard delivery fee'
    END,
    'demand_count', v_demand_count,
    'city', v_city,
    'delivery_type', p_delivery_type,
    'calculated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_delivery_fee_breakdown(UUID, DATE, TEXT, UUID, TEXT, NUMERIC)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.quote_delivery_fee(
  p_scheduled_date DATE,
  p_delivery_time_slot TEXT,
  p_delivery_address_id UUID,
  p_delivery_type TEXT DEFAULT 'standard',
  p_order_total NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_breakdown JSONB;
  v_quote_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_scheduled_date < CURRENT_DATE OR p_scheduled_date > CURRENT_DATE + 90 THEN
    RAISE EXCEPTION 'SCHEDULE_DATE_INVALID';
  END IF;

  v_breakdown := public.calculate_delivery_fee_breakdown(
    v_user_id,
    p_scheduled_date,
    p_delivery_time_slot,
    p_delivery_address_id,
    p_delivery_type,
    p_order_total
  );

  INSERT INTO public.delivery_fee_quotes (
    user_id, scheduled_date, delivery_time_slot, delivery_address_id,
    delivery_type, city, base_fee, surge_fee, total_fee, rule_id,
    rule_name, customer_message, demand_count, pricing_context
  ) VALUES (
    v_user_id,
    p_scheduled_date,
    p_delivery_time_slot,
    p_delivery_address_id,
    p_delivery_type,
    COALESCE(v_breakdown ->> 'city', ''),
    COALESCE((v_breakdown ->> 'base_fee')::NUMERIC, 0),
    COALESCE((v_breakdown ->> 'surge_fee')::NUMERIC, 0),
    COALESCE((v_breakdown ->> 'total_fee')::NUMERIC, 0),
    NULLIF(v_breakdown ->> 'rule_id', '')::UUID,
    NULLIF(v_breakdown ->> 'rule_name', ''),
    NULLIF(v_breakdown ->> 'message', ''),
    COALESCE((v_breakdown ->> 'demand_count')::INTEGER, 0),
    v_breakdown
  )
  RETURNING id INTO v_quote_id;

  RETURN v_breakdown || jsonb_build_object(
    'quote_id', v_quote_id,
    'expires_at', now() + INTERVAL '10 minutes'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.quote_delivery_fee(DATE, TEXT, UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_delivery_fee(DATE, TEXT, UUID, TEXT, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_dynamic_delivery_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote_id UUID;
  v_quote public.delivery_fee_quotes%ROWTYPE;
  v_breakdown JSONB;
  v_is_secondary BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.scheduled_date IS NOT DISTINCT FROM NEW.scheduled_date
    AND OLD.delivery_time_slot IS NOT DISTINCT FROM NEW.delivery_time_slot
    AND OLD.delivery_address_id IS NOT DISTINCT FROM NEW.delivery_address_id
    AND OLD.delivery_type IS NOT DISTINCT FROM NEW.delivery_type
    AND OLD.customization_data IS NOT DISTINCT FROM NEW.customization_data THEN
    RETURN NEW;
  END IF;

  v_quote_id := NULLIF(NEW.customization_data ->> '_delivery_quote_id', '')::UUID;
  NEW.customization_data := COALESCE(NEW.customization_data, '{}'::JSONB) - '_delivery_quote_id';

  IF NEW.delivery_address_id IS NULL OR NULLIF(TRIM(NEW.delivery_time_slot), '') IS NULL THEN
    NEW.delivery_fee := 0;
    NEW.delivery_fee_base := 0;
    NEW.delivery_fee_surge := 0;
    NEW.delivery_fee_rule_id := NULL;
    NEW.delivery_fee_quote_id := NULL;
    NEW.delivery_fee_context := jsonb_build_object('message', 'Delivery details are incomplete.');
    NEW.delivery_fee_calculated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.request_batch_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.meal_schedules existing
      WHERE existing.user_id = NEW.user_id
        AND existing.request_batch_id = NEW.request_batch_id
        AND existing.scheduled_date = NEW.scheduled_date
        AND existing.delivery_time_slot = NEW.delivery_time_slot
        AND existing.delivery_address_id = NEW.delivery_address_id
    ) INTO v_is_secondary;
  END IF;

  IF v_is_secondary THEN
    NEW.delivery_fee := 0;
    NEW.delivery_fee_base := 0;
    NEW.delivery_fee_surge := 0;
    NEW.delivery_fee_rule_id := NULL;
    NEW.delivery_fee_quote_id := v_quote_id;
    NEW.delivery_fee_group_primary := FALSE;
    NEW.delivery_fee_context := jsonb_build_object(
      'message', 'Combined with another delivery in this booking.',
      'request_batch_id', NEW.request_batch_id
    );
    NEW.delivery_fee_calculated_at := now();
    RETURN NEW;
  END IF;

  IF v_quote_id IS NOT NULL THEN
    SELECT * INTO v_quote
    FROM public.delivery_fee_quotes quote
    WHERE quote.id = v_quote_id
      AND quote.user_id = NEW.user_id
      AND quote.scheduled_date = NEW.scheduled_date
      AND quote.delivery_time_slot = NEW.delivery_time_slot
      AND quote.delivery_address_id = NEW.delivery_address_id
      AND quote.expires_at > now()
      AND quote.consumed_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DELIVERY_QUOTE_INVALID_OR_EXPIRED';
    END IF;

    NEW.delivery_fee := v_quote.total_fee;
    NEW.delivery_fee_base := v_quote.base_fee;
    NEW.delivery_fee_surge := v_quote.surge_fee;
    NEW.delivery_fee_rule_id := v_quote.rule_id;
    NEW.delivery_fee_quote_id := v_quote.id;
    NEW.delivery_fee_context := v_quote.pricing_context;
    UPDATE public.delivery_fee_quotes SET consumed_at = now() WHERE id = v_quote.id;
  ELSE
    v_breakdown := public.calculate_delivery_fee_breakdown(
      NEW.user_id,
      NEW.scheduled_date,
      NEW.delivery_time_slot,
      NEW.delivery_address_id,
      CASE WHEN NEW.delivery_type = 'express' THEN 'express' ELSE 'standard' END,
      COALESCE(NEW.addons_total, 0)
    );
    NEW.delivery_fee := COALESCE((v_breakdown ->> 'total_fee')::NUMERIC, 0);
    NEW.delivery_fee_base := COALESCE((v_breakdown ->> 'base_fee')::NUMERIC, 0);
    NEW.delivery_fee_surge := COALESCE((v_breakdown ->> 'surge_fee')::NUMERIC, 0);
    NEW.delivery_fee_rule_id := NULLIF(v_breakdown ->> 'rule_id', '')::UUID;
    NEW.delivery_fee_quote_id := NULL;
    NEW.delivery_fee_context := v_breakdown;
  END IF;

  NEW.delivery_fee_group_primary := TRUE;
  NEW.delivery_fee_calculated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_dynamic_delivery_fee_trigger ON public.meal_schedules;
CREATE TRIGGER apply_dynamic_delivery_fee_trigger
  BEFORE INSERT OR UPDATE OF scheduled_date, delivery_time_slot, delivery_address_id, delivery_type, customization_data
  ON public.meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_dynamic_delivery_fee();

REVOKE ALL ON FUNCTION public.apply_dynamic_delivery_fee() FROM PUBLIC, anon, authenticated;

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'delivery_fees',
  '{"standard": 3.99, "express": 6.99, "free_threshold": 50, "enabled": true, "surge_enabled": false, "max_surcharge": 25}'::JSONB,
  'Delivery base fees, free threshold, and surge pricing safeguards'
)
ON CONFLICT (key) DO UPDATE SET
  value = COALESCE(public.platform_settings.value, '{}'::JSONB)
    || jsonb_build_object(
      'surge_enabled', COALESCE(public.platform_settings.value -> 'surge_enabled', 'false'::JSONB),
      'max_surcharge', COALESCE(public.platform_settings.value -> 'max_surcharge', '25'::JSONB)
    );

INSERT INTO public.delivery_surge_rules (
  name, description, enabled, priority, days_of_week, start_time, end_time,
  demand_threshold, multiplier, flat_surcharge, max_surcharge, customer_message
)
SELECT
  'Evening peak',
  'Optional peak-time rule for the evening delivery window.',
  FALSE,
  100,
  ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[],
  '17:00'::TIME,
  '20:00'::TIME,
  0,
  1.25,
  0,
  15,
  'Peak-time delivery pricing applies to this window.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.delivery_surge_rules WHERE name = 'Evening peak'
);

INSERT INTO public.delivery_surge_rules (
  name, description, enabled, priority, demand_threshold, multiplier,
  flat_surcharge, max_surcharge, customer_message
)
SELECT
  'High demand',
  'Optional platform-wide rule when a delivery window reaches capacity.',
  FALSE,
  200,
  20,
  1.15,
  2,
  20,
  'This delivery window is experiencing higher demand.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.delivery_surge_rules WHERE name = 'High demand'
);

CREATE OR REPLACE FUNCTION public.admin_list_delivery_surge_rules()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(rule) ORDER BY rule.priority DESC, rule.created_at ASC)
    FROM public.delivery_surge_rules rule
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_delivery_surge_rule(p_rule JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID := NULLIF(p_rule ->> 'id', '')::UUID;
  v_rule public.delivery_surge_rules%ROWTYPE;
  v_days SMALLINT[] := ARRAY(
    SELECT value::SMALLINT
    FROM jsonb_array_elements_text(COALESCE(p_rule -> 'days_of_week', '[]'::JSONB)) value
  );
  v_cities TEXT[] := ARRAY(
    SELECT TRIM(value)
    FROM jsonb_array_elements_text(COALESCE(p_rule -> 'cities', '[]'::JSONB)) value
    WHERE NULLIF(TRIM(value), '') IS NOT NULL
  );
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.delivery_surge_rules (
      name, description, enabled, priority, days_of_week, start_time, end_time,
      cities, demand_threshold, multiplier, flat_surcharge, max_surcharge,
      customer_message, effective_from, effective_until, created_by
    ) VALUES (
      TRIM(COALESCE(p_rule ->> 'name', 'New pricing rule')),
      NULLIF(TRIM(p_rule ->> 'description'), ''),
      COALESCE((p_rule ->> 'enabled')::BOOLEAN, FALSE),
      COALESCE((p_rule ->> 'priority')::INTEGER, 100),
      v_days,
      NULLIF(p_rule ->> 'start_time', '')::TIME,
      NULLIF(p_rule ->> 'end_time', '')::TIME,
      v_cities,
      COALESCE((p_rule ->> 'demand_threshold')::INTEGER, 0),
      COALESCE((p_rule ->> 'multiplier')::NUMERIC, 1),
      COALESCE((p_rule ->> 'flat_surcharge')::NUMERIC, 0),
      COALESCE((p_rule ->> 'max_surcharge')::NUMERIC, 25),
      TRIM(COALESCE(p_rule ->> 'customer_message', 'Higher demand applies for this delivery window.')),
      NULLIF(p_rule ->> 'effective_from', '')::TIMESTAMPTZ,
      NULLIF(p_rule ->> 'effective_until', '')::TIMESTAMPTZ,
      auth.uid()
    ) RETURNING * INTO v_rule;
  ELSE
    UPDATE public.delivery_surge_rules SET
      name = TRIM(COALESCE(p_rule ->> 'name', name)),
      description = NULLIF(TRIM(p_rule ->> 'description'), ''),
      enabled = COALESCE((p_rule ->> 'enabled')::BOOLEAN, enabled),
      priority = COALESCE((p_rule ->> 'priority')::INTEGER, priority),
      days_of_week = v_days,
      start_time = NULLIF(p_rule ->> 'start_time', '')::TIME,
      end_time = NULLIF(p_rule ->> 'end_time', '')::TIME,
      cities = v_cities,
      demand_threshold = COALESCE((p_rule ->> 'demand_threshold')::INTEGER, demand_threshold),
      multiplier = COALESCE((p_rule ->> 'multiplier')::NUMERIC, multiplier),
      flat_surcharge = COALESCE((p_rule ->> 'flat_surcharge')::NUMERIC, flat_surcharge),
      max_surcharge = COALESCE((p_rule ->> 'max_surcharge')::NUMERIC, max_surcharge),
      customer_message = TRIM(COALESCE(p_rule ->> 'customer_message', customer_message)),
      effective_from = NULLIF(p_rule ->> 'effective_from', '')::TIMESTAMPTZ,
      effective_until = NULLIF(p_rule ->> 'effective_until', '')::TIMESTAMPTZ,
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_rule;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SURGE_RULE_NOT_FOUND';
    END IF;
  END IF;

  RETURN to_jsonb(v_rule);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_delivery_surge_rule(p_rule_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  DELETE FROM public.delivery_surge_rules WHERE id = p_rule_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_delivery_surge_rules() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_delivery_surge_rule(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_delivery_surge_rule(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_delivery_surge_rules() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_delivery_surge_rule(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_delivery_surge_rule(UUID) TO authenticated;
