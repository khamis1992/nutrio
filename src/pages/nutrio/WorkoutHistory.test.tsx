import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkoutHistory from "@/pages/nutrio/WorkoutHistory";

const state = vi.hoisted(() => ({ enabled: false }));
const selectCalls = vi.hoisted(() => [] as Array<{ table: string; columns: string }>);

vi.mock("@/lib/phase-one-feature-flags", () => ({
  isPhaseOneFeatureEnabled: () => state.enabled,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ isRTL: false, language: "en", t: (key: string) => key }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock("@/integrations/supabase/client", () => {
  const rows: Record<string, unknown[]> = {
    coach_workout_sessions: [{
      id: "session-1",
      program_id: "program-1",
      day_number: 1,
      started_at: "2026-07-20T10:00:00Z",
      completed_at: "2026-07-20T11:00:00Z",
      duration_seconds: 3600,
      notes: null,
    }],
    coach_programs: [{ id: "program-1", title: "Strength day" }],
    coach_workout_set_logs: [{
      id: "set-1",
      session_id: "session-1",
      exercise_name: "Barbell squat",
      set_number: 1,
      reps: 8,
      weight_kg: 60,
      completed: true,
    }],
  };

  const from = vi.fn((table: string) => {
    const chain = new Proxy({} as Record<string, unknown>, {
      get(_target, property) {
        if (property === "then") {
          return (resolve: (value: unknown) => void) => resolve({ data: rows[table] ?? [], error: null });
        }
        if (property === "select") {
          return (columns: string) => {
            selectCalls.push({ table, columns });
            return chain;
          };
        }
        return () => chain;
      },
    });
    return chain;
  });

  return { supabase: { from } };
});

describe("WorkoutHistory phase-one gate", () => {
  beforeEach(() => {
    state.enabled = false;
    selectCalls.length = 0;
  });

  it("renders legacy history and queries only legacy columns while disabled", async () => {
    render(<MemoryRouter><WorkoutHistory /></MemoryRouter>);

    expect(await screen.findByText("Strength day")).toBeInTheDocument();
    expect(screen.queryByText("Advanced training load")).not.toBeInTheDocument();
    expect(screen.queryByText("Strength Progression")).not.toBeInTheDocument();

    await waitFor(() => expect(selectCalls.some(({ table }) => table === "coach_workout_set_logs")).toBe(true));
    const sessionSelect = selectCalls.find(({ table }) => table === "coach_workout_sessions")?.columns;
    const setSelect = selectCalls.find(({ table }) => table === "coach_workout_set_logs")?.columns;

    expect(sessionSelect).toBe("id, program_id, day_number, started_at, completed_at, duration_seconds, notes");
    expect(setSelect).toBe("id, session_id, exercise_name, set_number, reps, weight_kg, completed");
  });
});
