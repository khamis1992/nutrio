-- Limit partner banking data to encrypted storage, masked client reads, and
-- narrowly authorized write paths. This migration depends on the Vault-backed
-- crypto repair in 20260716123000_repair_security_crypto_functions.sql.

BEGIN;

ALTER TABLE public.restaurant_details
  ADD COLUMN IF NOT EXISTS bank_account_name_encrypted BYTEA;

-- Finish the legacy migration by encrypting the account holder and any
-- plaintext values that were written between the earlier migrations.
UPDATE public.restaurant_details
SET bank_name_encrypted = COALESCE(
      bank_name_encrypted,
      security.encrypt_sensitive_data(NULLIF(trim(bank_name), ''))
    ),
    bank_account_name_encrypted = COALESCE(
      bank_account_name_encrypted,
      security.encrypt_sensitive_data(NULLIF(trim(bank_account_name), ''))
    ),
    bank_account_number_encrypted = COALESCE(
      bank_account_number_encrypted,
      security.encrypt_sensitive_data(NULLIF(regexp_replace(bank_account_number, '[[:space:]]+', '', 'g'), ''))
    ),
    bank_iban_encrypted = COALESCE(
      bank_iban_encrypted,
      security.encrypt_sensitive_data(NULLIF(upper(regexp_replace(bank_iban, '[[:space:]]+', '', 'g')), ''))
    ),
    bank_swift_encrypted = COALESCE(
      bank_swift_encrypted,
      security.encrypt_sensitive_data(NULLIF(upper(regexp_replace(swift_code, '[[:space:]]+', '', 'g')), ''))
    )
WHERE bank_name IS NOT NULL
   OR bank_account_name IS NOT NULL
   OR bank_account_number IS NOT NULL
   OR bank_iban IS NOT NULL
   OR swift_code IS NOT NULL;

UPDATE public.restaurant_details
SET bank_name = NULL,
    bank_account_name = NULL,
    bank_account_number = NULL,
    bank_iban = NULL,
    swift_code = NULL
WHERE bank_name IS NOT NULL
   OR bank_account_name IS NOT NULL
   OR bank_account_number IS NOT NULL
   OR bank_iban IS NOT NULL
   OR swift_code IS NOT NULL;

ALTER TABLE public.restaurant_details
  DROP CONSTRAINT IF EXISTS restaurant_details_no_plaintext_banking;

ALTER TABLE public.restaurant_details
  ADD CONSTRAINT restaurant_details_no_plaintext_banking
  CHECK (
    bank_name IS NULL
    AND bank_account_name IS NULL
    AND bank_account_number IS NULL
    AND bank_iban IS NULL
    AND swift_code IS NULL
  ) NOT VALID;

ALTER TABLE public.restaurant_details
  VALIDATE CONSTRAINT restaurant_details_no_plaintext_banking;

COMMENT ON COLUMN public.restaurant_details.bank_name IS
  'Reserved legacy column. Plaintext banking data is rejected.';
COMMENT ON COLUMN public.restaurant_details.bank_account_name IS
  'Reserved legacy column. Plaintext banking data is rejected.';
COMMENT ON COLUMN public.restaurant_details.bank_account_number IS
  'Reserved legacy column. Plaintext banking data is rejected.';
COMMENT ON COLUMN public.restaurant_details.bank_iban IS
  'Reserved legacy column. Plaintext banking data is rejected.';
COMMENT ON COLUMN public.restaurant_details.swift_code IS
  'Reserved legacy column. Plaintext banking data is rejected.';
COMMENT ON COLUMN public.restaurant_details.bank_account_name_encrypted IS
  'Vault-key encrypted account-holder name. Never expose directly to clients.';

-- This is the only banking read helper available to authenticated clients. It
-- authorizes the row and returns a masked value rather than plaintext.
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

  IF p_field = 'bank_name' THEN
    RETURN v_value;
  END IF;

  IF p_field = 'account_name' THEN
    IF char_length(v_value) <= 2 THEN
      RETURN repeat('*', char_length(v_value));
    END IF;
    RETURN left(v_value, 1) || '***' || right(v_value, 1);
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

