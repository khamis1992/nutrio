// Fleet driver management with role, city, and object authorization.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  getClientIp,
  getCorsHeaders,
  getServiceClient,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireMfaAssurance,
  type SecurityPrincipal,
} from "../_shared/security.ts";
import {
  assertSignupProvisioningGrantConsumed,
  clearSignupProvisioningMetadata,
  issueSignupProvisioningGrant,
} from "../_shared/signupProvisioning.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/;
const CORS_METHODS = "GET, POST, PUT, PATCH, OPTIONS";
const FLEET_ROLES = new Set(["super_admin", "fleet_manager"]);

interface FleetActor {
  principal: SecurityPrincipal;
  managerId: string | null;
  authUserId: string;
  role: "super_admin" | "fleet_manager";
  assignedCities: string[];
}

type JsonObject = Record<string, unknown>;

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
  console.error("fleet-drivers failed:", error);
  return respond(req, { error: "internal_error" }, 500);
}

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_request_body");
  }
  return value as JsonObject;
}

function assertAllowedKeys(body: JsonObject, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(body).some((key) => !allowedSet.has(key))) {
    throw new HttpError(400, "unexpected_request_field");
  }
}

function requireUuid(value: unknown, code: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new HttpError(400, code);
  return value;
}

function optionalUuid(value: unknown, code: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return requireUuid(value, code);
}

function requireString(
  value: unknown,
  code: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") throw new HttpError(400, code);
  const normalized = value.trim();
  const hasControlCharacter = [...normalized].some((character) => {
    const characterCode = character.charCodeAt(0);
    return characterCode <= 31 || characterCode === 127;
  });
  if (normalized.length < minimum || normalized.length > maximum || hasControlCharacter) {
    throw new HttpError(400, code);
  }
  return normalized;
}

function optionalString(
  value: unknown,
  code: string,
  minimum: number,
  maximum: number,
): string | undefined {
  if (value === undefined) return undefined;
  return requireString(value, code, minimum, maximum);
}

function requireUuidArray(value: unknown, code: string, maximum = 25): string[] {
  if (!Array.isArray(value) || value.length > maximum) throw new HttpError(400, code);
  const result = value.map((item) => requireUuid(item, code));
  if (new Set(result).size !== result.length) throw new HttpError(400, code);
  return result;
}

function parsePositiveInteger(value: string | null, fallback: number, maximum: number): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) throw new HttpError(400, "invalid_pagination");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new HttpError(400, "invalid_pagination");
  }
  return parsed;
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

  if (principal.isAdmin) {
    await requireMfaAssurance(req, principal, "manage_fleet_drivers");
    return {
      principal,
      managerId: manager?.id || null,
      authUserId: principal.user.id,
      role: "super_admin",
      assignedCities: [],
    };
  }
  if (!manager || !FLEET_ROLES.has(String(manager.role))) {
    throw new HttpError(403, "fleet_operator_required");
  }
  await requireMfaAssurance(req, principal, "manage_fleet_drivers");
  return {
    principal,
    managerId: manager.id,
    authUserId: principal.user.id,
    role: manager.role as FleetActor["role"],
    assignedCities: normalizeCityIds(manager.assigned_city_ids),
  };
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
    actorType: "admin",
    action: "manage_fleet_city_object",
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
  if (requestedCityId && !UUID_PATTERN.test(requestedCityId)) throw new HttpError(400, "invalid_city_id");
  if (actor.role === "super_admin") return requestedCityId ? [requestedCityId] : null;
  if (actor.assignedCities.length === 0) await assertCityAccess(req, actor, null, "city");
  if (requestedCityId) {
    await assertCityAccess(req, actor, requestedCityId, "city", requestedCityId);
    return [requestedCityId];
  }
  return actor.assignedCities;
}

