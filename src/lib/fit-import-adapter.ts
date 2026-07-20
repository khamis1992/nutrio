import {
  Decoder,
  Stream,
  type FileIdMesg,
  type RecordMesg,
  type SessionMesg,
} from "@garmin/fitsdk";

import {
  createOutdoorFingerprint,
  type FitImportAdapter,
  type OutdoorActivityImport,
} from "@/lib/outdoor-activity-import";
import {
  haversineDistanceM,
  type OutdoorActivityType,
  type OutdoorLocationPoint,
} from "@/lib/outdoor-activity";

const SEMICIRCLES_TO_DEGREES = 180 / 2 ** 31;

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestampMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const number = finiteNumber(value);
  if (number === null) return null;
  return number > 10_000_000_000 ? number : number * 1_000 + 631_065_600_000;
}

function resolveActivityType(sport: unknown): OutdoorActivityType {
  const normalized = String(sport ?? "").toLowerCase();
  if (normalized.includes("run")) return "running";
  if (normalized.includes("cycl") || normalized.includes("bike")) return "cycling";
  return "walking";
}

function toPoint(record: RecordMesg): OutdoorLocationPoint | null {
  const latitude = finiteNumber(record.positionLat);
  const longitude = finiteNumber(record.positionLong);
  const timestamp = timestampMs(record.timestamp);
  if (latitude === null || longitude === null || timestamp === null) return null;

  return {
    latitude: latitude * SEMICIRCLES_TO_DEGREES,
    longitude: longitude * SEMICIRCLES_TO_DEGREES,
    accuracy: finiteNumber(record.gpsAccuracy) ?? 10,
    altitude: finiteNumber(record.enhancedAltitude ?? record.altitude),
    speed: finiteNumber(record.enhancedSpeed ?? record.speed),
    heartRate: finiteNumber(record.heartRate),
    timestamp,
  };
}

function routeDistance(points: OutdoorLocationPoint[]): number {
  return points.slice(1).reduce(
    (total, point, index) => total + haversineDistanceM(points[index], point),
    0,
  );
}

function externalId(fileId: FileIdMesg | undefined, startedAt: string): string | null {
  const serial = fileId?.serialNumber;
  if (serial === undefined || serial === null) return null;
  return `${String(serial)}:${startedAt}`;
}

function buildImport(
  records: RecordMesg[],
  session: SessionMesg | undefined,
  fileId: FileIdMesg | undefined,
): OutdoorActivityImport {
  const points = records.map(toPoint).filter((point): point is OutdoorLocationPoint => point !== null);
  if (points.length < 2) {
    throw new Error("The FIT activity needs at least two timed GPS points.");
  }

  points.sort((left, right) => left.timestamp - right.timestamp);
  const startedAt = new Date(points[0].timestamp).toISOString();
  const endedAt = new Date(points.at(-1)!.timestamp).toISOString();
  const sessionDuration = finiteNumber(session?.totalTimerTime ?? session?.totalElapsedTime);
  const durationSeconds = Math.max(
    1,
    sessionDuration ?? (points.at(-1)!.timestamp - points[0].timestamp) / 1_000,
  );
  const sessionDistance = finiteNumber(session?.totalDistance);
  const distanceM = sessionDistance && sessionDistance > 0 ? sessionDistance : routeDistance(points);
  const calories = finiteNumber(session?.totalCalories);
  const resolvedExternalId = externalId(fileId, startedAt);

  return {
    format: "fit",
    externalId: resolvedExternalId,
    activityType: resolveActivityType(session?.sport),
    startedAt,
    endedAt,
    durationSeconds,
    distanceM,
    calories,
    calorieSource: "imported_file",
    points,
    fingerprint: createOutdoorFingerprint({
      source: "import_fit",
      externalId: resolvedExternalId,
      startedAt,
      durationSeconds,
      distanceM,
    }),
  };
}

export const garminFitImportAdapter: FitImportAdapter = {
  async parse(file) {
    const stream = Stream.fromArrayBuffer(await file.arrayBuffer());
    const decoder = new Decoder(stream);
    if (!decoder.isFIT()) throw new Error("This is not a valid FIT file.");

    const { messages, errors } = decoder.read({
      applyScaleAndOffset: true,
      convertDateTimesToDates: true,
      convertTypesToStrings: true,
      mergeHeartRates: true,
    });
    if (errors.length > 0) {
      throw new Error(errors[0]?.message || "The FIT file could not be decoded.");
    }

    return buildImport(
      messages.recordMesgs ?? [],
      messages.sessionMesgs?.[0],
      messages.fileIdMesgs?.[0],
    );
  },
};