-- Retain the legacy view shape, but make every banking identifier masked. This
-- prevents older clients from regaining plaintext through the old view name.
CREATE OR REPLACE VIEW public.restaurant_details_secure
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  rd.id,
  rd.restaurant_id,
  rd.cuisine_type,
  rd.dietary_tags,
  rd.alternate_phone,
  rd.website_url,
  rd.operating_hours,
  rd.avg_prep_time_minutes,
  rd.max_meals_per_day,
  security.get_restaurant_banking_masked_value(rd.id, 'account_number') AS bank_account_number,
  security.get_restaurant_banking_masked_value(rd.id, 'iban') AS bank_iban,
  security.get_restaurant_banking_masked_value(rd.id, 'swift') AS swift_code,
  security.get_restaurant_banking_masked_value(rd.id, 'bank_name') AS bank_name,
  rd.onboarding_step,
  rd.onboarding_completed,
  rd.terms_accepted,
  rd.terms_accepted_at,
  rd.created_at,
  rd.updated_at
FROM public.restaurant_details rd;

COMMENT ON VIEW public.restaurant_details_secure IS
  'RLS-protected compatibility view. Banking values are masked and must not be used for writes.';

CREATE OR REPLACE VIEW public.restaurant_banking_summaries
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  rd.restaurant_id,
  security.get_restaurant_banking_masked_value(rd.id, 'bank_name') AS bank_name,
  security.get_restaurant_banking_masked_value(rd.id, 'account_name') AS bank_account_name_masked,
  security.get_restaurant_banking_masked_value(rd.id, 'account_number') AS bank_account_number_masked,
  security.get_restaurant_banking_masked_value(rd.id, 'iban') AS bank_iban_masked,
  security.get_restaurant_banking_masked_value(rd.id, 'swift') AS swift_code_masked,
  COALESCE(rd.payout_frequency, 'weekly') AS payout_frequency,
  (
    rd.bank_name_encrypted IS NOT NULL
    AND (
      rd.bank_account_number_encrypted IS NOT NULL
      OR rd.bank_iban_encrypted IS NOT NULL
    )
  ) AS is_configured,
  rd.updated_at
FROM public.restaurant_details rd;