async function requireDriver(req: Request, actor: FleetActor, driverId: string) {
  requireUuid(driverId, "invalid_driver_id");
  const service = getServiceClient();
  const { data: driver, error } = await service
    .from("drivers")
    .select("*")
    .eq("id", driverId)
    .maybeSingle();
  if (error) throw new HttpError(500, "driver_lookup_failed");
  if (!driver) throw new HttpError(404, "driver_not_found");
  await assertCityAccess(req, actor, driver.city_id, "driver", driverId);
  return driver;
}

async function validateCity(req: Request, actor: FleetActor, cityId: string): Promise<void> {
  await assertCityAccess(req, actor, cityId, "city", cityId);
  const service = getServiceClient();
  const { data, error } = await service
    .from("cities")
    .select("id")
    .eq("id", cityId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new HttpError(500, "city_lookup_failed");
  if (!data) throw new HttpError(400, "invalid_city_id");
}

async function validateZones(cityId: string, zoneIds: string[]): Promise<void> {
  if (zoneIds.length === 0) return;
  const service = getServiceClient();
  const { data, error } = await service
    .from("zones")
    .select("id, city_id, is_active")
    .in("id", zoneIds);
  if (error) throw new HttpError(500, "zone_lookup_failed");
  const valid = new Set(
    (data || [])
      .filter((zone) => zone.city_id === cityId && zone.is_active === true)
      .map((zone) => zone.id),
  );
  if (valid.size !== zoneIds.length) throw new HttpError(400, "invalid_zone_scope");
}

async function recordMutation(
  req: Request,
  actor: FleetActor,
  eventType: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await recordSecurityEvent(req, {
    eventType,
    category: "data_change",
    severity: "info",
    outcome: "success",
    principal: actor.principal,
    actorType: "admin",
    action,
    resourceType,
    resourceId,
    metadata,
  });
}

function mapDriver(driver: JsonObject): JsonObject {
  const vehicles = Array.isArray(driver.vehicles) ? driver.vehicles : driver.vehicles ? [driver.vehicles] : [];
  const vehicle = vehicles[0] as JsonObject | undefined;
  return {
    id: driver.id,
    email: driver.email,
    phone: driver.phone_number,
    fullName: driver.full_name,
    cityId: driver.city_id,
    cityName: (driver.cities as JsonObject | null)?.name || null,
    assignedZoneIds: driver.assigned_zone_ids || [],
    status: driver.status,
    approvalStatus: driver.approval_status,
    isActive: driver.is_active,
    isOnline: driver.is_online,
    currentLatitude: driver.current_lat,
    currentLongitude: driver.current_lng,
    locationUpdatedAt: driver.last_location_at || driver.last_location_update,
    totalDeliveries: driver.total_deliveries,
    rating: driver.rating,
    cancellationRate: driver.cancellation_rate,
    currentBalance: driver.wallet_balance,
    totalEarnings: driver.total_earnings,
    assignedVehicleId: vehicle?.id || null,
    vehicle: vehicle
      ? { id: vehicle.id, type: vehicle.type, plateNumber: vehicle.plate_number }
      : null,
    createdAt: driver.created_at,
    updatedAt: driver.updated_at,
  };
}

async function handleListDrivers(req: Request, actor: FleetActor): Promise<Response> {
  const url = new URL(req.url);
  const cityFilter = await getCityFilter(req, actor, url.searchParams.get("cityId"));
  const status = url.searchParams.get("status");
  const zoneId = url.searchParams.get("zoneId");
  const online = url.searchParams.get("isOnline");
  const search = url.searchParams.get("search");
  const page = parsePositiveInteger(url.searchParams.get("page"), 1, 100_000);
  const limit = parsePositiveInteger(url.searchParams.get("limit"), 20, 100);

  const validApprovalStatuses = new Set(["pending", "approved", "rejected"]);
  if (status && !validApprovalStatuses.has(status)) throw new HttpError(400, "invalid_status_filter");
  if (zoneId && !UUID_PATTERN.test(zoneId)) throw new HttpError(400, "invalid_zone_id");
  if (online !== null && online !== "true" && online !== "false") {
    throw new HttpError(400, "invalid_online_filter");
  }
  let normalizedSearch: string | null = null;
  if (search !== null) {
    normalizedSearch = requireString(search, "invalid_search", 1, 80);
    if (/[,()%_"'\\]/.test(normalizedSearch)) throw new HttpError(400, "invalid_search");
  }

  const service = getServiceClient();
  let query = service
    .from("drivers")
    .select(`
      id, email, phone_number, full_name, city_id, assigned_zone_ids, status,
      approval_status, is_active, is_online, current_lat, current_lng,
      last_location_at, last_location_update, total_deliveries, rating,
      cancellation_rate, wallet_balance, total_earnings, created_at, updated_at,
      cities(name, name_ar),
      vehicles!vehicles_assigned_driver_id_fkey(id, type, plate_number)
    `, { count: "exact" });
  if (cityFilter) query = query.in("city_id", cityFilter);
  if (status) query = query.eq("approval_status", status);
  if (zoneId) query = query.contains("assigned_zone_ids", [zoneId]);
  if (online !== null) query = query.eq("is_online", online === "true");
  if (normalizedSearch) {
    query = query.or(
      `full_name.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%,phone_number.ilike.%${normalizedSearch}%`,
    );
  }
  const from = (page - 1) * limit;
  const { data, error, count } = await query
    .range(from, from + limit - 1)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Driver list query failed:", error.message);
    throw new HttpError(500, "driver_list_failed");
  }
  return respond(req, {
    data: (data || []).map((driver) => mapDriver(driver as JsonObject)),
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

async function handleCreateDriver(req: Request, actor: FleetActor): Promise<Response> {
  await enforceRateLimit(req, "fleet-drivers:create", actor.authUserId, 5, 60 * 60);
  const body = asObject(await readJsonBody<unknown>(req, 16 * 1024));
  assertAllowedKeys(body, ["email", "phone", "fullName", "cityId", "zoneIds"]);
  const email = requireString(body.email, "invalid_email", 5, 254).toLowerCase();
  const phone = requireString(body.phone, "invalid_phone", 7, 24);
  const fullName = requireString(body.fullName, "invalid_full_name", 2, 100);
  const cityId = requireUuid(body.cityId, "invalid_city_id");
  const zoneIds = body.zoneIds === undefined ? [] : requireUuidArray(body.zoneIds, "invalid_zone_ids");
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, "invalid_email");
  if (!PHONE_PATTERN.test(phone)) throw new HttpError(400, "invalid_phone");
  await validateCity(req, actor, cityId);
  await validateZones(cityId, zoneIds);

  const service = getServiceClient();
  const provisioningGrant = await issueSignupProvisioningGrant(service, {
    email,
    kind: "fleet_driver_invitation",
    createdBy: actor.authUserId,
  });
  const { data: authData, error: authError } = await service.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      nutrio_provisioning_token: provisioningGrant.token,
      nutrio_provisioning_kind: provisioningGrant.kind,
    },
  });
  if (authError || !authData.user) {
    console.error("Driver invite failed:", authError?.message || "missing user");
    throw new HttpError(authError?.status === 422 ? 409 : 400, "driver_invite_failed");
  }

  try {
    await assertSignupProvisioningGrantConsumed(service, provisioningGrant.tokenHash);
    await clearSignupProvisioningMetadata(
      service,
      authData.user.id,
      authData.user.user_metadata,
    );
  } catch (error) {
    const { error: cleanupError } = await service.auth.admin.deleteUser(authData.user.id);
    if (cleanupError) console.error("Driver auth rollback failed:", cleanupError.message);
    throw error;
  }

  const { data: driver, error: driverError } = await service
    .from("drivers")
    .insert({
      user_id: authData.user.id,
      email,
      phone_number: phone,
      full_name: fullName,
      city_id: cityId,
      assigned_zone_ids: zoneIds,
      approval_status: "pending",
      status: "inactive",
      is_active: true,
      is_online: false,
    })
    .select("id, email, phone_number, full_name, city_id, status, approval_status, created_at")
    .single();
  if (driverError || !driver) {
    const { error: cleanupError } = await service.auth.admin.deleteUser(authData.user.id);
    if (cleanupError) console.error("Driver auth rollback failed:", cleanupError.message);
    console.error("Driver insert failed:", driverError?.message || "missing row");
    throw new HttpError(500, "driver_create_failed");
  }

  await recordMutation(req, actor, "fleet.driver_created", "create_driver", "driver", driver.id, {
    city_id: cityId,
  });
  return respond(req, {
    id: driver.id,
    email: driver.email,
    phone: driver.phone_number,
    fullName: driver.full_name,
    cityId: driver.city_id,
    status: driver.status,
    approvalStatus: driver.approval_status,
    createdAt: driver.created_at,
  }, 201);
}

async function handleGetDriver(req: Request, actor: FleetActor, driverId: string): Promise<Response> {
  const driver = await requireDriver(req, actor, driverId);
  const service = getServiceClient();
  const [cityResult, vehicleResult, documentResult, payoutResult] = await Promise.all([
    driver.city_id
      ? service.from("cities").select("name, name_ar").eq("id", driver.city_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    service.from("vehicles").select("*").eq("assigned_driver_id", driverId).maybeSingle(),
    service.from("driver_documents").select("*").eq("driver_id", driverId).order("created_at", { ascending: false }),
    service.from("driver_payouts").select("amount, status").eq("driver_id", driverId),
  ]);
  if (cityResult.error || vehicleResult.error || documentResult.error || payoutResult.error) {
    throw new HttpError(500, "driver_detail_failed");
  }
  const payouts = payoutResult.data || [];
  return respond(req, {
    ...mapDriver({
      ...driver,
      cities: cityResult.data,
      vehicles: vehicleResult.data ? [vehicleResult.data] : [],
    }),
    documents: documentResult.data || [],
    earnings: {
      total: payouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0),
      pendingPayout: payouts
        .filter((payout) => payout.status === "pending")
        .reduce((sum, payout) => sum + Number(payout.amount || 0), 0),
    },
  });
}

async function updateVehicleAssignment(
  driverId: string,
  cityId: string,
  assignedVehicleId: string | null | undefined,
  cityChanged: boolean,
): Promise<void> {
  if (assignedVehicleId === undefined && !cityChanged) return;
  const service = getServiceClient();
  if (assignedVehicleId) {
    const { data: vehicle, error } = await service
      .from("vehicles")
      .select("id, city_id, assigned_driver_id, status")
      .eq("id", assignedVehicleId)
      .maybeSingle();
    if (error) throw new HttpError(500, "vehicle_lookup_failed");
    if (!vehicle || vehicle.city_id !== cityId) throw new HttpError(400, "invalid_vehicle_scope");
    if (vehicle.assigned_driver_id && vehicle.assigned_driver_id !== driverId) {
      throw new HttpError(409, "vehicle_already_assigned");
    }
  }

  const { error: clearError } = await service
    .from("vehicles")
    .update({ assigned_driver_id: null, status: "available" })
    .eq("assigned_driver_id", driverId);
  if (clearError) throw new HttpError(500, "vehicle_assignment_failed");
  if (!assignedVehicleId) return;

  const { data: assigned, error: assignError } = await service
    .from("vehicles")
    .update({ assigned_driver_id: driverId, status: "assigned" })
    .eq("id", assignedVehicleId)
    .eq("city_id", cityId)
    .is("assigned_driver_id", null)
    .select("id")
    .maybeSingle();
  if (assignError || !assigned) throw new HttpError(409, "vehicle_assignment_conflict");
}

async function handleUpdateDriver(req: Request, actor: FleetActor, driverId: string): Promise<Response> {
  await enforceRateLimit(req, "fleet-drivers:update", actor.authUserId, 30, 60);
  const existing = await requireDriver(req, actor, driverId);
  const body = asObject(await readJsonBody<unknown>(req, 16 * 1024));
  assertAllowedKeys(body, ["fullName", "phone", "cityId", "zoneIds", "assignedVehicleId"]);
  if (Object.keys(body).length === 0) throw new HttpError(400, "empty_update");

  const fullName = optionalString(body.fullName, "invalid_full_name", 2, 100);
  const phone = optionalString(body.phone, "invalid_phone", 7, 24);
  if (phone !== undefined && !PHONE_PATTERN.test(phone)) throw new HttpError(400, "invalid_phone");
  const cityId = body.cityId === undefined
    ? existing.city_id
    : requireUuid(body.cityId, "invalid_city_id");
  if (!cityId) throw new HttpError(400, "city_required");
  await validateCity(req, actor, cityId);
  const zoneIds = body.zoneIds === undefined
    ? undefined
    : requireUuidArray(body.zoneIds, "invalid_zone_ids");
  if (zoneIds) await validateZones(cityId, zoneIds);
  const assignedVehicleId = optionalUuid(body.assignedVehicleId, "invalid_vehicle_id");

  const updates: JsonObject = {};
  if (fullName !== undefined) updates.full_name = fullName;
  if (phone !== undefined) updates.phone_number = phone;
  if (body.cityId !== undefined) updates.city_id = cityId;
  if (zoneIds !== undefined) updates.assigned_zone_ids = zoneIds;

  const service = getServiceClient();
  let driver = existing;
  if (Object.keys(updates).length > 0) {
    const { data, error } = await service
      .from("drivers")
      .update(updates)
      .eq("id", driverId)
      .select("*")
      .maybeSingle();
    if (error || !data) throw new HttpError(500, "driver_update_failed");
    driver = data;
  }
  await updateVehicleAssignment(driverId, cityId, assignedVehicleId, cityId !== existing.city_id);
  const { data: vehicle, error: vehicleError } = await service
    .from("vehicles")
    .select("id, type, plate_number")
    .eq("assigned_driver_id", driverId)
    .maybeSingle();
  if (vehicleError) throw new HttpError(500, "vehicle_lookup_failed");

  await recordMutation(req, actor, "fleet.driver_updated", "update_driver", "driver", driverId, {
    city_id: cityId,
    changed_fields: Object.keys(body),
  });
  return respond(req, mapDriver({ ...driver, vehicles: vehicle ? [vehicle] : [] }));
}

async function handleUpdateStatus(req: Request, actor: FleetActor, driverId: string): Promise<Response> {
  await enforceRateLimit(req, "fleet-drivers:status", actor.authUserId, 20, 60);
  const existing = await requireDriver(req, actor, driverId);
  const body = asObject(await readJsonBody<unknown>(req, 8 * 1024));
  assertAllowedKeys(body, ["status", "reason"]);
  const status = requireString(body.status, "invalid_status", 3, 30);
  const reason = body.reason === undefined ? undefined : requireString(body.reason, "invalid_reason", 3, 500);
  const state: Record<string, JsonObject> = {
    pending_verification: { status: "pending_verification", approval_status: "pending", is_active: true, is_online: false },
    active: { status: "active", approval_status: "approved", is_active: true },
    suspended: { status: "suspended", is_active: false, is_online: false },
    inactive: { status: "inactive", is_active: false, is_online: false },
  };
  if (!state[status]) throw new HttpError(400, "invalid_status");

  const service = getServiceClient();
  const { data: driver, error } = await service
    .from("drivers")
    .update(state[status])
    .eq("id", driverId)
    .select("id, status, approval_status, is_active, is_online, updated_at")
    .maybeSingle();
  if (error || !driver) throw new HttpError(500, "driver_status_update_failed");
  await recordMutation(req, actor, "fleet.driver_status_updated", "update_driver_status", "driver", driverId, {
    city_id: existing.city_id,
    previous_status: existing.status,
    new_status: status,
    reason: reason || null,
  });
  return respond(req, {
    id: driver.id,
    status: driver.status,
    approvalStatus: driver.approval_status,
    isActive: driver.is_active,
    isOnline: driver.is_online,
    updatedAt: driver.updated_at,
  });
}

async function handleGetLocation(req: Request, actor: FleetActor, driverId: string): Promise<Response> {
  const driver = await requireDriver(req, actor, driverId);
  return respond(req, {
    latitude: driver.current_lat,
    longitude: driver.current_lng,
    lastUpdated: driver.last_location_at || driver.last_location_update,
    isOnline: driver.is_online,
  });
}

async function handleGetPerformance(req: Request, actor: FleetActor, driverId: string): Promise<Response> {
  const driver = await requireDriver(req, actor, driverId);
  const period = new URL(req.url).searchParams.get("period") || "30d";
  const periodDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
  if (!periodDays[period]) throw new HttpError(400, "invalid_period");
  const start = new Date(Date.now() - periodDays[period] * 24 * 60 * 60 * 1000).toISOString();
  const service = getServiceClient();
  const [jobResult, payoutResult] = await Promise.all([
    service
      .from("delivery_jobs")
      .select("status, accepted_at, delivered_at, created_at")
      .eq("driver_id", driverId)
      .gte("created_at", start),
    service
      .from("driver_payouts")
      .select("amount")
      .eq("driver_id", driverId)
      .gte("period_start", start.slice(0, 10)),
  ]);
  if (jobResult.error || payoutResult.error) throw new HttpError(500, "driver_performance_failed");
  const jobs = jobResult.data || [];
  const completed = jobs.filter((job) => job.status === "delivered" || job.status === "completed");
  const cancelled = jobs.filter((job) => job.status === "cancelled" || job.status === "failed");
  const durations = completed.flatMap((job) => {
    if (!job.accepted_at || !job.delivered_at) return [];
    const minutes = (Date.parse(job.delivered_at) - Date.parse(job.accepted_at)) / 60_000;
    return Number.isFinite(minutes) && minutes >= 0 ? [minutes] : [];
  });
  const onTime = durations.filter((minutes) => minutes <= 45).length;
  return respond(req, {
    period,
    totalDeliveries: jobs.length,
    completedDeliveries: completed.length,
    cancelledDeliveries: cancelled.length,
    averageRating: driver.rating,
    averageDeliveryTime: durations.length
      ? Math.round(durations.reduce((sum, minutes) => sum + minutes, 0) / durations.length)
      : 0,
    onTimeRate: completed.length ? Math.round((onTime / completed.length) * 100) : 100,
    cancellationRate: driver.cancellation_rate,
    earnings: (payoutResult.data || []).reduce((sum, payout) => sum + Number(payout.amount || 0), 0),
    totalEarnings: driver.total_earnings,
  });
}

function validateDocumentPath(
  value: unknown,
  cityId: string,
  driverId: string,
): string {
  const raw = requireString(value, "invalid_document_path", 20, 1_024)
    .replace(/^\/+/, "");
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new HttpError(400, "invalid_document_path");
  }
  const expectedPrefix = `cities/${cityId}/drivers/${driverId}/`;
  if (
    decoded !== raw ||
    !raw.startsWith(expectedPrefix) ||
    raw.includes("..") ||
    !/^[a-zA-Z0-9/_-]+\.(pdf|jpg|png|webp)$/i.test(raw)
  ) {
    throw new HttpError(400, "invalid_document_path");
  }
  return raw;
}

