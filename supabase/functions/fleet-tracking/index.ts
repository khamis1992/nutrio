// Fleet location tracking with driver ownership and fleet city scoping.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  getClientIp,
  getCorsHeaders,
  getServiceClient,
  hasAdminAssurance,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FLEET_ROLES = new Set(["super_admin", "fleet_manager"]);
const CORS_METHODS = "GET, POST, OPTIONS";

interface FleetActor {
  principal: SecurityPrincipal;
  managerId: string;
  authUserId: string;
  role: "super_admin" | "fleet_manager";
  assignedCities: string[];
}

interface DriverActor {
  principal: SecurityPrincipal;
  driver: {
    id: string;
    user_id: string;
    city_id: string | null;
    is_active: boolean | null;
    approval_status: string | null;
    status: string | null;
  };
}

function respond(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return jsonResponse(req, body, status, {
    "Access-Control-Allow-Methods": CORS_METHODS,
    ...extraHeaders,
  });
}

function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, {
    status: 204,
    headers: { ...getCorsHeaders(req), "Access-Control-Allow-Methods": CORS_METHODS },
  });
}

function safeError(req: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    return respond(req, { error: error.code }, error.status);
  }
  console.error("fleet-tracking failed:", error);
  return respond(req, { error: "internal_error" }, 500);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_request_body");
  }
  return value as Record<string, unknown>;
}

function assertAllowedKeys(body: Record<string, unknown>, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(body).some((key) => !allowedSet.has(key))) {
    throw new HttpError(400, "unexpected_request_field");
  }
}

function requireUuid(value: unknown, code: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new HttpError(400, code);
  }
  return value;
}

function optionalFiniteNumber(
  value: unknown,
  code: string,
  minimum: number,
  maximum: number,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new HttpError(400, code);
  }
  return value;
}

function normalizeCityIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && UUID_PATTERN.test(item)))];
}