COMMENT ON VIEW public.restaurant_banking_summaries IS
  'Owner/admin banking summary for UI use. Account identifiers are always masked.';

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
      'bank_account_name_masked', NULL,
      'bank_account_number_masked', NULL,
      'bank_iban_masked', NULL,
      'swift_code_masked', NULL,
      'payout_frequency', 'weekly',
      'is_configured', false,
      'updated_at', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'restaurant_id', p_restaurant_id,
    'bank_name', security.get_restaurant_banking_masked_value(v_details.id, 'bank_name'),
    'bank_account_name_masked', security.get_restaurant_banking_masked_value(v_details.id, 'account_name'),
    'bank_account_number_masked', security.get_restaurant_banking_masked_value(v_details.id, 'account_number'),
    'bank_iban_masked', security.get_restaurant_banking_masked_value(v_details.id, 'iban'),
    'swift_code_masked', security.get_restaurant_banking_masked_value(v_details.id, 'swift'),
    'payout_frequency', COALESCE(v_details.payout_frequency, 'weekly'),
    'is_configured', (
      v_details.bank_name_encrypted IS NOT NULL
      AND (
        v_details.bank_account_number_encrypted IS NOT NULL
        OR v_details.bank_iban_encrypted IS NOT NULL
      )
    ),
    'updated_at', v_details.updated_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_restaurant_banking_info(
  p_restaurant_id UUID,
  p_bank_name TEXT,
  p_bank_account_name TEXT,
  p_bank_account_number TEXT,
  p_bank_iban TEXT,
  p_swift_code TEXT,
  p_payout_frequency TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, security, extensions, pg_temp
AS $function$
DECLARE
  v_details_id UUID;
  v_bank_name_encrypted BYTEA;
  v_account_name_encrypted BYTEA;
  v_account_number_encrypted BYTEA;
  v_iban_encrypted BYTEA;
  v_swift_encrypted BYTEA;
  v_existing_frequency TEXT;
  v_bank_name TEXT := NULLIF(trim(p_bank_name), '');
  v_account_name TEXT := NULLIF(trim(p_bank_account_name), '');
  v_account_number TEXT := NULLIF(regexp_replace(p_bank_account_number, '[[:space:]]+', '', 'g'), '');
  v_iban TEXT := NULLIF(upper(regexp_replace(p_bank_iban, '[[:space:]]+', '', 'g')), '');
  v_swift TEXT := NULLIF(upper(regexp_replace(p_swift_code, '[[:space:]]+', '', 'g')), '');
  v_frequency TEXT := NULLIF(lower(trim(p_payout_frequency)), '');
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
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

  SELECT
    rd.id,
    rd.bank_name_encrypted,
    rd.bank_account_name_encrypted,
    rd.bank_account_number_encrypted,
    rd.bank_iban_encrypted,
    rd.bank_swift_encrypted,
    rd.payout_frequency
  INTO
    v_details_id,
    v_bank_name_encrypted,
    v_account_name_encrypted,
    v_account_number_encrypted,
    v_iban_encrypted,
    v_swift_encrypted,
    v_existing_frequency
  FROM public.restaurant_details rd
  WHERE rd.restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant details not found';
  END IF;

  IF v_bank_name IS NOT NULL THEN
    IF char_length(v_bank_name) NOT BETWEEN 2 AND 120 THEN
      RAISE EXCEPTION 'Invalid bank name';
    END IF;
    v_bank_name_encrypted := security.encrypt_sensitive_data(v_bank_name);
  END IF;

  IF v_account_name IS NOT NULL THEN
    IF char_length(v_account_name) NOT BETWEEN 2 AND 160 THEN
      RAISE EXCEPTION 'Invalid account holder';
    END IF;
    v_account_name_encrypted := security.encrypt_sensitive_data(v_account_name);
  END IF;

  IF v_account_number IS NOT NULL THEN
    IF char_length(v_account_number) NOT BETWEEN 4 AND 80 THEN
      RAISE EXCEPTION 'Invalid account number';
    END IF;
    v_account_number_encrypted := security.encrypt_sensitive_data(v_account_number);
  END IF;

  IF v_iban IS NOT NULL THEN
    IF v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' THEN
      RAISE EXCEPTION 'Invalid IBAN';
    END IF;
    v_iban_encrypted := security.encrypt_sensitive_data(v_iban);
  END IF;

  IF v_swift IS NOT NULL THEN
    IF v_swift !~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$' THEN
      RAISE EXCEPTION 'Invalid SWIFT code';
    END IF;
    v_swift_encrypted := security.encrypt_sensitive_data(v_swift);
  END IF;

  v_frequency := COALESCE(v_frequency, v_existing_frequency, 'weekly');
  IF v_frequency NOT IN ('weekly', 'biweekly', 'monthly') THEN
    RAISE EXCEPTION 'Invalid payout frequency';
  END IF;

  IF v_bank_name_encrypted IS NULL
     OR v_account_name_encrypted IS NULL
     OR v_account_number_encrypted IS NULL THEN
    RAISE EXCEPTION 'Bank name, account holder, and account number are required';
  END IF;

  UPDATE public.restaurant_details
  SET bank_name_encrypted = v_bank_name_encrypted,
      bank_account_name_encrypted = v_account_name_encrypted,
      bank_account_number_encrypted = v_account_number_encrypted,
      bank_iban_encrypted = v_iban_encrypted,
      bank_swift_encrypted = v_swift_encrypted,
      bank_name = NULL,
      bank_account_name = NULL,
      bank_account_number = NULL,
      bank_iban = NULL,
      swift_code = NULL,
      payout_frequency = v_frequency,
      updated_at = clock_timestamp()
  WHERE id = v_details_id;
END;
$function$;

-- Preserve the deployed five-argument RPC for older clients. Missing fields
-- are retained from encrypted storage rather than read back into the client.
CREATE OR REPLACE FUNCTION public.update_restaurant_banking_info(
  p_restaurant_id UUID,
  p_bank_name TEXT,
  p_bank_account_number TEXT,
  p_bank_iban TEXT,
  p_swift_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, security, extensions, pg_temp
AS $function$
BEGIN
  PERFORM public.set_restaurant_banking_info(
    p_restaurant_id,
    p_bank_name,
    NULL,
    p_bank_account_number,
    p_bank_iban,
    p_swift_code,
    NULL
  );
END;
$function$;

-- Remove full identifiers from historical snapshots while retaining enough
-- reconciliation context for the payout UI and audit trail.
WITH sensitive AS (
  SELECT
    pp.id,
    COALESCE(pp.payout_details, '{}'::jsonb) AS details,
    NULLIF(trim(COALESCE(pp.payout_details ->> 'bank_name', pp.payout_details ->> 'bankName')), '') AS bank_name,
    NULLIF(trim(COALESCE(pp.payout_details ->> 'bank_account_name', pp.payout_details ->> 'accountName')), '') AS account_name,
    NULLIF(regexp_replace(COALESCE(pp.payout_details ->> 'bank_account_number', pp.payout_details ->> 'accountNumber'), '[^[:alnum:]]', '', 'g'), '') AS account_number,
    NULLIF(regexp_replace(COALESCE(pp.payout_details ->> 'bank_iban', pp.payout_details ->> 'iban'), '[^[:alnum:]]', '', 'g'), '') AS iban,
    NULLIF(upper(regexp_replace(COALESCE(pp.payout_details ->> 'swift_code', pp.payout_details ->> 'swiftCode'), '[^[:alnum:]]', '', 'g')), '') AS swift
  FROM public.partner_payouts pp
  WHERE pp.payout_details ?| ARRAY[
    'bank_name',
    'bankName',
    'bank_account_name',
    'accountName',
    'bank_account_number',
    'accountNumber',
    'bank_iban',
    'iban',
    'swift_code',
    'swiftCode'
  ]
)
UPDATE public.partner_payouts pp
SET payout_details =
  (
    sensitive.details - ARRAY[
      'bank_name',
      'bankName',
      'bank_account_name',
      'accountName',
      'bank_account_number',
      'accountNumber',
      'bank_iban',
      'iban',
      'swift_code',
      'swiftCode'
    ]
  )
  || jsonb_strip_nulls(
    jsonb_build_object(
      'bank_name', sensitive.bank_name,
      'bank_account_name_masked', CASE
        WHEN sensitive.account_name IS NULL THEN NULL
        WHEN char_length(sensitive.account_name) <= 2 THEN repeat('*', char_length(sensitive.account_name))
        ELSE left(sensitive.account_name, 1) || '***' || right(sensitive.account_name, 1)
      END,
      'bank_account_number_masked', CASE
        WHEN sensitive.account_number IS NULL THEN NULL
        ELSE '****' || right(sensitive.account_number, 4)
      END,
      'bank_iban_masked', CASE
        WHEN sensitive.iban IS NULL THEN NULL
        ELSE '****' || right(sensitive.iban, 4)
      END,
      'swift_code_masked', CASE
        WHEN sensitive.swift IS NULL THEN NULL
        WHEN char_length(sensitive.swift) <= 4 THEN repeat('*', char_length(sensitive.swift))
        ELSE left(sensitive.swift, 4)
          || '****'
          || CASE WHEN char_length(sensitive.swift) > 6 THEN right(sensitive.swift, 2) ELSE '' END
      END
    )
  )
FROM sensitive
WHERE pp.id = sensitive.id;

ALTER TABLE public.partner_payouts
  DROP CONSTRAINT IF EXISTS partner_payouts_no_plaintext_bank_snapshot;

ALTER TABLE public.partner_payouts
  ADD CONSTRAINT partner_payouts_no_plaintext_bank_snapshot
  CHECK (
    payout_details IS NULL
    OR NOT (
      payout_details ?| ARRAY[
        'bank_account_name',
        'accountName',
        'bank_account_number',
        'accountNumber',
        'bank_iban',
        'iban',
        'swift_code',
        'swiftCode'
      ]
    )
  ) NOT VALID;

ALTER TABLE public.partner_payouts
  VALIDATE CONSTRAINT partner_payouts_no_plaintext_bank_snapshot;

COMMENT ON COLUMN public.partner_payouts.payout_details IS
  'Masked bank snapshot only. Plaintext account identifiers are rejected by constraint.';

-- Repair the canonical request path so it reads encrypted availability and
-- stores only a masked snapshot after plaintext restaurant columns are nulled.
CREATE OR REPLACE FUNCTION public.request_partner_payout(
  p_restaurant_id UUID,
  p_request_key UUID,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL,
  p_request_source TEXT DEFAULT 'partner'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, security, pg_temp
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_existing public.partner_payouts%ROWTYPE;
  v_amount NUMERIC(10, 2);
  v_start DATE;
  v_end DATE;
  v_threshold NUMERIC := 50;
  v_details_id UUID;
  v_bank_ready BOOLEAN;
  v_bank JSONB;
  v_payout_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);

  IF NOT v_is_admin AND NOT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = p_restaurant_id
      AND r.owner_id = v_actor
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_request_key IS NULL
    OR p_request_source NOT IN ('partner', 'admin')
    OR (NOT v_is_admin AND p_request_source <> 'partner')
    OR (p_period_start IS NOT NULL AND p_period_end IS NOT NULL AND p_period_start > p_period_end) THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_REQUEST';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.partner_payouts
  WHERE request_key = p_request_key;

  IF FOUND THEN
    IF v_existing.restaurant_id <> p_restaurant_id THEN
      RAISE EXCEPTION 'REQUEST_KEY_CONFLICT';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'payout_id', v_existing.id,
      'status', v_existing.status,
      'amount', v_existing.amount
    );
  END IF;

  PERFORM 1
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESTAURANT_NOT_FOUND';
  END IF;

  PERFORM 1
  FROM public.partner_earnings pe
  WHERE pe.restaurant_id = p_restaurant_id
    AND pe.status = 'pending'
    AND pe.payout_id IS NULL
    AND (p_period_start IS NULL OR pe.created_at::DATE >= p_period_start)
    AND (p_period_end IS NULL OR pe.created_at::DATE <= p_period_end)
  FOR UPDATE;

  SELECT
    COALESCE(SUM(pe.net_amount), 0),
    COALESCE(MIN(pe.created_at)::DATE, COALESCE(p_period_start, CURRENT_DATE)),
    COALESCE(MAX(pe.created_at)::DATE, COALESCE(p_period_end, CURRENT_DATE))
  INTO v_amount, v_start, v_end
  FROM public.partner_earnings pe
  WHERE pe.restaurant_id = p_restaurant_id
    AND pe.status = 'pending'
    AND pe.payout_id IS NULL
    AND (p_period_start IS NULL OR pe.created_at::DATE >= p_period_start)
    AND (p_period_end IS NULL OR pe.created_at::DATE <= p_period_end);

  SELECT COALESCE((ps.value ->> 'minimum_partner_payout')::NUMERIC, 50)
  INTO v_threshold
  FROM public.platform_settings ps
  WHERE ps.key = 'partner_settings'
  ORDER BY ps.updated_at DESC
  LIMIT 1;

  v_threshold := COALESCE(v_threshold, 50);

  IF v_amount <= 0 OR (NOT v_is_admin AND v_amount < v_threshold) THEN
    RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_PARTNER_BALANCE';
  END IF;

  SELECT
    rd.id,
    (
      rd.bank_name_encrypted IS NOT NULL
      AND (
        rd.bank_account_number_encrypted IS NOT NULL
        OR rd.bank_iban_encrypted IS NOT NULL
      )
    )
  INTO v_details_id, v_bank_ready
  FROM public.restaurant_details rd
  WHERE rd.restaurant_id = p_restaurant_id;

  IF v_details_id IS NULL OR NOT COALESCE(v_bank_ready, false) THEN
    RAISE EXCEPTION 'BANK_DETAILS_REQUIRED';
  END IF;

  v_bank := jsonb_strip_nulls(
    jsonb_build_object(
      'bank_name', security.get_restaurant_banking_masked_value(v_details_id, 'bank_name'),
      'bank_account_name_masked', security.get_restaurant_banking_masked_value(v_details_id, 'account_name'),
      'bank_account_number_masked', security.get_restaurant_banking_masked_value(v_details_id, 'account_number'),
      'bank_iban_masked', security.get_restaurant_banking_masked_value(v_details_id, 'iban'),
      'swift_code_masked', security.get_restaurant_banking_masked_value(v_details_id, 'swift')
    )
  );

  INSERT INTO public.partner_payouts (
    restaurant_id,
    amount,
    period_start,
    period_end,
    status,
    payout_method,
    payout_details,
    request_key,
    request_source,
    requested_by
  )
  VALUES (
    p_restaurant_id,
    v_amount,
    COALESCE(p_period_start, v_start),
    COALESCE(p_period_end, v_end),
    'pending',
    'bank_transfer',
    v_bank,
    p_request_key,
    p_request_source,
    v_actor
  )
  RETURNING id INTO v_payout_id;

  UPDATE public.partner_earnings pe
  SET payout_id = v_payout_id,
      status = 'processing'
  WHERE pe.restaurant_id = p_restaurant_id
    AND pe.status = 'pending'
    AND pe.payout_id IS NULL
    AND (p_period_start IS NULL OR pe.created_at::DATE >= p_period_start)
    AND (p_period_end IS NULL OR pe.created_at::DATE <= p_period_end);

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'payout_id', v_payout_id,
    'status', 'pending',
    'amount', v_amount
  );
