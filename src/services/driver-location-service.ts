/**
 * Driver GPS Broadcasting Service
 *
 * Uses browser Geolocation API to broadcast driver location to Supabase.
 * - Updates driver_profiles.current_location (GEOGRAPHY)
 * - Inserts into driver_locations history
 * - Sends updates every 5 seconds when on duty
 */

import { supabase } from "@/integrations/supabase/client";

export type BroadcastStatus = "idle" | "broadcasting" | "error";

interface BroadcastState {
  status: BroadcastStatus;
  errorMessage?: string;
  lastUpdate: Date | null;
  watchId: number | null;
  shiftId: string | null;
  intervalId: ReturnType<typeof setInterval> | null;
}

const state: BroadcastState = {
  status: "idle",
  errorMessage: undefined,
  lastUpdate: null,
  watchId: null,
  shiftId: null,
  intervalId: null,
};

let isStopped = false;

type StateListener = (s: BroadcastState) => void;
const listeners = new Set<StateListener>();

function notify() {
  listeners.forEach((fn) => fn({ ...state }));
}

export function subscribe(listener: StateListener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

/** Get current broadcast state (snapshot) */
export function getState(): BroadcastState {
  return { ...state };
}

/** Check if currently broadcasting */
export function isRunning(): boolean {
  return state.status === "broadcasting";
}

// ── Core location update to Supabase ──────────────────────────────────────────

async function sendLocationUpdate(lat: number, lng: number, accuracy?: number) {
  if (!state.shiftId) return;

  const point = `SRID=4326;POINT(${lng} ${lat})`;

  // Update driver_profiles.current_location
  await supabase
    .from("driver_profiles")
    .update({ current_location: point, updated_at: new Date().toISOString() })
    .eq("id", state.shiftId);

  // Insert into driver_locations history
  await supabase.from("driver_locations").insert({
    driver_id: state.shiftId,
    location: point,
    accuracy,
    recorded_at: new Date().toISOString(),
  });

  state.lastUpdate = new Date();
  notify();
}

// ── Throttled update: only send if moved > 10m or 5s elapsed ──────────────────

let lastSentLat = 0;
let lastSentLng = 0;
let lastSentTime = 0;
const MIN_DISTANCE_M = 10;
const MIN_INTERVAL_MS = 5000;

function shouldSend(lat: number, lng: number): boolean {
  const now = Date.now();
  if (now - lastSentTime < MIN_INTERVAL_MS) return false;

  if (lastSentLat === 0) return true;

  const R = 6371000;
  const dLat = ((lat - lastSentLat) * Math.PI) / 180;
  const dLng = ((lng - lastSentLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lastSentLat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (dist >= MIN_DISTANCE_M || now - lastSentTime >= MIN_INTERVAL_MS) {
    lastSentLat = lat;
    lastSentLng = lng;
    lastSentTime = now;
    return true;
  }
  return false;
}

// ── Position callbacks ────────────────────────────────────────────────────────

function onPositionSuccess(pos: GeolocationPosition) {
  if (state.status !== "broadcasting") return;

  const { latitude, longitude, accuracy } = pos.coords;

  if (shouldSend(latitude, longitude)) {
    sendLocationUpdate(latitude, longitude, accuracy).catch((err) => {
      console.error("[GPS] sendLocationUpdate failed:", err);
    });
  }
}

function onPositionError(err: GeolocationPositionError) {
  const messages: Record<number, string> = {
    1: "Location permission denied. Please enable GPS access.",
    2: "Location unavailable. Check your GPS settings.",
    3: "Location request timed out. Retrying...",
  };
  state.errorMessage = messages[err.code] || "Unknown GPS error";
  // Don't stop on timeout — keep trying
  if (err.code !== 3) {
    state.status = "error";
    notify();
  }
}

// ── Start / Stop ──────────────────────────────────────────────────────────────

export async function startBroadcasting(driverProfileId: string): Promise<boolean> {
  if (state.status === "broadcasting" || isStopped) {
    if (isStopped) {
      isStopped = false;
    }
    if (state.status === "broadcasting") return true;
  }

  if (!navigator.geolocation) {
    state.status = "error";
    state.errorMessage = "Geolocation not supported by this browser";
    notify();
    return false;
  }

  try {
    // Create shift record
    const { data: shift, error } = await supabase
      .from("driver_shifts")
      .insert({
        driver_id: driverProfileId,
        started_at: new Date().toISOString(),
        status: "active",
      })
      .select("id")
      .single();

    if (error) throw error;

    state.shiftId = shift.id;
    state.status = "broadcasting";
    state.errorMessage = undefined;
    isStopped = false;
    lastSentLat = 0;
    lastSentLng = 0;
    lastSentTime = 0;
    notify();

    // Watch position (high accuracy for driving)
    state.watchId = navigator.geolocation.watchPosition(
      onPositionSuccess,
      onPositionError,
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    // Fallback interval: if no GPS update in 10s, try again
    state.intervalId = setInterval(() => {
      if (Date.now() - lastSentTime > 10000 && state.status === "broadcasting" && !isStopped) {
        navigator.geolocation.getCurrentPosition(onPositionSuccess, onPositionError, {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        });
      }
    }, 10000);

    return true;
  } catch (err: unknown) {
    state.status = "error";
    state.errorMessage = err instanceof Error ? err.message : "Failed to start GPS broadcasting";
    notify();
    return false;
  }
}

export async function stopBroadcasting(): Promise<void> {
  isStopped = true;

  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }

  if (state.intervalId !== null) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  // Close shift
  if (state.shiftId) {
    try {
      await supabase
        .from("driver_shifts")
        .update({
          ended_at: new Date().toISOString(),
          status: "completed",
        })
        .eq("id", state.shiftId);
    } catch (err) {
      console.error("[GPS] Failed to close shift:", err);
    }
  }

  state.status = "idle";
  state.shiftId = null;
  notify();
}
