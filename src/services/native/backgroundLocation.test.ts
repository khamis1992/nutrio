import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  requestPermissions: vi.fn(),
}));

vi.mock("@/lib/capacitor", () => ({
  isNative: true,
  isIOS: false,
  isAndroid: true,
}));

vi.mock("@capgo/background-geolocation", () => ({
  BackgroundGeolocation: mocks,
}));

import {
  requestNativeBackgroundLocationPermission,
  startNativeBackgroundLocation,
  stopNativeBackgroundLocation,
} from "@/services/native/backgroundLocation";

describe("native background activity tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestPermissions.mockResolvedValue({
      location: "granted",
      notification: "granted",
    });
    mocks.start.mockResolvedValue(undefined);
    mocks.stop.mockResolvedValue(undefined);
  });

  it("requests Android location and foreground-service notification permissions", async () => {
    await expect(requestNativeBackgroundLocationPermission()).resolves.toBe(true);
    expect(mocks.requestPermissions).toHaveBeenCalledWith({
      permissions: ["location", "notification"],
    });
  });

  it("starts native background recording and maps location fields", async () => {
    const onPoint = vi.fn();
    await startNativeBackgroundLocation(onPoint, vi.fn());

    const [options, callback] = mocks.start.mock.calls[0];
    expect(options.backgroundMessage).toContain("recording your route");
    callback({
      latitude: 25.2854,
      longitude: 51.531,
      accuracy: 6,
      altitude: 10,
      speed: 2,
      bearing: 90,
      time: 1_784_400_000_000,
      simulated: false,
      altitudeAccuracy: 3,
    });

    expect(onPoint).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 25.2854,
      longitude: 51.531,
      heading: 90,
      timestamp: 1_784_400_000_000,
    }));
  });

  it("stops the native service", async () => {
    await stopNativeBackgroundLocation();
    expect(mocks.stop).toHaveBeenCalledOnce();
  });
});
