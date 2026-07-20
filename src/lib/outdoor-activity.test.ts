import { Encoder, Profile } from "@garmin/fitsdk";
import { describe, expect, it } from "vitest";

import {
  createOutdoorActivityState,
  getActiveElapsedMs,
  haversineDistanceM,
  outdoorActivityReducer,
} from "@/lib/outdoor-activity";
import { createOutdoorFingerprint, parseGpx, parseTcx } from "@/lib/outdoor-activity-import";
import { garminFitImportAdapter } from "@/lib/fit-import-adapter";

const point = (latitude: number, longitude: number, timestamp: number, speed = 2) => ({
  latitude,
  longitude,
  timestamp,
  speed,
  accuracy: 8,
});

describe("outdoor activity recording", () => {
  it("tracks active time and excludes a manual pause", () => {
    let state = createOutdoorActivityState("user-1", "running", "local-1");
    state = outdoorActivityReducer(state, { type: "START", at: 1_000 });
    state = outdoorActivityReducer(state, { type: "PAUSE", at: 11_000 });
    state = outdoorActivityReducer(state, { type: "RESUME", at: 21_000 });
    expect(getActiveElapsedMs(state, 31_000)).toBe(20_000);
  });

  it("adds plausible distance and rejects a GPS teleport", () => {
    let state = createOutdoorActivityState("user-1", "walking", "local-2");
    state = outdoorActivityReducer(state, { type: "START", at: 1_000 });
    state = outdoorActivityReducer(state, { type: "LOCATION", point: point(25.2854, 51.531, 1_000) });
    state = outdoorActivityReducer(state, { type: "LOCATION", point: point(25.2855, 51.531, 11_000) });
    const distance = state.distanceM;
    state = outdoorActivityReducer(state, { type: "LOCATION", point: point(25.5, 51.7, 12_000) });
    expect(distance).toBeGreaterThan(8);
    expect(state.distanceM).toBe(distance);
  });

  it("calculates distance with haversine", () => {
    expect(haversineDistanceM(point(25.2854, 51.531, 0), point(25.2944, 51.531, 1_000))).toBeCloseTo(1_000, -1);
  });

  it("changes activity before starting but not during a recording", () => {
    let state = createOutdoorActivityState("user-1", "walking", "local-3");
    state = outdoorActivityReducer(state, { type: "SET_ACTIVITY_TYPE", activityType: "cycling" });
    expect(state.activityType).toBe("cycling");
    state = outdoorActivityReducer(state, { type: "START", at: 1_000 });
    state = outdoorActivityReducer(state, { type: "SET_ACTIVITY_TYPE", activityType: "running" });
    expect(state.activityType).toBe("cycling");
  });

  it("auto-pauses after sustained low speed and resumes on movement", () => {
    let state = createOutdoorActivityState("user-1", "running", "local-4");
    state = outdoorActivityReducer(state, { type: "START", at: 1_000 });
    state = outdoorActivityReducer(state, { type: "LOCATION", point: point(25.2854, 51.531, 1_000, 0) });
    state = outdoorActivityReducer(state, { type: "LOCATION", point: point(25.2854, 51.531, 12_000, 0) });
    expect(state.status).toBe("paused");
    expect(state.autoPaused).toBe(true);
    state = outdoorActivityReducer(state, { type: "LOCATION", point: point(25.2855, 51.531, 22_000, 2) });
    expect(state.status).toBe("recording");
    expect(state.autoPaused).toBe(false);
  });
});

describe("outdoor imports", () => {
  it("parses GPX and creates a stable fingerprint", () => {
    const parsed = parseGpx(`<?xml version="1.0"?><gpx><trk><name>Morning Run</name><type>running</type><trkseg>
      <trkpt lat="25.2854" lon="51.5310"><ele>10</ele><time>2026-07-19T05:00:00Z</time></trkpt>
      <trkpt lat="25.2864" lon="51.5310"><ele>12</ele><time>2026-07-19T05:01:00Z</time></trkpt>
    </trkseg></trk></gpx>`);
    expect(parsed.activityType).toBe("running");
    expect(parsed.points).toHaveLength(2);
    expect(parsed.distanceM).toBeGreaterThan(100);
    expect(parsed.fingerprint).toBe(createOutdoorFingerprint({
      source: "import_gpx",
      startedAt: parsed.startedAt,
      durationSeconds: parsed.durationSeconds,
      distanceM: parsed.distanceM,
    }));
  });

  it("parses TCX values", () => {
    const parsed = parseTcx(`<TrainingCenterDatabase><Activities><Activity Sport="Biking"><Lap StartTime="2026-07-19T05:00:00Z"><DistanceMeters>500</DistanceMeters><Calories>40</Calories><Track>
      <Trackpoint><Time>2026-07-19T05:00:00Z</Time><Position><LatitudeDegrees>25.2854</LatitudeDegrees><LongitudeDegrees>51.531</LongitudeDegrees></Position></Trackpoint>
      <Trackpoint><Time>2026-07-19T05:02:00Z</Time><Position><LatitudeDegrees>25.2864</LatitudeDegrees><LongitudeDegrees>51.531</LongitudeDegrees></Position></Trackpoint>
    </Track></Lap></Activity></Activities></TrainingCenterDatabase>`);
    expect(parsed.activityType).toBe("cycling");
    expect(parsed.distanceM).toBe(500);
    expect(parsed.calories).toBe(40);
  });

  it("decodes a real FIT binary with Garmin's SDK", async () => {
    const encoder = new Encoder();
    const start = new Date("2026-07-19T05:00:00Z");
    const end = new Date("2026-07-19T05:05:00Z");
    const semicircles = (degrees: number) => Math.round(degrees * (2 ** 31 / 180));

    encoder.onMesg(Profile.MesgNum.FILE_ID, {
      type: "activity",
      manufacturer: "development",
      product: 1,
      serialNumber: 12345,
      timeCreated: start,
    } as never);
    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: start,
      positionLat: semicircles(25.2854),
      positionLong: semicircles(51.531),
      altitude: 12,
      heartRate: 120,
    } as never);
    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: end,
      positionLat: semicircles(25.2894),
      positionLong: semicircles(51.531),
      altitude: 15,
      heartRate: 135,
    } as never);
    encoder.onMesg(Profile.MesgNum.SESSION, {
      timestamp: end,
      startTime: start,
      sport: "running",
      totalTimerTime: 300,
      totalDistance: 500,
      totalCalories: 44,
    } as never);

    const file = new File([encoder.close()], "morning-run.fit", { type: "application/octet-stream" });
    const parsed = await garminFitImportAdapter.parse(file);

    expect(parsed.format).toBe("fit");
    expect(parsed.activityType).toBe("running");
    expect(parsed.points).toHaveLength(2);
    expect(parsed.distanceM).toBe(500);
    expect(parsed.durationSeconds).toBe(300);
    expect(parsed.calories).toBe(44);
    expect(parsed.points[0].latitude).toBeCloseTo(25.2854, 4);
  });
});
