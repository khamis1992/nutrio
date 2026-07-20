export type OutdoorActivityType = "walking" | "running" | "cycling";
export type OutdoorRecordingStatus =
  | "idle"
  | "requesting_permission"
  | "ready"
  | "recording"
  | "paused"
  | "completed"
  | "discarded"
  | "error";
export type RouteVisibility = "private" | "followers" | "public";
export type CalorieSource =
  | "gps_met_estimate"
  | "heart_rate_estimate"
  | "device_sync"
  | "imported_file";

export interface OutdoorLocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  heartRate?: number | null;
  timestamp: number;
}

export interface OutdoorActivityState {
  version: 1;
  localSessionId: string;
  userId: string;
  activityType: OutdoorActivityType;
  status: OutdoorRecordingStatus;
  startedAt: number | null;
  completedAt: number | null;
  lastResumedAt: number | null;
  activeElapsedMs: number;
  distanceM: number;
  elevationGainM: number;
  points: OutdoorLocationPoint[];
  autoPauseEnabled: boolean;
  autoPaused: boolean;
  lowSpeedSince: number | null;
  routeVisibility: RouteVisibility;
  calorieSource: CalorieSource;
  errorMessage: string | null;
}

export type OutdoorActivityAction =
  | { type: "REQUEST_PERMISSION" }
  | { type: "PERMISSION_GRANTED" }
  | { type: "PERMISSION_DENIED"; message: string }
  | { type: "START"; at: number }
  | { type: "LOCATION"; point: OutdoorLocationPoint }
  | { type: "PAUSE"; at: number; automatic?: boolean }
  | { type: "RESUME"; at: number; automatic?: boolean }
  | { type: "FINISH"; at: number }
  | { type: "DISCARD" }
  | { type: "SET_PRIVACY"; visibility: RouteVisibility }
  | { type: "SET_AUTO_PAUSE"; enabled: boolean }
  | { type: "SET_ACTIVITY_TYPE"; activityType: OutdoorActivityType }
  | { type: "RESTORE"; checkpoint: OutdoorActivityState };

const MAX_ACCURACY_M = 65;
const AUTO_PAUSE_AFTER_MS = 10_000;

const speedLimits: Record<OutdoorActivityType, number> = {
  walking: 4.5,
  running: 9,
  cycling: 25,
};

const autoPauseSpeeds: Record<OutdoorActivityType, number> = {
  walking: 0.45,
  running: 0.65,
  cycling: 1.2,
};

export function createOutdoorActivityState(
  userId: string,
  activityType: OutdoorActivityType,
  localSessionId: string = crypto.randomUUID(),
): OutdoorActivityState {
  return {
    version: 1,
    localSessionId,
    userId,
    activityType,
    status: "idle",
    startedAt: null,
    completedAt: null,
    lastResumedAt: null,
    activeElapsedMs: 0,
    distanceM: 0,
    elevationGainM: 0,
    points: [],
    autoPauseEnabled: true,
    autoPaused: false,
    lowSpeedSince: null,
    routeVisibility: "private",
    calorieSource: "gps_met_estimate",
    errorMessage: null,
  };
}

