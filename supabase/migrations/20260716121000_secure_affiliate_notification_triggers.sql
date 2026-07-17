-- Require a shared secret for database-triggered affiliate email functions.
-- Deployment prerequisite:
--   1. Add AFFILIATE_NOTIFICATION_SECRET as an Edge Function secret.
--   2. Store the same value in Supabase Vault with name
--      affiliate_notification_secret.

BEGIN;

CREATE SCHEMA IF NOT EXISTS security;

CREATE OR REPLACE FUNCTION security.read_vault_secret(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO security, public, vault, pg_temp
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 ORDER BY created_at DESC LIMIT 1'
  INTO v_secret
  USING p_name;

  RETURN NULLIF(v_secret, '');
END;
$function$;

REVOKE ALL ON FUNCTION security.read_vault_secret(TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_affiliate_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, security, net, pg_temp
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_secret := security.read_vault_secret('affiliate_notification_secret');
    IF v_secret IS NULL THEN
      RAISE WARNING 'Affiliate notification skipped: Vault secret is not configured';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-commission-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', v_secret
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'commission_amount', NEW.commission_amount,
        'tier', NEW.tier,
        'order_amount', NEW.order_amount
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_milestone_achievement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, security, net, pg_temp
AS $function$
DECLARE
  v_milestone RECORD;
  v_secret TEXT;
BEGIN
  v_secret := security.read_vault_secret('affiliate_notification_secret');
  IF v_secret IS NULL THEN
    RAISE WARNING 'Affiliate milestone notification skipped: Vault secret is not configured';
    RETURN NEW;
  END IF;

  SELECT name, description, bonus_amount, referral_count
  INTO v_milestone
  FROM public.referral_milestones
  WHERE id = NEW.milestone_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-milestone-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'milestone_name', v_milestone.name,
      'milestone_description', COALESCE(v_milestone.description, ''),
      'bonus_amount', v_milestone.bonus_amount,
      'referral_count', v_milestone.referral_count
    )
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_tier_upgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, security, net, pg_temp
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  IF OLD.affiliate_tier IS NOT DISTINCT FROM NEW.affiliate_tier OR NEW.affiliate_tier IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.affiliate_tier = 'bronze' AND NEW.affiliate_tier IN ('silver', 'gold', 'platinum', 'diamond')) OR
    (OLD.affiliate_tier = 'silver' AND NEW.affiliate_tier IN ('gold', 'platinum', 'diamond')) OR
    (OLD.affiliate_tier = 'gold' AND NEW.affiliate_tier IN ('platinum', 'diamond')) OR
    (OLD.affiliate_tier = 'platinum' AND NEW.affiliate_tier = 'diamond')
  ) THEN
    RETURN NEW;
  END IF;

  v_secret := security.read_vault_secret('affiliate_notification_secret');
  IF v_secret IS NULL THEN
    RAISE WARNING 'Affiliate tier notification skipped: Vault secret is not configured';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-tier-upgrade-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'old_tier', COALESCE(OLD.affiliate_tier, 'bronze'),
      'new_tier', NEW.affiliate_tier
    )
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_affiliate_welcome_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, security, net, pg_temp
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  IF COALESCE(NEW.referral_code, '') = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.referral_code, '') <> '' THEN
    RETURN NEW;
  END IF;

  v_secret := security.read_vault_secret('affiliate_notification_secret');
  IF v_secret IS NULL THEN
    RAISE WARNING 'Affiliate welcome email skipped: Vault secret is not configured';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-affiliate-welcome',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'referral_code', NEW.referral_code
    )
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_affiliate_commission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_milestone_achievement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_tier_upgrade() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_affiliate_welcome_email() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION security.read_vault_secret(TEXT) IS
  'Internal-only Vault lookup used by trusted database triggers. Never expose through PostgREST.';

COMMIT;
