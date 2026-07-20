# Health Context and Cycle-Aware Personalization Review

## Scope

Phase one adds an optional, private health-context journal that can explain changes in appetite, energy, recovery, digestive comfort, and performance. It does not diagnose, predict fertility, infer ovulation, or change nutrition targets automatically.

## External source review

### Nomie 6 OSS

Source: https://github.com/open-nomie/nomie6-oss

Behavior learned:

- A journal can stay flexible by composing small trackers rather than creating a separate workflow for every symptom.
- Logs are timestamped events and trackers can be grouped into boards for quick repeated capture.
- Context is useful when it is attached to the same entry as tracked values.
- User-controlled export and confirmation before destructive deletion are core ownership behaviors.

Nutrio adaptation:

- Use an allow-listed set of structured fields for mood, stress, appetite, energy, digestive symptoms, and notes.
- Let the user show or hide supported fields through preferences.
- Keep one editable entry per local calendar date so mobile logging remains quick and deterministic.

Behavior intentionally not copied:

- Nutrio will not parse hashtags or arbitrary tracker syntax at runtime.
- Location, people tagging, social context, and unrestricted custom formulas are excluded.
- Notes are not treated as recommendation truth or sent to AI.

License notes:

- Nomie 6 OSS is MIT licensed. This work uses product behavior as reference and copies no source code, brand, or tracker library.

### drip

Sources:

- https://gitlab.com/bloodyhealth/drip
- https://dripapp.org/privacy-policy.html
- https://bloodyhealth.gitlab.io/faq.html

Behavior learned:

- Cycle data requires unusually strong privacy defaults, explicit user control, complete deletion, and portable export.
- Tracking should be inclusive and configurable; users may track only the information they choose.
- Stored values can include bleeding, mood, energy, pain, and notes without forcing fertility features.
- Fertility assumptions must not be derived from bleeding alone.

Nutrio adaptation:

- Cycle tracking is a separate opt-in inside an already opt-in health journal.
- Cycle phase and bleeding intensity are manually selected facts, never predictions.
- Cycle data is excluded from social/community surfaces and analytics payloads.
- Trend views require at least three entries per group and are labeled as observations, not medical findings.

Behavior intentionally not copied:

- No symptothermal algorithm, fertile-window calculation, ovulation prediction, pregnancy mode, cervical observations, or contraception guidance.
- No drip source code or GPL-licensed implementation is copied.

License notes:

- drip is GPL-3.0-or-later. It is a behavioral and privacy reference only; Nutrio does not import or adapt its code.

## Current Nutrio gap

- The health dashboard combines blood work, body measurements, meals, and readiness but has no private day-level context journal.
- Existing health-AI consent is purpose-specific and does not authorize journal or cycle context.
- Existing data export does not include a context dataset because no such dataset exists.
- Recommendation and AI report inputs cannot distinguish an unexplained low-appetite or high-stress day.
- There is no user-owned delete operation for a complete sensitive sub-dataset.

## Smallest phase-one implementation

1. A disabled `health_context` platform flag.
2. User preferences with journal opt-in, cycle opt-in, visible fields, and deterministic recommendation opt-in.
3. One structured private entry per user/date.
4. Owner-only RLS and SECURITY DEFINER RPCs that always derive identity from `auth.uid()`.
5. Private 90-day trends with minimum sample thresholds.
6. A recommendation-input RPC that returns current structured context only when the user opted in.
7. A separate versioned AI-summary consent. AI receives aggregates only; notes, exact dates, and raw bleeding records stay server-side.
8. Complete health-context export through the existing GDPR export and an immediate dataset-delete RPC.
9. A mobile-first panel embedded in the existing health dashboard, avoiding central route changes.

## Data and privacy risks

- Cycle and symptom data may expose highly sensitive reproductive or health information.
- Small sample groups can reveal exact individual dates or encourage false conclusions.
- Free-text notes can contain identifiers, prompt injection, or medical details.
- Client-supplied AI summaries can bypass consent or fabricate context.
- Service-role queries can accidentally broaden access if user filters are omitted.

Mitigations:

- Feature and user controls default off; cycle and AI sharing require separate opt-ins.
- RLS is forced and direct table writes are removed from authenticated clients.
- RPCs use `auth.uid()`, bounded inputs, allow lists, and explicit grants.
- Trends suppress groups with fewer than three entries.
- AI summary RPC omits notes, dates, and bleeding details and verifies versioned consent server-side.
- AI router loads the summary server-side instead of accepting it from the browser.
- Export includes the complete raw dataset; deletion is immediate and auditable.

## Recommendation safety

Health context may add explanation codes such as `context.low_appetite`, `context.high_stress`, `context.digestive_discomfort`, or `context.user_logged_cycle_phase`. It may adjust soft ranking components only. It cannot bypass allergen, medicine, diet, availability, budget, or ownership gates and cannot modify nutrition targets.