function optionalDate(value: unknown, code: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, code);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, code);
  }
  return value;
}

async function handleUploadDocument(req: Request, actor: FleetActor, driverId: string): Promise<Response> {
  await enforceRateLimit(req, "fleet-drivers:document", actor.authUserId, 20, 60 * 60);
  const driver = await requireDriver(req, actor, driverId);
  const body = asObject(await readJsonBody<unknown>(req, 8 * 1024));
  assertAllowedKeys(body, ["documentType", "documentPath", "expiryDate"]);
  const documentType = requireString(body.documentType, "invalid_document_type", 3, 40);
  const validTypes = new Set([
    "id_card",
    "driving_license",
    "vehicle_registration",
    "insurance",
    "background_check",
    "contract",
  ]);
  if (!validTypes.has(documentType)) throw new HttpError(400, "invalid_document_type");
  if (!driver.city_id) throw new HttpError(409, "driver_city_required");
  const documentPath = validateDocumentPath(body.documentPath, driver.city_id, driverId);
  const expiryDate = optionalDate(body.expiryDate, "invalid_expiry_date");
  const service = getServiceClient();
  const { data: document, error } = await service
    .from("driver_documents")
    .insert({
      driver_id: driverId,
      document_type: documentType,
      document_url: documentPath,
      expiry_date: expiryDate,
      verification_status: "pending",
    })
    .select("id, document_type, document_url, verification_status, expiry_date, uploaded_at, created_at")
    .single();
  if (error || !document) throw new HttpError(500, "document_create_failed");
  await recordMutation(req, actor, "fleet.driver_document_created", "create_driver_document", "driver_document", document.id, {
    driver_id: driverId,
    city_id: driver.city_id,
    document_type: documentType,
  });
  return respond(req, {
    id: document.id,
    documentType: document.document_type,
    documentPath: document.document_url,
    verificationStatus: document.verification_status,
    expiryDate: document.expiry_date,
    uploadedAt: document.uploaded_at || document.created_at,
  }, 201);
}

