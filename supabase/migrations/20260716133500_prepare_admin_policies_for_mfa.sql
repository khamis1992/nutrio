-- Remove every historical direct admin/staff RLS policy before the MFA-aware
-- has_role implementation is installed by 20260716134000_require_admin_mfa.sql.
--
-- This migration must sort before 20260716134000. A later repair cannot help a
-- clean deployment because that migration deliberately aborts when it finds a
-- policy that reads user_roles directly.

BEGIN;

DO $do$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS subscriptions_admin_manage ON public.subscriptions';
  END IF;
END;
$do$;

-- Unknown direct-role policies are not safe to translate automatically. Drop
-- them fail-closed; the next migration recreates the reviewed policy set using
-- the MFA-aware has_role helper.
DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%user_roles%'
      AND (
        lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%admin%'
        OR lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%staff%'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  END LOOP;
END;
$do$;

-- Final precondition for 20260716134000. Retain its own deployment guard as a
-- second independent check against migration drift.
DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%user_roles%'
      AND (
        lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%admin%'
        OR lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%staff%'
      )
  LOOP
    RAISE EXCEPTION
      'Unsafe direct admin/staff policy remains before MFA: %.% (%)',
      v_policy.schemaname,
      v_policy.tablename,
      v_policy.policyname;
  END LOOP;
END;
$do$;

NOTIFY pgrst, 'reload schema';

COMMIT;
