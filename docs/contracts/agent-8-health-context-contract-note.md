# Agent 8 Contract Note: Health Context

Status: integrated and verified (2026-07-20)

## Integration evidence

- `supabase/tests/phase-one-health-context.sql`: 33 pgTAP assertions pass against the isolated phase-one schema plus the existing `20260720192500_restore_health_context_default_off.sql` correction.
- Owner/non-owner RLS, default-off RPC rejection, journal/cycle/recommendation/AI consent gates, bounded AI aggregates, dataset deletion, consent revocation, and cross-user deletion isolation are executed in a rolled-back database transaction.
- `src/components/health/HealthContextPanel.test.tsx`, `src/lib/health-context.test.ts`, and `src/test/health-context-security.test.ts`: 15 focused Vitest assertions pass.
- Rendered coverage verifies Arabic copy with an explicit RTL boundary, no collection surface while disabled, retained export/deletion controls for stored data, and hidden cycle fields without cycle opt-in.
- ESLint completes with zero errors. Repository typecheck remains blocked by pre-existing errors outside Agent 8 ownership in `useMealCompletion.ts`, `meal-log-service.test.ts`, `AdminHealthPrograms.tsx`, and `PartnerMenu.tsx`.

## Ownership boundary

Agent 8 owns the additive health-context migration, feature-local service/hook/components, health-dashboard composition, health-context inclusion in GDPR export, and consent-gated AI/recommendation inputs.

Agent 8 does not edit central routes, generated Supabase types, shared database enums, shared notification workers, or translation JSON. Agent 0 must regenerate types and apply the submitted translation key manifest during integration.

## Proposed database contract

### `public.health_context_preferences`

- Primary key: `user_id`.
- Defaults: journal disabled, cycle logging disabled, recommendation use disabled.
- `visible_fields` is a validated JSON object containing only supported boolean field names.
- Deleting the auth user cascades the row.

### `public.health_context_entries`

- One row per `(user_id, entry_date)`.
- Structured optional values: mood, stress, appetite, energy, digestive symptoms, symptom severity, user-selected cycle phase, bleeding intensity, and a bounded note.
- No fertility, ovulation, pregnancy, sexual activity, or diagnosis fields.
- Cycle values are rejected unless cycle logging is enabled.
- Deleting the auth user cascades all rows.

### AI consent

- Extend `public.ai_data_consents.purpose` with `health_context_summary`.
- Policy version: `2026-07-health-context-ai-v1`.
- This consent is independent from blood-work analysis and nutrition-coach consent.

## RPC contract

- `get_health_context_state()` returns owner preferences, recent entries, trends, and AI consent.
- `set_health_context_preferences(...)` enables/disables the journal, cycle fields, and deterministic recommendation use.
- `upsert_health_context_entry(...)` validates and writes one owner entry.
- `delete_health_context_entry(p_entry_id)` deletes one owner entry.
- `delete_health_context_dataset()` revokes consent and deletes all entries/preferences for the caller.
- `set_health_context_ai_consent(p_granted, p_policy_version)` records versioned consent.
- `get_health_context_recommendation_input(p_on_date)` returns bounded structured context only when enabled and fresh.
- `get_health_context_ai_summary(p_days)` returns aggregate context only when the caller has current consent.
- `get_health_context_ai_summary_for_user(p_user_id, p_days)` is service-role-only for AI router use and applies the same consent check.

## Feature flag

`platform_settings.key = 'phase1-health-context'`

Default value:

```json
{"enabled": false, "rollout_percent": 0}
```

The client renders no collection UI while disabled. RPCs also enforce the platform flag so a hidden client cannot collect or analyze context before rollout. If an existing user has stored data when the flag is rolled back, `get_health_context_state()` returns only `has_existing_data`; the client keeps export and permanent deletion available without reopening collection.

## Recommendation input

The deterministic input is a bounded object with freshness and explanation codes. It is a soft signal only and cannot override hard safety or commercial gates.

## AI boundary

The browser never supplies health-context text to the AI router. The router requests a server-generated aggregate after authenticating the user. The aggregate excludes notes, dates, identity, bleeding details, and groups with insufficient samples.

The weekly-report cache includes an opaque hash of the currently consented aggregate. Granting, revoking, changing, or deleting health context therefore invalidates a stale AI report without placing journal text in the browser request.

## Export and deletion

The existing GDPR export adds preferences, entries, and consent events. The dataset-delete RPC deletes all entries and preferences and revokes current AI consent in one transaction. Account deletion remains covered by foreign-key cascades.

## Translation key manifest for Agent 0

- `health_context_title`
- `health_context_subtitle`
- `health_context_enable`
- `health_context_cycle_enable`
- `health_context_ai_enable`
- `health_context_recommendations_enable`
- `health_context_log_today`
- `health_context_mood`
- `health_context_stress`
- `health_context_appetite`
- `health_context_energy`
- `health_context_digestive`
- `health_context_cycle_phase`
- `health_context_bleeding`
- `health_context_note`
- `health_context_trends`
- `health_context_observation_disclaimer`
- `health_context_export`
- `health_context_delete_all`
- `health_context_delete_confirm`
- `health_context_stored_title`
- `health_context_stored_note`
- `health_context_symptom_severity`
- `health_context_symptom_bloating`
- `health_context_symptom_reflux`
- `health_context_symptom_constipation`
- `health_context_symptom_diarrhea`
- `health_context_symptom_nausea`
- `health_context_symptom_discomfort`
- `health_context_phase_menstrual`
- `health_context_phase_follicular`
- `health_context_phase_ovulatory`
- `health_context_phase_luteal`
- `health_context_flow_none`
- `health_context_flow_spotting`
- `health_context_flow_light`
- `health_context_flow_medium`
- `health_context_flow_heavy`
