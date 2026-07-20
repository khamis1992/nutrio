import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MuscleLoadMap } from "@/components/workout/MuscleLoadMap";
import {
  getWorkoutAdherenceSetColumns,
  WORKOUT_ADHERENCE_ENHANCED_SET_COLUMNS,
  WORKOUT_ADHERENCE_LEGACY_SET_COLUMNS,
  useWorkoutAdherence,
} from "@/hooks/useWorkoutAdherence";

const languageState = vi.hoisted(() => ({ isRTL: false }));
const databaseCalls = vi.hoisted(() => [] as Array<{ table: string; columns: string }>);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let selectedColumns = "";
      const chain = new Proxy({} as Record<string, unknown>, {
        get(_target, property) {
          if (property === "then") {
            const data = table === "coach_workout_sessions"
              ? [{
                  id: "session-1",
                  started_at: "2026-07-20T08:00:00Z",
                  completed_at: "2026-07-20T09:00:00Z",
                  day_number: 1,
                  program_id: "program-1",
                }]
              : [];
            return (resolve: (value: unknown) => void) => resolve({ data, error: null });
          }
          if (property === "select") {
            return (columns: string) => {
              selectedColumns = columns;
              databaseCalls.push({ table, columns });
              return chain;
            };
          }
          return () => chain;
        },
      });
      void selectedColumns;
      return chain;
    },
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    isRTL: languageState.isRTL,
    language: languageState.isRTL ? "ar" : "en",
    t: (key: string) => key,
  }),
}));

describe("Agent 6 coach integration", () => {
  beforeEach(() => {
    languageState.isRTL = false;
    databaseCalls.length = 0;
  });

  it("keeps enhanced database projections out of the flag-off path", () => {
    expect(getWorkoutAdherenceSetColumns(false)).toBe(WORKOUT_ADHERENCE_LEGACY_SET_COLUMNS);
    expect(getWorkoutAdherenceSetColumns(false)).not.toContain("target_reps_min");
    expect(getWorkoutAdherenceSetColumns(true)).toBe(WORKOUT_ADHERENCE_ENHANCED_SET_COLUMNS);
    expect(getWorkoutAdherenceSetColumns(true)).toContain("target_reps_min");
  });

  it("wires the shared default-off flag through the coach page data and UI boundaries", () => {
    const source = readFileSync(
      join(process.cwd(), "src/pages/coach/CoachClientDetail.tsx"),
      "utf8",
    );

    expect(source).toContain('isPhaseOneFeatureEnabled("trainingEnhancements")');
    expect(source).toContain("useCoachPrograms(coachId, clientId, true, trainingEnhancementsEnabled)");
    expect(source).toContain("useWorkoutAdherence(clientId, trainingEnhancementsEnabled)");
    expect(source).toContain("trainingEnhancementsEnabled && workoutExerciseEvents.length > 0");
    expect(source).toContain("trainingEnhancementsEnabled && weeklyMuscleVolume.length > 0");
    expect(source).toContain("trainingEnhancementsEnabled && workoutTemplates.length > 0");
  });

  it("does not query enhanced event data while disabled", async () => {
    const { result } = renderHook(() => useWorkoutAdherence("client-1", false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(databaseCalls.some(({ table }) => table === "coach_workout_exercise_events")).toBe(false);
    expect(databaseCalls.filter(({ table }) => table === "coach_workout_set_logs").every(
      ({ columns }) => columns === WORKOUT_ADHERENCE_LEGACY_SET_COLUMNS,
    )).toBe(true);
  });

  it("queries exercise events and enhanced set columns only when enabled", async () => {
    const { result } = renderHook(() => useWorkoutAdherence("client-1", true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(databaseCalls.some(({ table }) => table === "coach_workout_exercise_events")).toBe(true);
    expect(databaseCalls.filter(({ table }) => table === "coach_workout_set_logs").every(
      ({ columns }) => columns === WORKOUT_ADHERENCE_ENHANCED_SET_COLUMNS,
    )).toBe(true);
  });

  it("renders the Agent 6 muscle-volume surface in Arabic and RTL", () => {
    languageState.isRTL = true;

    const { container } = render(
      <MuscleLoadMap
        volumes={[{
          muscle: "Chest",
          prescribedSets: 4,
          completedSets: 2,
          completionPct: 50,
        }]}
      />,
    );

    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("الحجم الأسبوعي")).toBeInTheDocument();
    expect(screen.getByText("2 من 4 مجموعات")).toBeInTheDocument();
  });
});
