import { beforeEach, describe, expect, it, vi } from "vitest";

const plugin = vi.hoisted(() => ({
  isAvailable: vi.fn(),
  checkAuthorization: vi.fn(),
  requestAuthorization: vi.fn(),
  readSamples: vi.fn(),
}));

vi.mock("@/lib/capacitor", () => ({ isNative: true, isIOS: true }));
vi.mock("@capgo/capacitor-health", () => ({ Health: plugin }));

import { HealthKit } from "@/services/health/healthkit";

describe("HealthKit blood glucose integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    plugin.isAvailable.mockResolvedValue({ available: true, platform: "ios" });
    plugin.checkAuthorization.mockResolvedValue({
      readAuthorized: ["bloodGlucose"],
      readDenied: [],
      writeAuthorized: [],
      writeDenied: [],
    });
  });

  it("exposes actual capabilities without claiming background sync", async () => {
    await expect(HealthKit.getCapabilities()).resolves.toEqual({
      healthData: "available",
      bloodGlucoseRead: "available",
      incrementalSync: "overlapping_window",
      backgroundSync: "unsupported",
    });
  });

  it("requires the requested glucose authorization", async () => {
    plugin.requestAuthorization.mockResolvedValue({
      readAuthorized: ["bloodGlucose"],
      readDenied: [],
      writeAuthorized: [],
      writeDenied: [],
    });

    await expect(HealthKit.requestPermissions({ bloodGlucose: true })).resolves.toMatchObject({
      bloodGlucose: true,
    });
    expect(plugin.requestAuthorization).toHaveBeenCalledWith({ read: ["bloodGlucose"], write: [] });
  });

  it("chunks long windows and preserves every native source record", async () => {
    plugin.readSamples.mockImplementation(async ({ startDate }: { startDate: string }) => ({
      samples: [{
        dataType: "bloodGlucose",
        value: 100,
        unit: "mg/dL",
        startDate,
        endDate: startDate,
        sourceName: "CGM",
        sourceId: "com.example.cgm",
        platformId: `record-${startDate}`,
      }],
    }));

    const samples = await HealthKit.getBloodGlucoseSamples({
      start: new Date("2026-07-18T00:00:00.000Z"),
      end: new Date("2026-07-20T00:00:00.000Z"),
    });

    expect(plugin.readSamples).toHaveBeenCalledTimes(4);
    expect(samples).toHaveLength(4);
    expect(samples.every((sample) => sample.platformId?.startsWith("record-"))).toBe(true);
  });
});
