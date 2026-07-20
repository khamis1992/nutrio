import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isFeatureEnabled } from "@/lib/analytics";
import {
  PHASE_ONE_FEATURE_FLAGS,
  PHASE_ONE_FEATURE_REGISTRY,
  isPhaseOneFlagForcedOn,
  isPhaseOneFeatureEnabled,
} from "@/lib/phase-one-feature-flags";

vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: vi.fn(),
}));

const mockedIsFeatureEnabled = vi.mocked(isFeatureEnabled);

describe("phase one feature flag registry", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_PHASE_ONE_ENABLE_ALL", "false");
    vi.stubEnv("VITE_PHASE_ONE_FLAGS", "");
    window.localStorage.clear();
    mockedIsFeatureEnabled.mockReset();
    mockedIsFeatureEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
  });

  it("registers ten unique default-off flags", () => {
    const definitions = Object.values(PHASE_ONE_FEATURE_REGISTRY);
    const keys = definitions.map(({ key }) => key);

    expect(definitions).toHaveLength(10);
    expect(new Set(keys).size).toBe(10);
    expect(definitions.every(({ defaultEnabled }) => !defaultEnabled)).toBe(true);
  });

  it("keeps a feature disabled when its own flag is off", () => {
    expect(isPhaseOneFeatureEnabled("consumptionLifecycle")).toBe(false);
    expect(mockedIsFeatureEnabled).toHaveBeenCalledWith(
      PHASE_ONE_FEATURE_FLAGS.consumptionLifecycle,
      false,
    );
  });

  it("requires every declared dependency", () => {
    mockedIsFeatureEnabled.mockImplementation((key) =>
      key === PHASE_ONE_FEATURE_FLAGS.rankingV2 ||
      key === PHASE_ONE_FEATURE_FLAGS.consumptionLifecycle ||
      key === PHASE_ONE_FEATURE_FLAGS.micronutrients,
    );

    expect(isPhaseOneFeatureEnabled("rankingV2")).toBe(false);
    expect(mockedIsFeatureEnabled).toHaveBeenCalledWith(
      PHASE_ONE_FEATURE_FLAGS.wearableNormalization,
      false,
    );
  });

  it("enables a feature only when the feature and dependencies are enabled", () => {
    mockedIsFeatureEnabled.mockReturnValue(true);

    expect(isPhaseOneFeatureEnabled("healthContext")).toBe(true);
  });

  it("supports a full phase-one environment override without changing registry defaults", () => {
    vi.stubEnv("VITE_PHASE_ONE_ENABLE_ALL", "true");

    expect(isPhaseOneFeatureEnabled("healthContext")).toBe(true);
    expect(mockedIsFeatureEnabled).not.toHaveBeenCalled();
  });

  it("supports targeted local overrides and still requires dependencies", () => {
    window.localStorage.setItem(
      "nutrio_phase_one_flags",
      JSON.stringify({
        [PHASE_ONE_FEATURE_FLAGS.rankingV2]: true,
        [PHASE_ONE_FEATURE_FLAGS.consumptionLifecycle]: true,
        [PHASE_ONE_FEATURE_FLAGS.micronutrients]: true,
      }),
    );

    expect(isPhaseOneFeatureEnabled("rankingV2")).toBe(false);

    window.localStorage.setItem(
      "nutrio_phase_one_flags",
      JSON.stringify({
        [PHASE_ONE_FEATURE_FLAGS.rankingV2]: true,
        [PHASE_ONE_FEATURE_FLAGS.consumptionLifecycle]: true,
        [PHASE_ONE_FEATURE_FLAGS.micronutrients]: true,
        [PHASE_ONE_FEATURE_FLAGS.wearableNormalization]: true,
      }),
    );

    expect(isPhaseOneFeatureEnabled("rankingV2")).toBe(true);
  });

  it("supports comma-separated environment flag overrides", () => {
    vi.stubEnv("VITE_PHASE_ONE_FLAGS", PHASE_ONE_FEATURE_FLAGS.outdoorRecording);

    expect(isPhaseOneFlagForcedOn(PHASE_ONE_FEATURE_FLAGS.outdoorRecording)).toBe(true);
    expect(isPhaseOneFlagForcedOn(PHASE_ONE_FEATURE_FLAGS.healthContext)).toBe(false);
  });

  it("lets an explicit local false roll back environment and remote enablement", () => {
    vi.stubEnv("VITE_PHASE_ONE_ENABLE_ALL", "true");
    mockedIsFeatureEnabled.mockReturnValue(true);
    window.localStorage.setItem("nutrio_phase_one_enable_all", "false");

    expect(isPhaseOneFeatureEnabled("outdoorRecording")).toBe(false);
    expect(mockedIsFeatureEnabled).not.toHaveBeenCalled();
  });

  it("lets a targeted local false roll back one feature", () => {
    mockedIsFeatureEnabled.mockReturnValue(true);
    window.localStorage.setItem(
      "nutrio_phase_one_flags",
      JSON.stringify({ [PHASE_ONE_FEATURE_FLAGS.outdoorRecording]: false }),
    );

    expect(isPhaseOneFeatureEnabled("outdoorRecording")).toBe(false);
  });
});
