import type { OutdoorActivityType, OutdoorLocationPoint } from "@/lib/outdoor-activity";
import { haversineDistanceM } from "@/lib/outdoor-activity";

export type OutdoorImportFormat = "gpx" | "tcx" | "fit";

export interface OutdoorActivityImport {
  format: OutdoorImportFormat;
  externalId: string | null;
  activityType: OutdoorActivityType;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceM: number;
  calories: number | null;
  calorieSource: "imported_file";
  points: OutdoorLocationPoint[];
  fingerprint: string;
}

export interface FitImportAdapter {
  parse(file: File): Promise<OutdoorActivityImport>;
}

function text(element: Element | null, selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = element?.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }
  return null;
}

function activityType(value: string | null): OutdoorActivityType {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("run")) return "running";
  if (normalized.includes("cycl") || normalized.includes("bike") || normalized.includes("biking")) return "cycling";
  return "walking";
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createOutdoorFingerprint(input: {
  source: string;
  externalId?: string | null;
  startedAt: string;
  durationSeconds: number;
  distanceM: number;
}): string {
  return hashString([
    input.source,
    input.externalId ?? "",
    new Date(input.startedAt).toISOString(),
    Math.round(input.durationSeconds),
    Math.round(input.distanceM),
  ].join("|"));
}

function parseXml(xmlText: string): Document {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("The activity file is not valid XML.");
  return document;
}

function sumDistance(points: OutdoorLocationPoint[]) {
  return points.slice(1).reduce((sum, point, index) => sum + haversineDistanceM(points[index], point), 0);
}

function finalizeImport(
  format: "gpx" | "tcx",
  type: OutdoorActivityType,
  points: OutdoorLocationPoint[],
  distanceM?: number | null,
  calories?: number | null,
): OutdoorActivityImport {
  if (points.length < 2) throw new Error("The activity needs at least two timed route points.");
  const startedAt = new Date(points[0].timestamp).toISOString();
  const endedAt = new Date(points.at(-1)!.timestamp).toISOString();
  const durationSeconds = Math.max(1, (points.at(-1)!.timestamp - points[0].timestamp) / 1000);
  const resolvedDistance = distanceM && distanceM > 0 ? distanceM : sumDistance(points);
  return {
    format,
    externalId: null,
    activityType: type,
    startedAt,
    endedAt,
    durationSeconds,
    distanceM: resolvedDistance,
    calories: calories ?? null,
    calorieSource: "imported_file",
    points,
    fingerprint: createOutdoorFingerprint({ source: `import_${format}`, startedAt, durationSeconds, distanceM: resolvedDistance }),
  };
}

export function parseGpx(xmlText: string): OutdoorActivityImport {
  const document = parseXml(xmlText);
  const type = activityType(text(document.documentElement, ["type", "name"]));
  const points = Array.from(document.querySelectorAll("trkpt")).flatMap((node) => {
    const latitude = Number(node.getAttribute("lat"));
    const longitude = Number(node.getAttribute("lon"));
    const timestamp = Date.parse(text(node, ["time"]) ?? "");
    if (![latitude, longitude, timestamp].every(Number.isFinite)) return [];
    return [{
      latitude,
      longitude,
      accuracy: 10,
      altitude: Number(text(node, ["ele"])) || null,
      heartRate: Number(text(node, ["hr", "TrackPointExtension hr"])) || null,
      timestamp,
    } satisfies OutdoorLocationPoint];
  });
  return finalizeImport("gpx", type, points);
}

export function parseTcx(xmlText: string): OutdoorActivityImport {
  const document = parseXml(xmlText);
  const activity = document.querySelector("Activity");
  const type = activityType(activity?.getAttribute("Sport") ?? null);
  const points = Array.from(document.querySelectorAll("Trackpoint")).flatMap((node) => {
    const latitude = Number(text(node, ["LatitudeDegrees"]));
    const longitude = Number(text(node, ["LongitudeDegrees"]));
    const timestamp = Date.parse(text(node, ["Time"]) ?? "");
    if (![latitude, longitude, timestamp].every(Number.isFinite)) return [];
    return [{
      latitude,
      longitude,
      accuracy: 10,
      altitude: Number(text(node, ["AltitudeMeters"])) || null,
      heartRate: Number(text(node, ["HeartRateBpm Value", "HeartRateBpm"])) || null,
      timestamp,
    } satisfies OutdoorLocationPoint];
  });
  const distance = Number(text(activity, ["Lap DistanceMeters", "DistanceMeters"]));
  const calories = Number(text(activity, ["Lap Calories", "Calories"]));
  return finalizeImport("tcx", type, points, distance, calories);
}

export async function importOutdoorActivity(file: File, fitAdapter?: FitImportAdapter): Promise<OutdoorActivityImport> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "fit") {
    if (!fitAdapter) throw new Error("FIT import needs the Nutrio native FIT adapter.");
    return fitAdapter.parse(file);
  }
  const contents = await file.text();
  if (extension === "gpx") return parseGpx(contents);
  if (extension === "tcx") return parseTcx(contents);
  throw new Error("Choose a GPX, TCX, or FIT activity file.");
}
