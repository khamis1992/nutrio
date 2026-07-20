import { isAndroid, isIOS, isNative } from "@/lib/capacitor";
import type { OutdoorLocationPoint } from "@/lib/outdoor-activity";

export type NativeLocationError = {
  code?: string;
  message: string;
};

export function supportsNativeBackgroundLocation(): boolean {
  return isNative && (isIOS || isAndroid);
}

export async function requestNativeBackgroundLocationPermission(): Promise<boolean> {
  if (!supportsNativeBackgroundLocation()) return false;

  const { BackgroundGeolocation } = await import("@capgo/background-geolocation");
  const permissions = isIOS
    ? ["backgroundLocation" as const]
    : ["location" as const, "notification" as const];
  const status = await BackgroundGeolocation.requestPermissions({ permissions });

  const locationGranted = status.location === "granted";
  const backgroundGranted = !isIOS
    || status.backgroundLocation === "granted"
    || status.backgroundLocation === "always";
  const notificationGranted = !isAndroid
    || status.notification === undefined
    || status.notification === "granted";

  return locationGranted && backgroundGranted && notificationGranted;
}

export async function startNativeBackgroundLocation(
  onPoint: (point: OutdoorLocationPoint) => void,
  onError: (error: NativeLocationError) => void,
): Promise<void> {
  if (!supportsNativeBackgroundLocation()) {
    throw new Error("Native background location is unavailable.");
  }

  const { BackgroundGeolocation } = await import("@capgo/background-geolocation");
  await BackgroundGeolocation.start(
    {
      backgroundTitle: "Nutrio activity in progress",
      backgroundMessage: "Nutrio is recording your route. Tap to return to the activity.",
      requestPermissions: false,
      stale: false,
      distanceFilter: 5,
    },
    (location, error) => {
      if (error) {
        onError({ code: error.code, message: error.message });
        return;
      }
      if (!location) return;

      onPoint({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        altitude: location.altitude,
        speed: location.speed,
        heading: location.bearing,
        timestamp: location.time ?? Date.now(),
      });
    },
  );
}

export async function stopNativeBackgroundLocation(): Promise<void> {
  if (!supportsNativeBackgroundLocation()) return;
  const { BackgroundGeolocation } = await import("@capgo/background-geolocation");
  await BackgroundGeolocation.stop();
}