function routeParts(req: Request): string[] {
  let path = new URL(req.url).pathname;
  path = path.replace(/^\/fleet-drivers\/?/, "");
  path = path.replace(/^\/fleet\/drivers\/?/, "");
  return path.split("/").filter(Boolean);
}

serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;
  try {
    const ip = getClientIp(req) || "unknown";
    await enforceRateLimit(req, "fleet-drivers:ip", ip, 180, 60);
    const actor = await authenticateFleetActor(req);
    await enforceRateLimit(req, "fleet-drivers:actor", actor.authUserId, 120, 60);
    const path = routeParts(req);

    if (path.length === 0 && req.method === "GET") return await handleListDrivers(req, actor);
    if (path.length === 0 && req.method === "POST") return await handleCreateDriver(req, actor);
    if (path.length === 1 && req.method === "GET") return await handleGetDriver(req, actor, path[0]);
    if (path.length === 1 && req.method === "PUT") return await handleUpdateDriver(req, actor, path[0]);
    if (path.length === 2 && path[1] === "status" && req.method === "PATCH") {
      return await handleUpdateStatus(req, actor, path[0]);
    }
    if (path.length === 2 && path[1] === "location" && req.method === "GET") {
      return await handleGetLocation(req, actor, path[0]);
    }
    if (path.length === 2 && path[1] === "performance" && req.method === "GET") {
      return await handleGetPerformance(req, actor, path[0]);
    }
    if (path.length === 2 && path[1] === "documents" && req.method === "POST") {
      return await handleUploadDocument(req, actor, path[0]);
    }
    throw new HttpError(404, "not_found");
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
      await recordSecurityEvent(req, {
        eventType: "authorization.fleet_driver_request_denied",
        category: "authorization",
        severity: error.status === 403 ? "high" : "medium",
        outcome: "denied",
        actorType: "anonymous",
        action: "fleet_driver_request",
        metadata: { reason: error.code },
      });
    }
    return safeError(req, error);
  }
});