END;
$function$;

-- Replace broad legacy policies with operation-specific policies.
ALTER TABLE public.restaurant_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_details FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view and manage their restaurant details" ON public.restaurant_details;
DROP POLICY IF EXISTS "Admins can view all restaurant details" ON public.restaurant_details;
DROP POLICY IF EXISTS restaurant_details_owner_select ON public.restaurant_details;
DROP POLICY IF EXISTS restaurant_details_admin_select ON public.restaurant_details;
DROP POLICY IF EXISTS restaurant_details_owner_insert ON public.restaurant_details;
DROP POLICY IF EXISTS restaurant_details_owner_update ON public.restaurant_details;

CREATE POLICY restaurant_details_owner_select
  ON public.restaurant_details
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = restaurant_details.restaurant_id
        AND r.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY restaurant_details_admin_select
  ON public.restaurant_details
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY restaurant_details_owner_insert
  ON public.restaurant_details
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = restaurant_details.restaurant_id
        AND r.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY restaurant_details_owner_update
  ON public.restaurant_details
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = restaurant_details.restaurant_id
        AND r.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = restaurant_details.restaurant_id
        AND r.owner_id = (SELECT auth.uid())
    )
  );

ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payouts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partner operators and admins can view payouts" ON public.partner_payouts;
DROP POLICY IF EXISTS partner_payouts_read_authorized ON public.partner_payouts;