export function haversineDistanceM(a: OutdoorLocationPoint, b: OutdoorLocationPoint): number {
  const radiusM = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isUsableOutdoorPoint(
  point: OutdoorLocationPoint,
  previous: OutdoorLocationPoint | undefined,
  activityType: OutdoorActivityType,
): boolean {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
  if (point.latitude < -90 || point.latitude > 90 || point.longitude < -180 || point.longitude > 180) return false;
  if (!Number.isFinite(point.accuracy) || point.accuracy <= 0 || point.accuracy > MAX_ACCURACY_M) return false;
  if (!previous) return true;
  const elapsedSeconds = (point.timestamp - previous.timestamp) / 1000;
  if (elapsedSeconds <= 0) return false;
  const measuredSpeed = haversineDistanceM(previous, point) / elapsedSeconds;
  return measuredSpeed <= speedLimits[activityType];
}

function commitActiveTime(state: OutdoorActivityState, at: number) {
  if (state.lastResumedAt === null) return state.activeElapsedMs;
  return state.activeElapsedMs + Math.max(0, at - state.lastResumedAt);
}

function appendPoint(state: OutdoorActivityState, point: OutdoorLocationPoint): OutdoorActivityState {
  const previous = state.points.at(-1);
  if (!isUsableOutdoorPoint(point, previous, state.activityType)) return state;

  const segmentDistance = previous ? haversineDistanceM(previous, point) : 0;
  const elevationGain = previous?.altitude != null && point.altitude != null
    ? Math.max(0, point.altitude - previous.altitude)
    : 0;
  const speed = point.speed ?? (previous
    ? segmentDistance / Math.max(1, (point.timestamp - previous.timestamp) / 1000)
    : 0);

  if (!state.autoPauseEnabled) {
    return {
      ...state,
      points: [...state.points, point],
      distanceM: state.distanceM + segmentDistance,
      elevationGainM: state.elevationGainM + elevationGain,
    };
  }

  const threshold = autoPauseSpeeds[state.activityType];
  if (speed < threshold) {
    const lowSpeedSince = state.lowSpeedSince ?? point.timestamp;
    if (!state.autoPaused && point.timestamp - lowSpeedSince >= AUTO_PAUSE_AFTER_MS) {
      return {
        ...state,
        status: "paused",
        autoPaused: true,
        lowSpeedSince,
        activeElapsedMs: commitActiveTime(state, point.timestamp),
        lastResumedAt: null,
        points: [...state.points, point],
      };
    }
    return { ...state, lowSpeedSince, points: [...state.points, point] };
  }

  const resumed = state.autoPaused;
  return {
    ...state,
    status: resumed ? "recording" : state.status,
    autoPaused: false,
    lowSpeedSince: null,
    lastResumedAt: resumed ? point.timestamp : state.lastResumedAt,
    points: [...state.points, point],
    distanceM: state.distanceM + segmentDistance,
    elevationGainM: state.elevationGainM + elevationGain,
  };
}

export function outdoorActivityReducer(
  state: OutdoorActivityState,
  action: OutdoorActivityAction,
): OutdoorActivityState {
  switch (action.type) {
    case "REQUEST_PERMISSION":
      return { ...state, status: "requesting_permission", errorMessage: null };
    case "PERMISSION_GRANTED":
      return { ...state, status: "ready", errorMessage: null };
    case "PERMISSION_DENIED":
      return { ...state, status: "error", errorMessage: action.message };
    case "START":
      return {
        ...state,
        status: "recording",
        startedAt: state.startedAt ?? action.at,
        lastResumedAt: action.at,
        errorMessage: null,
      };
    case "LOCATION":
      return state.status === "recording" || state.autoPaused ? appendPoint(state, action.point) : state;
    case "PAUSE":
      if (state.status !== "recording") return state;
      return {
        ...state,
        status: "paused",
        autoPaused: action.automatic ?? false,
        activeElapsedMs: commitActiveTime(state, action.at),
        lastResumedAt: null,
      };
    case "RESUME":
      if (state.status !== "paused") return state;
      return {
        ...state,
        status: "recording",
        autoPaused: false,
        lowSpeedSince: null,
        lastResumedAt: action.at,
      };
    case "FINISH":
      return {
        ...state,
        status: "completed",
        completedAt: action.at,
        activeElapsedMs: state.status === "recording" ? commitActiveTime(state, action.at) : state.activeElapsedMs,
        lastResumedAt: null,
      };
    case "DISCARD":
      return { ...state, status: "discarded", lastResumedAt: null };
    case "SET_PRIVACY":
      return { ...state, routeVisibility: action.visibility };
    case "SET_AUTO_PAUSE":
      return { ...state, autoPauseEnabled: action.enabled, autoPaused: false, lowSpeedSince: null };
    case "SET_ACTIVITY_TYPE":
      return state.status === "idle" || state.status === "ready"
        ? { ...state, activityType: action.activityType }
        : state;
    case "RESTORE":
      return action.checkpoint.userId === state.userId ? action.checkpoint : state;
    default:
      return state;
  }
}

export function getActiveElapsedMs(state: OutdoorActivityState, now = Date.now()): number {
  return state.status === "recording" ? commitActiveTime(state, now) : state.activeElapsedMs;
}

export function getAveragePaceSecondsPerKm(state: OutdoorActivityState, now = Date.now()): number | null {
  if (state.distanceM < 25) return null;
  return (getActiveElapsedMs(state, now) / 1000) / (state.distanceM / 1000);
}

export function estimateOutdoorCalories(
  state: OutdoorActivityState,
  weightKg: number,
  now = Date.now(),
): number {
  const mets: Record<OutdoorActivityType, number> = { walking: 3.8, running: 8.3, cycling: 7.5 };
  const minutes = getActiveElapsedMs(state, now) / 60_000;
  return Math.max(0, Math.round((mets[state.activityType] * 3.5 * Math.max(35, weightKg) / 200) * minutes));
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return "--:--";
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
