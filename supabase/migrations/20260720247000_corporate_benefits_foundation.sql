-- Privacy-isolated corporate eligibility, sponsor billing, and aggregate reporting.

BEGIN;

CREATE TABLE IF NOT EXISTS public.corporate_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 160),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'suspended', 'closed')),
  billing_model TEXT NOT NULL DEFAULT 'per_redeemed_meal' CHECK (billing_model IN ('per_redeemed_meal', 'fixed_allowance')),
  default_monthly_meal_allowance INTEGER NOT NULL DEFAULT 0 CHECK (default_monthly_meal_allowance BETWEEN 0 AND 200),
  sponsor_rate_per_meal NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (sponsor_rate_per_meal >= 0),
  contract_reference TEXT,
  starts_on DATE,
  ends_on DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS public.corporate_organization_admins (
  organization_id UUID NOT NULL REFERENCES public.corporate_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'sponsor_admin' CHECK (role IN ('sponsor_admin', 'billing_viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.corporate_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.corporate_organizations(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  eligibility_reference_hash TEXT,
  status TEXT NOT NULL DEFAULT 'eligible' CHECK (status IN ('eligible', 'active', 'paused', 'ended')),
  eligible_from DATE NOT NULL DEFAULT CURRENT_DATE,
  eligible_until DATE,
  monthly_meal_allowance INTEGER NOT NULL CHECK (monthly_meal_allowance BETWEEN 0 AND 200),
  allowance_used INTEGER NOT NULL DEFAULT 0 CHECK (allowance_used >= 0),
  allowance_period_start DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  sponsor_aggregate_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_version TEXT,
  consented_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id),
  CHECK (eligible_until IS NULL OR eligible_until >= eligible_from),
  CHECK (allowance_used <= monthly_meal_allowance)
);

CREATE TABLE IF NOT EXISTS public.corporate_benefit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.corporate_organizations(id) ON DELETE RESTRICT,
  membership_id UUID NOT NULL REFERENCES public.corporate_memberships(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  schedule_id UUID NOT NULL REFERENCES public.meal_schedules(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('redeemed', 'reversed')),
  sponsor_amount NUMERIC(10,2) NOT NULL CHECK (sponsor_amount >= 0),
  allowance_period_start DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  source_event_id UUID REFERENCES public.corporate_benefit_events(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, event_type),
  CHECK ((event_type = 'redeemed' AND source_event_id IS NULL) OR (event_type = 'reversed' AND source_event_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.corporate_sponsor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.corporate_organizations(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  redeemed_meals INTEGER NOT NULL DEFAULT 0,
  reversed_meals INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  UNIQUE (organization_id, period_start, period_end),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS corporate_memberships_user_status_idx ON public.corporate_memberships (user_id, status);
CREATE INDEX IF NOT EXISTS corporate_benefit_events_org_created_idx ON public.corporate_benefit_events (organization_id, created_at DESC);

ALTER TABLE public.corporate_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_organization_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_benefit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_sponsor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_organization_admins FORCE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_benefit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_sponsor_invoices FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.corporate_organizations, public.corporate_organization_admins,
  public.corporate_memberships, public.corporate_benefit_events,
  public.corporate_sponsor_invoices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.corporate_organizations, public.corporate_organization_admins,
  public.corporate_memberships, public.corporate_benefit_events,
  public.corporate_sponsor_invoices TO service_role;

CREATE OR REPLACE FUNCTION public.admin_upsert_corporate_organization(
  p_organization_id UUID,
  p_name TEXT,
  p_status TEXT,
  p_billing_model TEXT,
  p_default_monthly_meal_allowance INTEGER,
  p_sponsor_rate_per_meal NUMERIC,
  p_contract_reference TEXT DEFAULT NULL,
  p_starts_on DATE DEFAULT NULL,
  p_ends_on DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_admin UUID := auth.uid(); v_id UUID;
BEGIN
  IF v_admin IS NULL
    OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    OR NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED';
  END IF;
  IF p_organization_id IS NULL THEN
    INSERT INTO public.corporate_organizations (
      name, status, billing_model, default_monthly_meal_allowance,
      sponsor_rate_per_meal, contract_reference, starts_on, ends_on, created_by
    ) VALUES (
      btrim(p_name), p_status, p_billing_model, p_default_monthly_meal_allowance,
      p_sponsor_rate_per_meal, NULLIF(btrim(p_contract_reference), ''), p_starts_on, p_ends_on, v_admin
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.corporate_organizations SET
      name = btrim(p_name), status = p_status, billing_model = p_billing_model,
      default_monthly_meal_allowance = p_default_monthly_meal_allowance,
      sponsor_rate_per_meal = p_sponsor_rate_per_meal,
      contract_reference = NULLIF(btrim(p_contract_reference), ''), starts_on = p_starts_on,
      ends_on = p_ends_on, updated_at = now()
    WHERE id = p_organization_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_corporate_membership(
  p_organization_id UUID,
  p_user_id UUID,
  p_status TEXT,
  p_eligible_from DATE,
  p_eligible_until DATE,
  p_monthly_meal_allowance INTEGER,
  p_eligibility_reference_hash TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_admin UUID := auth.uid(); v_id UUID;
BEGIN
  IF v_admin IS NULL
    OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    OR NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.corporate_organizations WHERE id = p_organization_id AND status <> 'closed') THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND'; END IF;
  INSERT INTO public.corporate_memberships (
    organization_id, user_id, status, eligible_from, eligible_until,
    monthly_meal_allowance, eligibility_reference_hash
  ) VALUES (
    p_organization_id, p_user_id, p_status, p_eligible_from, p_eligible_until,
    p_monthly_meal_allowance, NULLIF(p_eligibility_reference_hash, '')
  ) ON CONFLICT (organization_id, user_id) DO UPDATE SET
    status = EXCLUDED.status, eligible_from = EXCLUDED.eligible_from,
    eligible_until = EXCLUDED.eligible_until,
    monthly_meal_allowance = EXCLUDED.monthly_meal_allowance,
    eligibility_reference_hash = EXCLUDED.eligibility_reference_hash, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_corporate_benefit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid(); v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT to_jsonb(row_data) INTO v_result FROM (
    SELECT m.id AS membership_id, o.id AS organization_id, o.name AS organization_name,
      m.status, m.eligible_from, m.eligible_until, m.monthly_meal_allowance,
      m.allowance_used, greatest(m.monthly_meal_allowance - m.allowance_used, 0) AS remaining_allowance,
      m.allowance_period_start, m.sponsor_aggregate_consent
    FROM public.corporate_memberships m
    JOIN public.corporate_organizations o ON o.id = m.organization_id
    WHERE m.user_id = v_user_id AND m.status IN ('eligible', 'active') AND o.status = 'active'
      AND CURRENT_DATE >= m.eligible_from AND (m.eligible_until IS NULL OR CURRENT_DATE <= m.eligible_until)
    ORDER BY m.created_at DESC LIMIT 1
  ) row_data;
  RETURN COALESCE(v_result, jsonb_build_object('eligible', FALSE));
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_my_corporate_benefit(
  p_membership_id UUID,
  p_sponsor_aggregate_consent BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  UPDATE public.corporate_memberships SET
    status = 'active', sponsor_aggregate_consent = p_sponsor_aggregate_consent,
    consent_version = 'corporate-benefit-v1', consented_at = now(), updated_at = now()
  WHERE id = p_membership_id AND user_id = v_user_id AND status = 'eligible'
    AND CURRENT_DATE >= eligible_from AND (eligible_until IS NULL OR CURRENT_DATE <= eligible_until);
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_my_corporate_meal(
  p_membership_id UUID,
  p_schedule_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid(); v_membership public.corporate_memberships%ROWTYPE;
  v_schedule public.meal_schedules%ROWTYPE; v_org public.corporate_organizations%ROWTYPE; v_event_id UUID; v_amount NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT * INTO v_membership FROM public.corporate_memberships
  WHERE id = p_membership_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND OR v_membership.status <> 'active' OR v_membership.consented_at IS NULL THEN RAISE EXCEPTION 'ACTIVE_CORPORATE_BENEFIT_REQUIRED'; END IF;
  IF v_membership.allowance_period_start < date_trunc('month', CURRENT_DATE)::DATE THEN
    UPDATE public.corporate_memberships SET allowance_period_start = date_trunc('month', CURRENT_DATE)::DATE, allowance_used = 0
    WHERE id = v_membership.id RETURNING * INTO v_membership;
  END IF;
  IF v_membership.allowance_used >= v_membership.monthly_meal_allowance THEN RAISE EXCEPTION 'CORPORATE_ALLOWANCE_EXHAUSTED'; END IF;
  SELECT * INTO v_schedule FROM public.meal_schedules WHERE id = p_schedule_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_schedule.order_status, 'pending') IN ('cancelled', 'rejected') THEN RAISE EXCEPTION 'ELIGIBLE_SCHEDULE_REQUIRED'; END IF;
  SELECT * INTO v_org FROM public.corporate_organizations WHERE id = v_membership.organization_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_ORGANIZATION_REQUIRED'; END IF;
  v_amount := CASE WHEN v_org.billing_model = 'fixed_allowance' THEN 0 ELSE least(COALESCE(v_schedule.meal_price_snapshot, v_org.sponsor_rate_per_meal), v_org.sponsor_rate_per_meal) END;
  INSERT INTO public.corporate_benefit_events (
    organization_id, membership_id, user_id, schedule_id, event_type,
    sponsor_amount, allowance_period_start
  ) VALUES (
    v_org.id, v_membership.id, v_user_id, v_schedule.id, 'redeemed',
    greatest(v_amount, 0), v_membership.allowance_period_start
  )
  ON CONFLICT (schedule_id, event_type) DO NOTHING
  RETURNING id INTO v_event_id;
  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id FROM public.corporate_benefit_events
    WHERE schedule_id = v_schedule.id AND event_type = 'redeemed';
    IF EXISTS (
      SELECT 1 FROM public.corporate_benefit_events
      WHERE id = v_event_id AND membership_id <> v_membership.id
    ) THEN RAISE EXCEPTION 'CORPORATE_REDEMPTION_MEMBERSHIP_MISMATCH'; END IF;
    RETURN v_event_id;
  END IF;
  UPDATE public.corporate_memberships SET allowance_used = allowance_used + 1, updated_at = now()
  WHERE id = v_membership.id;
  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_corporate_meals_atomic(
  p_subscription_id UUID,
  p_items JSONB,
  p_request_batch_id UUID,
  p_membership_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_membership public.corporate_memberships%ROWTYPE;
  v_result JSONB;
  v_schedule_id UUID;
  v_requested_count INTEGER;
  v_event_ids UUID[] := '{}'::UUID[];
  v_existing_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'SCHEDULE_ITEMS_INVALID'; END IF;
  v_requested_count := jsonb_array_length(p_items);
  IF v_requested_count < 1 OR v_requested_count > 14 THEN RAISE EXCEPTION 'SCHEDULE_ITEM_COUNT_INVALID'; END IF;

  SELECT * INTO v_membership
  FROM public.corporate_memberships membership
  WHERE membership.id = p_membership_id
    AND membership.user_id = v_user_id
    AND membership.status = 'active'
    AND membership.consented_at IS NOT NULL
    AND CURRENT_DATE >= membership.eligible_from
    AND (membership.eligible_until IS NULL OR CURRENT_DATE <= membership.eligible_until)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_CORPORATE_BENEFIT_REQUIRED'; END IF;

  SELECT count(*) INTO v_existing_count
  FROM public.meal_schedules schedule
  WHERE schedule.user_id = v_user_id
    AND schedule.request_batch_id = p_request_batch_id;
  IF v_existing_count > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.meal_schedules schedule
      LEFT JOIN public.corporate_benefit_events event
        ON event.schedule_id = schedule.id AND event.event_type = 'redeemed'
      WHERE schedule.user_id = v_user_id
        AND schedule.request_batch_id = p_request_batch_id
        AND event.membership_id IS DISTINCT FROM v_membership.id
    ) THEN RAISE EXCEPTION 'SCHEDULE_BENEFICIARY_MISMATCH'; END IF;
    RETURN public.schedule_meals_atomic(p_subscription_id, p_items, p_request_batch_id)
      || jsonb_build_object('corporate_membership_id', v_membership.id, 'already_redeemed', TRUE);
  END IF;

  IF v_membership.allowance_period_start < date_trunc('month', CURRENT_DATE)::DATE THEN
    UPDATE public.corporate_memberships
    SET allowance_period_start = date_trunc('month', CURRENT_DATE)::DATE,
        allowance_used = 0,
        updated_at = now()
    WHERE id = v_membership.id
    RETURNING * INTO v_membership;
  END IF;
  IF v_membership.allowance_used + v_requested_count > v_membership.monthly_meal_allowance THEN
    RAISE EXCEPTION 'CORPORATE_ALLOWANCE_EXHAUSTED';
  END IF;

  v_result := public.schedule_meals_atomic(p_subscription_id, p_items, p_request_batch_id);
  FOR v_schedule_id IN
    SELECT value::UUID FROM jsonb_array_elements_text(v_result -> 'schedule_ids') value
  LOOP
    v_event_ids := array_append(
      v_event_ids,
      public.redeem_my_corporate_meal(v_membership.id, v_schedule_id)
    );
  END LOOP;

  RETURN v_result || jsonb_build_object(
    'corporate_membership_id', v_membership.id,
    'benefit_event_ids', to_jsonb(v_event_ids)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_corporate_sponsor_aggregate(
  p_organization_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor UUID := auth.uid(); v_is_admin BOOLEAN; v_is_sponsor BOOLEAN; v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  v_is_sponsor := EXISTS (
    SELECT 1 FROM public.corporate_organization_admins a
    WHERE a.organization_id = p_organization_id AND a.user_id = v_actor
  );
  IF NOT v_is_admin AND NOT v_is_sponsor THEN RAISE EXCEPTION 'SPONSOR_ACCESS_REQUIRED'; END IF;
  IF COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN RAISE EXCEPTION 'SPONSOR_AAL2_REQUIRED'; END IF;
  SELECT jsonb_build_object(
    'organization_id', p_organization_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'eligible_members', (SELECT count(*) FROM public.corporate_memberships m WHERE m.organization_id = p_organization_id AND m.status IN ('eligible', 'active')),
    'consented_aggregate_members', (SELECT count(*) FROM public.corporate_memberships m WHERE m.organization_id = p_organization_id AND m.sponsor_aggregate_consent),
    'redeemed_meals', count(*) FILTER (WHERE e.event_type = 'redeemed'),
    'consented_redeemed_meals', count(*) FILTER (
      WHERE e.event_type = 'redeemed' AND membership.sponsor_aggregate_consent
    ),
    'reversed_meals', count(*) FILTER (WHERE e.event_type = 'reversed'),
    'sponsor_amount', COALESCE(sum(CASE WHEN e.event_type = 'redeemed' THEN e.sponsor_amount ELSE -e.sponsor_amount END), 0),
    'privacy_notice', 'Aggregate benefit utilization only; no meals, health goals, or individual member rows are exposed.'
  ) INTO v_result
  FROM public.corporate_benefit_events e
  JOIN public.corporate_memberships membership ON membership.id = e.membership_id
  WHERE e.organization_id = p_organization_id AND e.created_at::DATE BETWEEN p_period_start AND p_period_end;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_corporate_sponsor_admin(
  p_organization_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'sponsor_admin'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_admin UUID := auth.uid();
BEGIN
  IF v_admin IS NULL
    OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    OR NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED';
  END IF;
  INSERT INTO public.corporate_organization_admins (organization_id, user_id, role)
  VALUES (p_organization_id, p_user_id, p_role)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_generate_corporate_invoice(
  p_organization_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_admin UUID := auth.uid(); v_invoice_id UUID;
BEGIN
  IF v_admin IS NULL
    OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    OR NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED';
  END IF;
  IF p_period_end < p_period_start OR p_period_end > CURRENT_DATE THEN RAISE EXCEPTION 'INVALID_INVOICE_PERIOD'; END IF;
  INSERT INTO public.corporate_sponsor_invoices (
    organization_id, period_start, period_end, redeemed_meals, reversed_meals, total_amount
  )
  SELECT p_organization_id, p_period_start, p_period_end,
    count(*) FILTER (WHERE event_type = 'redeemed'),
    count(*) FILTER (WHERE event_type = 'reversed'),
    COALESCE(sum(CASE WHEN event_type = 'redeemed' THEN sponsor_amount ELSE -sponsor_amount END), 0)
  FROM public.corporate_benefit_events
  WHERE organization_id = p_organization_id AND created_at::DATE BETWEEN p_period_start AND p_period_end
  ON CONFLICT (organization_id, period_start, period_end) DO UPDATE SET
    redeemed_meals = EXCLUDED.redeemed_meals, reversed_meals = EXCLUDED.reversed_meals,
    total_amount = EXCLUDED.total_amount, generated_at = now()
  WHERE public.corporate_sponsor_invoices.status = 'draft'
  RETURNING id INTO v_invoice_id;
  IF v_invoice_id IS NULL THEN RAISE EXCEPTION 'ISSUED_INVOICE_IS_IMMUTABLE'; END IF;
  RETURN v_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_corporate_organizations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_admin UUID := auth.uid(); v_result JSONB;
BEGIN
  IF v_admin IS NULL
    OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    OR NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at DESC), '[]'::JSONB)
  INTO v_result FROM (
    SELECT o.id, o.name, o.status, o.billing_model, o.default_monthly_meal_allowance,
      o.sponsor_rate_per_meal, o.contract_reference, o.starts_on, o.ends_on, o.created_at,
      count(m.id)::INTEGER AS membership_count,
      count(m.id) FILTER (WHERE m.status = 'active')::INTEGER AS active_members
    FROM public.corporate_organizations o
    LEFT JOIN public.corporate_memberships m ON m.organization_id = o.id
    GROUP BY o.id
  ) row_data;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_corporate_organization(UUID, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_corporate_membership(UUID, UUID, TEXT, DATE, DATE, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_corporate_benefit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_my_corporate_benefit(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_my_corporate_meal(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.schedule_corporate_meals_atomic(UUID, JSONB, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_corporate_sponsor_aggregate(UUID, DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_corporate_sponsor_admin(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_generate_corporate_invoice(UUID, DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_corporate_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_corporate_organization(UUID, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_corporate_membership(UUID, UUID, TEXT, DATE, DATE, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_corporate_benefit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_my_corporate_benefit(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_my_corporate_meal(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_corporate_meals_atomic(UUID, JSONB, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_corporate_sponsor_aggregate(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_corporate_sponsor_admin(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_generate_corporate_invoice(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_corporate_organizations() TO authenticated;

COMMIT;
