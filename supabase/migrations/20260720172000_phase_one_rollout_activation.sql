BEGIN;

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'phase1-health-context',
  '{"enabled": true, "rollout_percent": 100}'::JSONB,
  'Optional private health journal and manually logged cycle context'
)
ON CONFLICT (key) DO UPDATE
SET
  value = jsonb_set(
    jsonb_set(
      COALESCE(public.platform_settings.value, '{}'::JSONB),
      '{enabled}',
      'true'::JSONB,
      true
    ),
    '{rollout_percent}',
    '100'::JSONB,
    true
  );

COMMIT;
