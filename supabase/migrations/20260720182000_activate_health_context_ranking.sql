-- Activate health context only after the consented input is wired into ranking v2.1.

CREATE OR REPLACE FUNCTION public.health_context_feature_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_value JSONB;
  v_enabled BOOLEAN := false;
  v_rollout_percent INTEGER := 0;
BEGIN
  SELECT settings.value INTO v_value
  FROM public.platform_settings settings
  WHERE settings.key = 'phase1-health-context';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_enabled := coalesce((v_value->>'enabled')::BOOLEAN, false);
  v_rollout_percent := greatest(
    least(coalesce((v_value->>'rollout_percent')::INTEGER, 0), 100),
    0
  );

  IF NOT v_enabled OR v_rollout_percent <= 0 THEN
    RETURN false;
  END IF;

  IF v_rollout_percent >= 100 THEN
    RETURN true;
  END IF;

  IF v_actor IS NULL THEN
    RETURN false;
  END IF;

  RETURN mod(abs(hashtext(v_actor::TEXT)::BIGINT), 100) < v_rollout_percent;
END;
$$;

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'phase1-health-context',
  jsonb_build_object(
    'enabled', true,
    'rollout_percent', 100,
    'ranking_engine_version', 'meal-ranking-v2.1.0',
    'recommendation_consent_required', true,
    'maximum_context_age_days', 3,
    'activated_at', clock_timestamp()
  ),
  'Optional private health journal wired into consented, bounded meal-ranking context'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = clock_timestamp();

REVOKE ALL ON FUNCTION public.health_context_feature_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_context_feature_enabled() TO authenticated, service_role;

COMMENT ON FUNCTION public.health_context_feature_enabled() IS
  'Checks the health-context rollout flag and assigns authenticated users deterministically when rollout is below 100 percent.';
