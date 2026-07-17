// Trusted automatic dispatch using the database's atomic assignment primitive.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  enforceRateLimit,
  getClientIp,
  getCorsHeaders,
  getServiceClient,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireAdminOrInternal,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORS_METHODS = "POST, OPTIONS";
const ACTIVE_DRIVER_LOCATION_MS = 10 * 60 * 1000;

interface AssignmentActor {
  principal: SecurityPrincipal | null;
  actorUserId: string | null;
  actorType: "admin" | "service";
}

interface DeliveryJob {
  id: string;
  order_id: string | null;
  schedule_id: string | null;
  restaurant_id: string | null;
  status: string | null;
  driver_id: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
}

interface Driver {
  id: string;
  user_id: string;
  current_lat: number | null;
  current_lng: number | null;
  rating: number | null;
  total_deliveries: number | null;
}

interface ScoredDriver extends Driver {
  score: number;
  distanceKm: number;
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
  if (error instanceof HttpError) return respond(req, { error: error.code }, error.status);
  console.error("auto-assign-driver failed:", error);
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
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new HttpError(400, code);
  return value;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radiusKm = 6371;
  const latDelta = (lat2 - lat1) * Math.PI / 180;
  const lngDelta = (lng2 - lng1) * Math.PI / 180;
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(lngDelta / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function scoreDriver(driver: Driver, pickupLat: number, pickupLng: number): ScoredDriver {
  const hasLocation = driver.current_lat !== null && driver.current_lng !== null;
  const distanceKm = hasLocation
    ? calculateDistance(driver.current_lat as number, driver.current_lng as number, pickupLat, pickupLng)
    : 100;
  const distanceScore = Math.max(0, 100 * Math.exp(-distanceKm / 5));
  const ratingScore = Math.min(100, Math.max(0, Number(driver.rating || 0) * 20));
  const experienceScore = Math.min(100, Number(driver.total_deliveries || 0));
  return {
    ...driver,
    distanceKm,
    score: Math.round(distanceScore * 0.7 + ratingScore * 0.25 + experienceScore * 0.05),
  };
}

async function authenticateAssignmentActor(req: Request): Promise<AssignmentActor> {
  const principal = await requireAdminOrInternal(req);
  return principal
    ? { principal, actorUserId: principal.user.id, actorType: "admin" }
    : { principal: null, actorUserId: null, actorType: "service" };
}

async function loadDeliveryJob(
  deliveryId: string | null,
  orderId: string | null,
): Promise<DeliveryJob> {
  const service = getServiceClient();
  let query = service
    .from("delivery_jobs")
    .select("id, order_id, schedule_id, restaurant_id, status, driver_id, delivery_lat, delivery_lng");
  query = deliveryId ? query.eq("id", deliveryId) : query.eq("order_id", orderId as string);
  const { data, error } = await query.maybeSingle();
  if (error) throw new HttpError(500, "delivery_lookup_failed");
  if (!data) throw new HttpError(404, "delivery_not_found");
  return data as DeliveryJob;
}

async function loadPickup(job: DeliveryJob): Promise<{ latitude: number; longitude: number }> {
  if (!job.restaurant_id) throw new HttpError(409, "pickup_location_unavailable");
  const service = getServiceClient();
  const { data: restaurant, error } = await service
    .from("restaurants")
    .select("latitude, longitude, is_active")
    .eq("id", job.restaurant_id)
    .maybeSingle();
  if (error) throw new HttpError(500, "restaurant_lookup_failed");
  if (
    !restaurant ||
    restaurant.is_active !== true ||
    typeof restaurant.latitude !== "number" ||
    typeof restaurant.longitude !== "number" ||
    restaurant.latitude < -90 ||
    restaurant.latitude > 90 ||
    restaurant.longitude < -180 ||
    restaurant.longitude > 180
  ) {
    throw new HttpError(409, "pickup_location_unavailable");
  }
  return { latitude: restaurant.latitude, longitude: restaurant.longitude };
}

async function resolveCityId(
  requestedCityId: string | null,
  pickup: { latitude: number; longitude: number },
): Promise<string> {
  const service = getServiceClient();
  const { data: cities, error } = await service
    .from("cities")
    .select("id, latitude, longitude")
    .eq("is_active", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (error) throw new HttpError(500, "city_lookup_failed");
  const ranked = (cities || [])
    .filter((city) => typeof city.latitude === "number" && typeof city.longitude === "number")
    .map((city) => ({
      id: city.id,
      distanceKm: calculateDistance(
        pickup.latitude,
        pickup.longitude,
        city.latitude as number,
        city.longitude as number,
      ),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm);
  if (ranked.length === 0 || ranked[0].distanceKm > 150) {
    throw new HttpError(409, "delivery_city_unresolved");
  }
  if (requestedCityId && requestedCityId !== ranked[0].id) {
    throw new HttpError(409, "delivery_city_mismatch");
  }
  return ranked[0].id;
}

async function notifyDriver(driverUserId: string, deliveryId: string): Promise<void> {
  try {
    const service = getServiceClient();
    const { error } = await service.functions.invoke("send-notification", {
      body: {
        userId: driverUserId,
        type: "new_delivery",
        title: "New Delivery Assignment",
        body: "You have been assigned a new delivery order",
        data: { deliveryId },
      },
    });
    if (error) console.error("Driver assignment notification failed:", error.message);
  } catch (error) {
    console.error("Driver assignment notification unavailable:", error);
  }
}

async function assignDriver(
  req: Request,
  actor: AssignmentActor,
  job: DeliveryJob,
  cityId: string,
  pickup: { latitude: number; longitude: number },
): Promise<Response> {
  if (job.driver_id) {
    return respond(req, {
      success: true,
      driverId: job.driver_id,
      message: "driver_already_assigned",
    });
  }
  if (job.status !== "pending") throw new HttpError(409, "delivery_not_assignable");

  const service = getServiceClient();
  const recent = new Date(Date.now() - ACTIVE_DRIVER_LOCATION_MS).toISOString();
  const { data: drivers, error } = await service
    .from("drivers")
    .select("id, user_id, current_lat, current_lng, rating, total_deliveries")
    .eq("city_id", cityId)
    .eq("is_online", true)
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .is("current_job_id", null)
    .or(`last_location_at.gte.${recent},last_location_update.gte.${recent}`)
    .limit(100);
  if (error) throw new HttpError(500, "driver_lookup_failed");

  const candidates = (drivers || [])
    .map((driver) => scoreDriver(driver as Driver, pickup.latitude, pickup.longitude))
    .sort((left, right) => right.score - left.score || left.distanceKm - right.distanceKm);
  if (candidates.length === 0) {
    await recordSecurityEvent(req, {
      eventType: "fleet.auto_assignment_unavailable",
      category: "edge_function",
      severity: "low",
      outcome: "failure",
      principal: actor.principal,
      actorUserId: actor.actorUserId,
      actorType: actor.actorType,
      action: "auto_assign_driver",
      resourceType: "delivery_job",
      resourceId: job.id,
      metadata: { city_id: cityId, reason: "no_available_drivers" },
    });
    return respond(req, {
      success: false,
      queued: true,
      message: "no_available_drivers",
    }, 202);
  }

  for (const candidate of candidates) {
    const { data, error: assignmentError } = await service.rpc("assign_driver_with_lock", {
      p_job_id: job.id,
      p_driver_id: candidate.id,
    });
    if (assignmentError) {
      console.error("Atomic driver assignment RPC failed:", assignmentError.message);
      throw new HttpError(500, "assignment_failed");
    }
    const result = data && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown>
      : {};
    if (result.success === true) {
      await recordSecurityEvent(req, {
        eventType: "fleet.driver_auto_assigned",
        category: "data_change",
        severity: "info",
        outcome: "success",
        principal: actor.principal,
        actorUserId: actor.actorUserId,
        actorType: actor.actorType,
        action: "auto_assign_driver",
        resourceType: "delivery_job",
        resourceId: job.id,
        metadata: {
          city_id: cityId,
          driver_id: candidate.id,
          assignment_score: candidate.score,
        },
      });
      await notifyDriver(candidate.user_id, job.id);
      return respond(req, {
        success: true,
        driverId: candidate.id,
        score: candidate.score,
        message: "driver_assigned",
      });
    }

    const code = typeof result.code === "string" ? result.code : "ASSIGNMENT_FAILED";
    if (code === "ALREADY_ASSIGNED" && typeof result.assigned_driver_id === "string") {
      return respond(req, {
        success: true,
        driverId: result.assigned_driver_id,
        message: "driver_already_assigned",
      });
    }
    if (code === "DRIVER_BUSY" || code === "DRIVER_UNAVAILABLE") continue;
    if (code === "LOCKED") throw new HttpError(409, "assignment_in_progress");
    if (code === "INVALID_STATE") throw new HttpError(409, "delivery_not_assignable");
    if (code === "NOT_FOUND") throw new HttpError(404, "delivery_not_found");
    throw new HttpError(409, "assignment_failed");
  }

  return respond(req, {
    success: false,
    queued: true,
    message: "no_available_drivers",
  }, 202);
}

serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;
  try {
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
    const ip = getClientIp(req) || "unknown";
    await enforceRateLimit(req, "auto-assign-driver:ip", ip, 60, 60);
    const actor = await authenticateAssignmentActor(req);
    await enforceRateLimit(
      req,
      "auto-assign-driver:actor",
      actor.actorUserId || `internal:${ip}`,
      30,
      60,
    );

    const body = asObject(await readJsonBody<unknown>(req, 8 * 1024));
    assertAllowedKeys(body, ["deliveryId", "orderId", "cityId"]);
    const deliveryId = body.deliveryId === undefined ? null : requireUuid(body.deliveryId, "invalid_delivery_id");
    const orderId = body.orderId === undefined ? null : requireUuid(body.orderId, "invalid_order_id");
    if ((deliveryId ? 1 : 0) + (orderId ? 1 : 0) !== 1) {
      throw new HttpError(400, "exactly_one_delivery_identifier_required");
    }
    const requestedCityId = body.cityId === undefined ? null : requireUuid(body.cityId, "invalid_city_id");
    const job = await loadDeliveryJob(deliveryId, orderId);
    const pickup = await loadPickup(job);
    const cityId = await resolveCityId(requestedCityId, pickup);
    return await assignDriver(req, actor, job, cityId, pickup);
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
      await recordSecurityEvent(req, {
        eventType: "authorization.auto_assignment_denied",
        category: "authorization",
        severity: "high",
        outcome: "denied",
        actorType: "anonymous",
        action: "auto_assign_driver",
        metadata: { reason: error.code },
      });
    }
    return safeError(req, error);
  }
});
