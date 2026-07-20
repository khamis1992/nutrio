# Strength Training Phase-One Review

**Owner:** Agent 6  
**Reviewed:** 2026-07-20  
**Decision:** Integrated / approved behind `phase1-training-enhancements`

## Scope

Phase one extends Nutrio's existing coach-authored workout engine with usability and observability features. It does not introduce a second progression engine or weaken day locks, coach prescriptions, RPE/RIR capture, or the existing rest workflow.

Reference implementations reviewed in the phase-one plan:

- [Liftosaur](https://github.com/astashov/liftosaur): plate loading, strength-session ergonomics, templates, and substitutions.
- [wger](https://github.com/wger-project/wger): structured exercise taxonomy, equipment metadata, and multilingual exercise content.
- [GoldenCheetah](https://github.com/GoldenCheetah/GoldenCheetah): optional training-load and progression analysis separated from the authoritative workout prescription.

## Product Decisions

### Preserve the prescription

The coach's `program_exercise_id` remains the prescription identity. An in-session replacement changes the performed exercise name for the set log and appends a replacement event containing both original and replacement intent. It does not mutate the program exercise. Enhanced set logs snapshot rep, load, effort, RIR, and rest targets alongside actual values so later history remains explainable if the program changes.

### Restrict substitutions

Suggested alternatives must share primary muscle intent and either body area or training category. When an equipment profile exists, the candidate must also be feasible with available equipment, except bodyweight movements. Skips and replacements are explicit session events visible to coaching workflows rather than silent edits.

### Keep calculations advisory

The plate calculator finds the closest load possible from the selected bar and per-side plate inventory, then applies that actual load to the current set input. Weekly session-RPE load is an optional self-comparison view. It is not a medical readiness score and cannot override progression or coach programming.

### Roll out reversibly

`phase1-training-enhancements` is default off. Disabled behavior uses the legacy set payload, next-set sequence, rest handling, completion list, and history projections. Enhanced UI, equipment-profile reads, target comparisons, session feedback, substitutions, skips, and advanced charts are absent while disabled. Existing enhanced data is retained on rollback.

## Phase-One Gap Closure

| Gap | Implemented boundary |
|---|---|
| Default-off release gate | Guided workout, workout history, and coach client detail reads/rendering branch through the shared training feature flag. |
| Legacy rollback safety | Disabled history queries omit phase-one columns; disabled set completion emits the exact legacy payload. |
| Prescription traceability | Enhanced set payload snapshots target reps, weight, RPE/RIR, and rest while retaining the original program exercise ID. |
| Substitution intent | Replacement events preserve original and replacement IDs/names; candidate filtering preserves muscle and equipment intent. |
| Plate application | Calculated load is passed directly into the current weight input without changing prescription identity. |
| Arabic/English UI | Agent-6-added controls use local bilingual copy and logical/RTL-safe alignment without editing shared locale JSON. |
| Coach prescription integration | Coach templates, schedule metadata, session changes, prescription accuracy, advanced set structure, and muscle volume remain hidden and avoid enhanced-only reads/writes while the flag is disabled. |
| Focused verification | Tests cover flag-off history rendering/projections, legacy payload equality, enhanced target preservation, replacement intent, and plate application. |

## Deferred

- New progression strategies or automated program rewrites.
- Medical readiness, injury diagnosis, or recovery clearance.
- Changes to shared routing, global locale registries, or the phase-one flag registry.
- Generated Supabase type consolidation and migration-registry work owned by integration agents.

## Approval Criteria

The Agent 6 boundary is approved when focused tests pass, lint and TypeScript checks are clean for the repository state, and disabling the flag demonstrates no enhanced rendering or enhanced database projections. The companion contract is recorded in `docs/contracts/agent-6-strength-training-contract-note.md`.
