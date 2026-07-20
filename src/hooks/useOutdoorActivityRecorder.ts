import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { clearOutdoorCheckpoint, loadOutdoorCheckpoint, saveOutdoorCheckpoint } from "@/lib/outdoor-activity-checkpoint";
import {
  createOutdoorActivityState,
  estimateOutdoorCalories,
  getActiveElapsedMs,
  getAveragePaceSecondsPerKm,
  outdoorActivityReducer,
  type OutdoorActivityAction,
  type OutdoorActivityState,
  type OutdoorActivityType,
  type OutdoorLocationPoint,
  type RouteVisibility,
} from "@/lib/outdoor-activity";
import {
  requestNativeBackgroundLocationPermission,
  startNativeBackgroundLocation,
  stopNativeBackgroundLocation,
  supportsNativeBackgroundLocation,
} from "@/services/native/backgroundLocation";

export type LocationPermissionState = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

export function useOutdoorActivityRecorder(userId: string, activityType: OutdoorActivityType, weightKg = 70) {
  const [state, dispatch] = useReducer(
    outdoorActivityReducer,
    undefined,
    () => createOutdoorActivityState(userId, activityType),
  );
  const stateRef = useRef(state);
  const watchIdRef = useRef<number | null>(null);
  const watchModeRef = useRef<"native" | "web" | null>(null);
  const checkpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAudioDistanceRef = useRef(0);
  const [permission, setPermission] = useState<LocationPermissionState>("unknown");
  const [recovery, setRecovery] = useState<OutdoorActivityState | null>(null);
  const [foregroundOnly, setForegroundOnly] = useState(false);
  const [now, setNow] = useState(Date.now());

  const applyAction = useCallback((action: OutdoorActivityAction) => {
    stateRef.current = outdoorActivityReducer(stateRef.current, action);
    dispatch(action);
  }, []);

  useEffect(() => {
    stateRef.current = state;
    if (checkpointTimerRef.current) clearTimeout(checkpointTimerRef.current);
    checkpointTimerRef.current = setTimeout(() => {
      void saveOutdoorCheckpoint(state).catch((error) => console.error("Outdoor checkpoint failed:", error));
    }, 500);
    return () => {
      if (checkpointTimerRef.current) clearTimeout(checkpointTimerRef.current);
    };
  }, [state]);

  useEffect(() => {
    applyAction({ type: "SET_ACTIVITY_TYPE", activityType });
  }, [activityType, applyAction]);

  useEffect(() => {
    void loadOutdoorCheckpoint(userId).then((checkpoint) => {
      if (checkpoint && ["recording", "paused", "ready"].includes(checkpoint.status)) setRecovery(checkpoint);
    });
  }, [userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const stopGpsWatch = useCallback(() => {
    const mode = watchModeRef.current;
    watchModeRef.current = null;

    if (mode === "native") {
      void stopNativeBackgroundLocation().catch((error) => {
        console.error("Native outdoor GPS stop failed:", error);
      });
      return;
    }

    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const recordPoint = useCallback((point: OutdoorLocationPoint) => {
    const action: OutdoorActivityAction = { type: "LOCATION", point };
    applyAction(action);
    if (supportsNativeBackgroundLocation()) {
      void saveOutdoorCheckpoint(stateRef.current).catch((error) => {
        console.error("Native outdoor checkpoint failed:", error);
      });
    }
  }, [applyAction]);

  const beginGpsWatch = useCallback(async () => {
    if (watchModeRef.current !== null) return;

    if (supportsNativeBackgroundLocation()) {
      watchModeRef.current = "native";
      try {
        await startNativeBackgroundLocation(recordPoint, (error) => {
          if (error.code === "NOT_AUTHORIZED" || error.code === "PERMISSION_DENIED") {
            setPermission("denied");
          }
          console.error("Native outdoor GPS watch failed:", error.message);
        });
        return;
      } catch (error) {
        watchModeRef.current = null;
        throw error;
      }
    }

    if (!navigator.geolocation) return;
    watchModeRef.current = "web";
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        recordPoint({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          altitude: coords.altitude,
          speed: coords.speed,
          heading: coords.heading,
          timestamp,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setPermission("denied");
        console.error("Outdoor GPS watch failed:", error.message);
      },
      { enableHighAccuracy: true, maximumAge: 2_000, timeout: 20_000 },
    );
  }, [recordPoint]);

  const requestForegroundPermission = useCallback(async () => {
    if (supportsNativeBackgroundLocation()) {
      applyAction({ type: "REQUEST_PERMISSION" });
      try {
        const granted = await requestNativeBackgroundLocationPermission();
        setPermission(granted ? "granted" : "denied");
        applyAction(granted
          ? { type: "PERMISSION_GRANTED" }
          : { type: "PERMISSION_DENIED", message: "Allow always-on location to record outdoor activities in the background." });
        return granted;
      } catch (error) {
        console.error("Native location permission failed:", error);
        setPermission("denied");
        applyAction({ type: "PERMISSION_DENIED", message: "Nutrio could not request background location access." });
        return false;
      }
    }

    if (!navigator.geolocation) {
      setPermission("unsupported");
      applyAction({ type: "PERMISSION_DENIED", message: "Location tracking is not available on this device." });
      return false;
    }
    applyAction({ type: "REQUEST_PERMISSION" });
    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords, timestamp }) => {
          setPermission("granted");
          applyAction({ type: "PERMISSION_GRANTED" });
          applyAction({
            type: "LOCATION",
            point: {
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy,
              altitude: coords.altitude,
              speed: coords.speed,
              heading: coords.heading,
              timestamp,
            },
          });
          resolve(true);
        },
        (error) => {
          setPermission(error.code === error.PERMISSION_DENIED ? "denied" : "prompt");
          applyAction({ type: "PERMISSION_DENIED", message: "Allow precise location to record your route and distance." });
          resolve(false);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
    });
  }, [applyAction]);

  useEffect(() => {
    if (supportsNativeBackgroundLocation()) return;
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: "geolocation" }).then((result) => {
      setPermission(result.state);
      result.onchange = () => setPermission(result.state);
    }).catch(() => setPermission("unknown"));
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (supportsNativeBackgroundLocation()) return;
      if (!document.hidden || stateRef.current.status !== "recording") return;
      // Browser geolocation is not a guaranteed background service. Pause safely and retain the checkpoint.
      applyAction({ type: "PAUSE", at: Date.now() });
      setForegroundOnly(true);
      stopGpsWatch();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [applyAction, stopGpsWatch]);

  useEffect(() => () => stopGpsWatch(), [stopGpsWatch]);

  useEffect(() => {
    if (state.status !== "recording" || state.distanceM < lastAudioDistanceRef.current + 1_000) return;
    lastAudioDistanceRef.current = Math.floor(state.distanceM / 1_000) * 1_000;
    if ("speechSynthesis" in window) {
      const kilometers = Math.floor(state.distanceM / 1_000);
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(`${kilometers} kilometer${kilometers === 1 ? "" : "s"}`));
    }
  }, [state.distanceM, state.status]);

  const start = useCallback(async () => {
    const allowed = permission === "granted" || await requestForegroundPermission();
    if (!allowed) return false;
    applyAction({ type: "START", at: Date.now() });
    try {
      await beginGpsWatch();
      setForegroundOnly(false);
      return true;
    } catch (error) {
      console.error("Outdoor activity tracking failed to start:", error);
      applyAction({ type: "PAUSE", at: Date.now() });
      return false;
    }
  }, [applyAction, beginGpsWatch, permission, requestForegroundPermission]);

  const pause = useCallback(() => {
    applyAction({ type: "PAUSE", at: Date.now() });
    stopGpsWatch();
  }, [applyAction, stopGpsWatch]);

  const resume = useCallback(() => {
    applyAction({ type: "RESUME", at: Date.now() });
    setForegroundOnly(false);
    void beginGpsWatch().catch((error) => console.error("Outdoor activity resume failed:", error));
  }, [applyAction, beginGpsWatch]);

  const finish = useCallback(() => {
    applyAction({ type: "FINISH", at: Date.now() });
    stopGpsWatch();
  }, [applyAction, stopGpsWatch]);

  const discard = useCallback(async () => {
    stopGpsWatch();
    applyAction({ type: "DISCARD" });
    setRecovery(null);
    await clearOutdoorCheckpoint(userId);
  }, [applyAction, stopGpsWatch, userId]);

  const restore = useCallback(() => {
    if (!recovery) return;
    applyAction({ type: "RESTORE", checkpoint: { ...recovery, status: "paused", lastResumedAt: null } });
    setRecovery(null);
  }, [applyAction, recovery]);

  const dismissRecovery = useCallback(async () => {
    setRecovery(null);
    await clearOutdoorCheckpoint(userId);
  }, [userId]);

  const setPrivacy = useCallback((visibility: RouteVisibility) => applyAction({ type: "SET_PRIVACY", visibility }), [applyAction]);
  const setAutoPause = useCallback((enabled: boolean) => applyAction({ type: "SET_AUTO_PAUSE", enabled }), [applyAction]);

  const metrics = useMemo(() => ({
    elapsedMs: getActiveElapsedMs(state, now),
    distanceKm: state.distanceM / 1_000,
    paceSecondsPerKm: getAveragePaceSecondsPerKm(state, now),
    calories: estimateOutdoorCalories(state, weightKg, now),
  }), [now, state, weightKg]);

  return {
    state,
    metrics,
    permission,
    recovery,
    foregroundOnly,
    requestForegroundPermission,
    start,
    pause,
    resume,
    finish,
    discard,
    restore,
    dismissRecovery,
    setPrivacy,
    setAutoPause,
  };
}