CREATE POLICY partner_payouts_read_authorized
  ON public.partner_payouts
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.is_restaurant_operator(restaurant_id, (SELECT auth.uid()))
  );

-- Keep direct profile reads compatible, but remove all client write access to
-- banking columns. The null-only constraint is a second line of defense.
REVOKE ALL ON TABLE public.restaurant_details FROM PUBLIC, anon, authenticated, service_role;
-- Do not expose encrypted payloads to browsers. Even ciphertext is sensitive
-- metadata and must stay behind the narrowly scoped SECURITY DEFINER helpers.
GRANT SELECT (
  id,
  restaurant_id,
  cuisine_type,
  dietary_tags,
  alternate_phone,
  website_url,
  operating_hours,
  avg_prep_time_minutes,
  max_meals_per_day,
  payout_frequency,
  onboarding_step,
  onboarding_completed,
  terms_accepted,
  terms_accepted_at,
  created_at,
  updated_at
) ON public.restaurant_details TO authenticated;
GRANT INSERT (
  restaurant_id,
  cuisine_type,
  dietary_tags,
  alternate_phone,
  website_url,
  operating_hours,
  avg_prep_time_minutes,
  max_meals_per_day,
  onboarding_step,
  onboarding_completed,
  terms_accepted,
  terms_accepted_at
) ON public.restaurant_details TO authenticated;
GRANT UPDATE (
  cuisine_type,
  dietary_tags,
  alternate_phone,
  website_url,
  operating_hours,
  avg_prep_time_minutes,
  max_meals_per_day,
  onboarding_step,
  onboarding_completed,
  terms_accepted,
  terms_accepted_at
) ON public.restaurant_details TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.restaurant_details TO service_role;

REVOKE ALL ON TABLE public.partner_payouts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.partner_payouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partner_payouts TO service_role;

REVOKE ALL ON public.restaurant_details_secure FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.restaurant_banking_summaries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.restaurant_details_secure TO authenticated, service_role;
GRANT SELECT ON public.restaurant_banking_summaries TO authenticated, service_role;

REVOKE USAGE ON SCHEMA security FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA security TO authenticated, service_role;

REVOKE ALL ON FUNCTION security.get_restaurant_banking_value(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION security.get_restaurant_banking_value(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION security.get_restaurant_banking_masked_value(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION security.get_restaurant_banking_masked_value(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_restaurant_banking_summary(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_restaurant_banking_info(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_restaurant_banking_info(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_partner_payout(UUID, UUID, DATE, DATE, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_restaurant_banking_summary(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_restaurant_banking_info(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_restaurant_banking_info(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_partner_payout(UUID, UUID, DATE, DATE, TEXT) TO authenticated, service_role;

COMMIT;
