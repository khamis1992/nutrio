# Agent 6 Strength Training Contract Note

**Status:** Integrated / approved  
**Owner:** Agent 6  
**Phase:** Phase one  
**Rollout flag:** `phase1-training-enhancements` (default off)

## Integrated Boundaries

- The enhanced guided-workout experience is available only when `trainingEnhancements` resolves enabled through the shared phase-one flag API.
- Flag-off execution preserves the legacy set-log payload, linear exercise/set navigation, rest timer behavior, completion IDs, and history queries.
- Flag-off history requests only legacy session and set-log columns, allowing rollback without requiring phase-one training columns at read time.
- Enhanced set logs preserve prescribed-versus-actual fields: rep range, recommended load, RPE/RIR target, actual RPE/RIR, and prescribed rest.
- Exercise substitutions retain the original `program_exercise_id` and original exercise name while recording replacement catalog ID, replacement name, and client intent as a separate exercise event.
- Skips are explicit session events and do not rewrite the coach's program prescription.
- Plate calculations use the selected equipment profile and apply the calculated load directly to the current set's weight input; profile persistence remains separate from set logging.
- Session feedback and session-RPE training load are enhanced-only surfaces. Training load is informational and does not override coach programming or represent medical readiness.
- Agent-6-added UI is localized locally in English and Arabic with RTL direction and logical alignment. Shared locale JSON remains unchanged.
- The coach client detail surface receives the same default-off flag for program, adherence, template, schedule, set-structure, prescription-accuracy, and muscle-volume boundaries. Disabled reads use the legacy set-log projection and do not query exercise events, templates, or workout-day definitions.

## Approved Ownership

- `src/pages/nutrio/GuidedWorkout.tsx`
- `src/pages/nutrio/WorkoutHistory.tsx`
- `src/components/workout/*`
- Focused Agent 6 tests
- `docs/research/strength-training-review.md`
- `docs/contracts/agent-6-strength-training-contract-note.md`

## Rollback Contract

Disabling `phase1-training-enhancements` removes enhanced controls and analytics, suppresses equipment-profile reads, uses legacy workout history projections, and routes set completion through the legacy payload and sequence. Existing enhanced rows and event records are retained; rollback does not rewrite workout sessions, set logs, coach prescriptions, or equipment profiles.

## Verification Contract

- Flag-off rendering excludes advanced load, progression charts, substitutions, skips, plate calculation, feedback, and target comparison UI.
- Tests assert the exact legacy set payload and legacy history column projections.
- Tests assert prescription preservation after substitution, original/replacement intent recording, and plate-load application.
- Coach integration tests assert the shared flag wiring, legacy/enhanced query projections, and rendered Arabic RTL muscle-volume copy.
- Repository verification requires focused Vitest runs plus `npm run lint` and `npm run typecheck` before commit.