async function authenticateFleetActor(req: Request): Promise<FleetActor> {
  const principal = await authenticateRequest(req);
  const service = getServiceClient();
  const { data: manager, error } = await service
    .from("fleet_managers")
    .select("id, auth_user_id, role, assigned_city_ids, is_active")
    .eq("auth_user_id", principal.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new HttpError(503, "authorization_unavailable");

  if (hasAdminAssurance(principal)) {
    return {
      principal,
      managerId: manager?.id || principal.user.id,
      authUserId: principal.user.id,
      role: "super_admin",
      assignedCities: [],
    };
  }
  if (!manager || !FLEET_ROLES.has(String(manager.role))) {
    throw new HttpError(403, "fleet_operator_required");
  }

  return {
    principal,
    managerId: manager.id,
    authUserId: principal.user.id,
    role: manager.role as FleetActor["role"],
    assignedCities: normalizeCityIds(manager.assigned_city_ids),
  };
}

async function authenticateDriverActor(req: Request): Promise<DriverActor> {
  const principal = await authenticateRequest(req);
  const service = getServiceClient();
  const { data: driver, error } = await service
    .from("drivers")
    .select("id, user_id, city_id, is_active, approval_status, status")
    .eq("user_id", principal.user.id)
    .maybeSingle();
  if (error) throw new HttpError(503, "authorization_unavailable");
  if (!driver) throw new HttpError(403, "driver_required");
  return { principal, driver };
}

async function requireDriverOwnership(
  req: Request,
  actor: DriverActor,
  requestedDriverId: string,
): Promise<void> {
  if (actor.driver.id === requestedDriverId) return;
  await recordSecurityEvent(req, {
    eventType: "authorization.driver_spoofing_blocked",
    category: "authorization",
    severity: "high",
    outcome: "blocked",
    principal: actor.principal,
    actorType: "driver",
    action: "update_other_driver",
    resourceType: "driver",
    resourceId: requestedDriverId,
  });
  throw new HttpError(403, "forbidden");
}

function assertDriverMayTrack(actor: DriverActor): void {
  const status = actor.driver.status || "";
  if (
    actor.driver.is_active !== true ||
    actor.driver.approval_status !== "approved" ||
    status === "suspended" ||
    status === "inactive"
  ) {
    throw new HttpError(403, "driver_not_active");
  }
}

async function assertCityAccess(
  req: Request,
  actor: FleetActor,
  cityId: string | null,
  resourceType: string,
  resourceId?: string,
): Promise<void> {
  if (actor.role === "super_admin") return;
  if (cityId && actor.assignedCities.includes(cityId)) return;

  await recordSecurityEvent(req, {
    eventType: "authorization.fleet_city_access_denied",
    category: "authorization",
    severity: "high",
    outcome: "denied",
    principal: actor.principal,
    actorUserId: actor.authUserId,
    actorRole: actor.role,
    actorType: "admin",
    action: "access_fleet_city_object",
    resourceType,
    resourceId,
    metadata: { city_id: cityId },
  });
  throw new HttpError(403, "city_access_denied");
}

async function getCityFilter(
  req: Request,
  actor: FleetActor,
  requestedCityId: string | null,
): Promise<string[] | null> {
  if (requestedCityId && !UUID_PATTERN.test(requestedCityId)) {
    throw new HttpError(400, "invalid_city_id");
  }
  if (actor.role === "super_admin") return requestedCityId ? [requestedCityId] : null;
  if (actor.assignedCities.length === 0) {
    await assertCityAccess(req, actor, null, "city");
  }
  if (requestedCityId) {
    await assertCityAccess(req, actor, requestedCityId, "city", requestedCityId);
    return [requestedCityId];
  }
  return actor.assignedCities;
}

function parseClientTimestamp(value: unknown): string {
  if (value === undefined || value === null) return new Date().toISOString();
  if (typeof value !== "string" || value.length > 40) {
    throw new HttpError(400, "invalid_timestamp");
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || Math.abs(Date.now() - parsed) > 5 * 60 * 1000) {
    throw new HttpError(400, "invalid_timestamp");
  }
  return new Date(parsed).toISOString();
}

function parsePoint(value: unknown): { latitude: number; longitude: number } | null {
  if (typeof value === "string") {
    const match = value.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
    if (match) return { longitude: Number(match[1]), latitude: Number(match[2]) };
  }
  if (value && typeof value === "object" && "coordinates" in value) {
    const coordinates = (value as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const longitude = Number(coordinates[0]);
      const latitude = Number(coordinates[1]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
    }
  }
  return null;
}

async function handleLocationUpdate(req: Request): Promise<Response> {
  const actor = await authenticateDriverActor(req);
  const body = asObject(await readJsonBody<unknown>(req, 8 * 1024));
  assertAllowedKeys(body, [
    "driverId",
    "latitude",
    "longitude",
    "accuracy",
    "speed",
    "heading",
    "batteryLevel",
    "timestamp",
  ]);

  const driverId = requireUuid(body.driverId, "invalid_driver_id");
  await requireDriverOwnership(req, actor, driverId);
  assertDriverMayTrack(actor);
  await enforceRateLimit(req, "fleet-tracking:driver-location", driverId, 1, 5);

  const latitude = optionalFiniteNumber(body.latitude, "invalid_latitude", -90, 90);
  const longitude = optionalFiniteNumber(body.longitude, "invalid_longitude", -180, 180);
  if (latitude === null || longitude === null) throw new HttpError(400, "coordinates_required");
  const accuracy = optionalFiniteNumber(body.accuracy, "invalid_accuracy", 0, 10_000);
  const speed = optionalFiniteNumber(body.speed, "invalid_speed", 0, 350);
  const heading = optionalFiniteNumber(body.heading, "invalid_heading", 0, 360);
  const batteryLevel = optionalFiniteNumber(body.batteryLevel, "invalid_battery_level", 0, 100);
  const recordedAt = parseClientTimestamp(body.timestamp);
  const now = new Date().toISOString();
  const service = getServiceClient();

  const { data: updated, error: updateError } = await service
    .from("drivers")
    .update({
      current_lat: latitude,
      current_lng: longitude,
      current_location: `POINT(${longitude} ${latitude})`,
      last_location_at: now,
      last_location_update: now,
      is_online: true,
    })
    .eq("id", driverId)
    .eq("user_id", actor.principal.user.id)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) throw new HttpError(500, "location_update_failed");

  const { error: historyError } = await service.from("driver_locations").insert({
    driver_id: driverId,
    location: `POINT(${longitude} ${latitude})`,
    accuracy_meters: accuracy,
    speed_kmh: speed,
    heading,
    timestamp: recordedAt,
  });
  if (historyError) {
    console.error("Driver location history insert failed:", historyError.message);
    throw new HttpError(500, "location_history_failed");
  }

  let nextUpdateInterval = speed !== null && speed < 1 ? 30 : 5;
  if (batteryLevel !== null && batteryLevel < 20) nextUpdateInterval = 60;
  return respond(req, { success: true, serverTime: now, nextUpdateInterval });
}

async function handleHeartbeat(req: Request): Promise<Response> {
  const actor = await authenticateDriverActor(req);
  const body = asObject(await readJsonBody<unknown>(req, 4 * 1024));
  assertAllowedKeys(body, ["driverId", "isOnline"]);
  const driverId = requireUuid(body.driverId, "invalid_driver_id");
  await requireDriverOwnership(req, actor, driverId);
  assertDriverMayTrack(actor);
  if (body.isOnline !== undefined && typeof body.isOnline !== "boolean") {
    throw new HttpError(400, "invalid_online_status");
  }
  await enforceRateLimit(req, "fleet-tracking:driver-heartbeat", driverId, 12, 60);

  const now = new Date().toISOString();
  const isOnline = body.isOnline !== false;
  const service = getServiceClient();
  const { data, error } = await service
    .from("drivers")
    .update({ is_online: isOnline, last_location_at: now, last_location_update: now })
    .eq("id", driverId)
    .eq("user_id", actor.principal.user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new HttpError(500, "heartbeat_update_failed");
  return respond(req, { success: true, timestamp: now });
}

async function handleGetTrackingDrivers(req: Request, actor: FleetActor): Promise<Response> {
  await enforceRateLimit(req, "fleet-tracking:fleet-read", actor.managerId, 100, 60);
  const url = new URL(req.url);
  const cityFilter = await getCityFilter(req, actor, url.searchParams.get("cityId"));
  const service = getServiceClient();
  let query = service
    .from("drivers")
    .select(`
      id, full_name, city_id, current_lat, current_lng, last_location_at,
      last_location_update, is_online,
      vehicles!vehicles_assigned_driver_id_fkey(id, plate_number, type)
    `)
    .eq("is_online", true)
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .not("current_lat", "is", null)
    .not("current_lng", "is", null)
    .gte("last_location_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  if (cityFilter) query = query.in("city_id", cityFilter);

  const { data, error } = await query;
  if (error) {
    console.error("Fleet tracking query failed:", error.message);
    throw new HttpError(500, "tracking_query_failed");
  }

  const drivers = (data || []).map((driver: Record<string, unknown>) => {
    const vehicles = Array.isArray(driver.vehicles) ? driver.vehicles : driver.vehicles ? [driver.vehicles] : [];
    const vehicle = vehicles[0] as Record<string, unknown> | undefined;
    return {
      driverId: driver.id,
      driverName: driver.full_name,
      cityId: driver.city_id,
      latitude: driver.current_lat,
      longitude: driver.current_lng,
      isOnline: driver.is_online,
      lastUpdated: driver.last_location_at || driver.last_location_update,
      vehicleId: vehicle?.id || null,
      vehiclePlate: vehicle?.plate_number || null,
      vehicleType: vehicle?.type || null,
    };
  });
  return respond(req, drivers);
}

async function handleGetLocationHistory(
  req: Request,
  actor: FleetActor,
  driverId: string,
): Promise<Response> {
  requireUuid(driverId, "invalid_driver_id");
  await enforceRateLimit(req, "fleet-tracking:fleet-history", actor.managerId, 60, 60);
  const url = new URL(req.url);
  const startRaw = url.searchParams.get("startTime");
  const endRaw = url.searchParams.get("endTime");
  if (!startRaw || !endRaw || startRaw.length > 40 || endRaw.length > 40) {
    throw new HttpError(400, "time_range_required");
  }
  const start = Date.parse(startRaw);
  const end = Date.parse(endRaw);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new HttpError(400, "invalid_time_range");
  }
  if (end - start > 24 * 60 * 60 * 1000 || end > Date.now() + 60_000) {
    throw new HttpError(400, "invalid_time_range");
  }

  const service = getServiceClient();
  const { data: driver, error: driverError } = await service
    .from("drivers")
    .select("id, city_id, full_name")
    .eq("id", driverId)
    .maybeSingle();
  if (driverError) throw new HttpError(500, "driver_lookup_failed");
  if (!driver) throw new HttpError(404, "driver_not_found");
  await assertCityAccess(req, actor, driver.city_id, "driver", driverId);

  const { data: locations, error } = await service
    .from("driver_locations")
    .select("location, accuracy_meters, speed_kmh, heading, timestamp")
    .eq("driver_id", driverId)
    .gte("timestamp", new Date(start).toISOString())
    .lte("timestamp", new Date(end).toISOString())
    .order("timestamp", { ascending: true })
    .limit(1000);
  if (error) {
    console.error("Driver location history query failed:", error.message);
    throw new HttpError(500, "location_history_query_failed");
  }

  const history = (locations || []).flatMap((location: Record<string, unknown>) => {
    const point = parsePoint(location.location);
    if (!point) return [];
    return [{
      ...point,
      accuracy: location.accuracy_meters,
      speed: location.speed_kmh,
      heading: location.heading,
      recordedAt: location.timestamp,
    }];
  });
  return respond(req, {
    driverId,
    driverName: driver.full_name,
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
    totalPoints: history.length,
    locations: history,
  });
}

serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;

  try {
    const ip = getClientIp(req) || "unknown";
    await enforceRateLimit(req, "fleet-tracking:ip", ip, 240, 60);
    const path = new URL(req.url).pathname
      .replace(/^\/fleet-tracking\/?/, "")
      .split("/")
      .filter(Boolean);

    if (req.method === "POST" && path.join("/") === "drivers/location/update") {
      return await handleLocationUpdate(req);
    }
    if (req.method === "POST" && path.join("/") === "drivers/heartbeat") {
      return await handleHeartbeat(req);
    }

    const actor = await authenticateFleetActor(req);
    if (req.method === "GET" && path.join("/") === "fleet/tracking/drivers") {
      return await handleGetTrackingDrivers(req, actor);
    }
    if (
      req.method === "GET" &&
      path.length === 5 &&
      path[0] === "fleet" &&
      path[1] === "tracking" &&
      path[2] === "drivers" &&
      path[4] === "history"
    ) {
      return await handleGetLocationHistory(req, actor, path[3]);
    }
    throw new HttpError(404, "not_found");
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
      await recordSecurityEvent(req, {
        eventType: "authorization.fleet_tracking_request_denied",
        category: "authorization",
        severity: error.status === 403 ? "high" : "medium",
        outcome: "denied",
        actorType: "anonymous",
        action: "fleet_tracking_request",
        metadata: { reason: error.code },
      });
    }
    return safeError(req, error);
  }
});
