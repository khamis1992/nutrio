import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HealthContextPanel } from "@/components/health/HealthContextPanel";
import type { HealthContextState } from "@/lib/health-context";

const runtime = vi.hoisted(() => ({
  clientEnabled: false,
  isRTL: false,
}));

const healthContext = vi.hoisted(() => ({
  fetchState: vi.fn(),
  deleteDataset: vi.fn(),
  deleteEntry: vi.fn(),
  exportData: vi.fn(),
  saveEntry: vi.fn(),
  savePreferences: vi.fn(),
  setAiConsent: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ isRTL: runtime.isRTL }),
}));

vi.mock("@/lib/phase-one-feature-flags", () => ({
  isPhaseOneFeatureEnabled: () => runtime.clientEnabled,
}));

vi.mock("@/lib/health-context", () => ({
  fetchHealthContextState: healthContext.fetchState,
  deleteHealthContextDataset: healthContext.deleteDataset,
  deleteHealthContextEntry: healthContext.deleteEntry,
  exportUserDataWithHealthContext: healthContext.exportData,
  saveHealthContextEntry: healthContext.saveEntry,
  saveHealthContextPreferences: healthContext.savePreferences,
  setHealthContextAiConsent: healthContext.setAiConsent,
}));

const preferences = {
  journal_enabled: false,
  cycle_tracking_enabled: false,
  recommendation_context_enabled: false,
  mood_enabled: true,
  stress_enabled: true,
  appetite_enabled: true,
  energy_enabled: true,
  digestive_enabled: true,
  note_enabled: true,
};

function state(overrides: Partial<HealthContextState> = {}): HealthContextState {
  return {
    feature_enabled: false,
    has_existing_data: false,
    preferences,
    entries: [],
    ai_consent: false,
    ...overrides,
  };
}

describe("HealthContextPanel privacy rollout", () => {
  beforeEach(() => {
    runtime.clientEnabled = false;
    runtime.isRTL = false;
    vi.clearAllMocks();
    healthContext.fetchState.mockResolvedValue(state());
  });

  it("renders no collection UI while the feature is off and no data exists", async () => {
    const { container } = render(<HealthContextPanel />);

    await waitFor(() => expect(healthContext.fetchState).toHaveBeenCalledOnce());
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: /enable private journal/i })).not.toBeInTheDocument();
  });

  it("keeps only export and permanent deletion available after rollback", async () => {
    healthContext.fetchState.mockResolvedValue(state({ has_existing_data: true }));

    render(<HealthContextPanel />);

    expect(await screen.findByText("Your health data is stored")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export all my data" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete health-context data" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log today/i })).not.toBeInTheDocument();
  });

  it("renders the opt-in surface in Arabic with an explicit RTL boundary", async () => {
    runtime.clientEnabled = true;
    runtime.isRTL = true;
    healthContext.fetchState.mockResolvedValue(state({ feature_enabled: true }));

    const { container } = render(<HealthContextPanel />);

    expect(await screen.findByText("افهم نمط يومك")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تفعيل السجل الخاص" })).toBeInTheDocument();
    expect(container.querySelector('section[dir="rtl"]')).toBeInTheDocument();
  });

  it("does not render cycle or bleeding inputs without cycle opt-in", async () => {
    runtime.clientEnabled = true;
    healthContext.fetchState.mockResolvedValue(state({
      feature_enabled: true,
      preferences: { ...preferences, journal_enabled: true },
    }));

    render(<HealthContextPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Log today" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Cycle phase")).not.toBeInTheDocument();
    expect(screen.queryByText("Bleeding flow")).not.toBeInTheDocument();
  });
});
