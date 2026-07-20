-- Phase-one health context remains opt-in and default-off until its flag is deliberately rolled out.
insert into public.platform_settings (key, value, description)
values (
  'phase1-health-context',
  jsonb_build_object(
    'enabled', false,
    'rollout_percent', 0,
    'ranking_engine_version', 'meal-ranking-v2.1.0',
    'recommendation_consent_required', true,
    'maximum_context_age_days', 3,
    'disabled_at', clock_timestamp()
  ),
  'Optional private health journal; default-off pending explicit monitored rollout'
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = clock_timestamp();
