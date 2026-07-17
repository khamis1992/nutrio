// Fleet payout management backed by atomic driver payout RPCs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

import {
  authenticateRequest,
  enforceRateLimit,
  getClientIp,
  getCorsHeaders,
  getSupabasePublishableKey,
  getServiceClient,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireMfaAssurance,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CORS_METHODS = "GET, POST, OPTIONS";
const FLEET_ROLES = new Set(["super_admin", "fleet_manager"]);
const PAYOUT_STATUSES = new Set(["pending", "processing", "paid", "failed"]);

interface FleetActor {
  principal: SecurityPrincipal;
  managerId: string | null;
  authUserId: string;
  role: "super_admin" | "fleet_manager";
  assignedCities: string[];
  databaseToken: string;
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
  console.error("fleet-payouts failed:", error);
  return respond(req, { error: "internal_error" }, 500);
}

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_request_body");
  }
  return value as JsonObject;
}

function asRpcResult(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(500, "payout_operation_failed");
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

function requireString(value: unknown, code: string, minimum: number, maximum: number): string {
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
): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireString(value, code, minimum, maximum);
}

function requireDate(value: unknown, code: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) throw new HttpError(400, code);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, code);
  }
  return value;
}

function requireDateRange(startValue: unknown, endValue: unknown): { start: string; end: string } {
  const start = requireDate(startValue, "invalid_period_start");
  const end = requireDate(endValue, "invalid_period_end");
  if (start > end) throw new HttpError(400, "invalid_payout_period");
  const duration = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  if (duration > 366 * 24 * 60 * 60 * 1000) throw new HttpError(400, "invalid_payout_period");
  return { start, end };
}

function requireUuidArray(value: unknown, code: string, maximum = 100): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) throw new HttpError(400, code);
  const ids = value.map((item) => requireUuid(item, code));
  if (new Set(ids).size !== ids.length) throw new HttpError(400, code);
  return ids;
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

function getBearerToken(req: Request): string {
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) throw new HttpError(401, "authentication_required");
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

async function loadFleetManager(authUserId: string, managerId?: string | null) {
  const service = getServiceClient();
  let query = service
    .from("fleet_managers")
    .select("id, auth_user_id, role, assigned_city_ids, is_active")
    .eq("auth_user_id", authUserId)
    .eq("is_active", true);
  if (managerId) query = query.eq("id", managerId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new HttpError(503, "authorization_unavailable");
  return data;
}

async function authenticateStandardActor(req: Request, token: string): Promise<FleetActor> {
  const principal = await authenticateRequest(req);
  const manager = await loadFleetManager(principal.user.id);
  if (principal.isAdmin) {
    await requireMfaAssurance(req, principal, "manage_fleet_payouts");
    return {
      principal,
      managerId: manager?.id || null,
      authUserId: principal.user.id,
      role: "super_admin",
      assignedCities: [],
      databaseToken: token,
    };
  }
  if (!manager || !FLEET_ROLES.has(String(manager.role))) {
    throw new HttpError(403, "fleet_operator_required");
  }
  await requireMfaAssurance(req, principal, "manage_fleet_payouts");
  return {
    principal,
    managerId: manager.id,
    authUserId: principal.user.id,
    role: manager.role as FleetActor["role"],
    assignedCities: normalizeCityIds(manager.assigned_city_ids),
    databaseToken: token,
  };
}

async function authenticateFleetActor(req: Request): Promise<FleetActor> {
  const token = getBearerToken(req);
  return await authenticateStandardActor(req, token);
}

async function getActorClient(actor: FleetActor) {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new HttpError(503, "backend_not_configured");
  let publishableKey: string;
  try {
    publishableKey = getSupabasePublishableKey();
  } catch {
    throw new HttpError(503, "backend_not_configured");
  }
  return createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${actor.databaseToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
    eventType: "authorization.fleet_payout_city_denied",
    category: "authorization",
    severity: "critical",
    outcome: "denied",
    principal: actor.principal,
    actorUserId: actor.authUserId,
    actorRole: actor.role,
    actorType: "admin",
    action: "manage_driver_payout",
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
    .select("id, full_name, city_id, wallet_balance, payout_details, is_active, approval_status")
    .eq("id", driverId)
    .maybeSingle();
  if (error) throw new HttpError(500, "driver_lookup_failed");
  if (!driver) throw new HttpError(404, "driver_not_found");
  await assertCityAccess(req, actor, driver.city_id, "driver", driverId);
  return driver;
}

function relatedDriver(value: unknown): JsonObject | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as JsonObject : null;
  return value && typeof value === "object" ? value as JsonObject : null;
}

async function requirePayout(req: Request, actor: FleetActor, payoutId: string) {
  requireUuid(payoutId, "invalid_payout_id");
  const service = getServiceClient();
  const { data: payout, error } = await service
    .from("driver_payouts")
    .select("id, driver_id, amount, status, payment_reference, payout_method, drivers!inner(id, city_id, full_name)")
    .eq("id", payoutId)
    .maybeSingle();
  if (error) throw new HttpError(500, "payout_lookup_failed");
  if (!payout) throw new HttpError(404, "payout_not_found");
  const driver = relatedDriver(payout.drivers);
  if (!driver) throw new HttpError(500, "payout_driver_missing");
  await assertCityAccess(req, actor, driver.city_id as string | null, "driver_payout", payoutId);
  return { ...payout, driver };
}

function payoutRpcFailure(error: { message?: string | null } | null): HttpError {
  const message = error?.message || "";
  if (message.includes("FLEET_OPERATOR_REQUIRED")) return new HttpError(403, "fleet_operator_required");
  if (message.includes("PAYOUT_NOT_FOUND")) return new HttpError(404, "payout_not_found");
  if (message.includes("INVALID_PAYOUT_TRANSITION")) return new HttpError(409, "invalid_payout_transition");
  if (message.includes("PAYMENT_REFERENCE_REQUIRED")) return new HttpError(400, "payment_reference_required");
  if (message.includes("REQUEST_KEY_CONFLICT")) return new HttpError(409, "idempotency_key_conflict");
  if (message.includes("MINIMUM_PAYOUT_NOT_REACHED")) return new HttpError(409, "minimum_payout_not_reached");
  if (message.includes("DRIVER_BANK_DETAILS_REQUIRED") || message.includes("BANK_DETAILS_REQUIRED")) {
    return new HttpError(409, "driver_bank_details_required");
  }
  if (message.includes("ACTIVE_DRIVER_REQUIRED")) return new HttpError(409, "active_driver_required");
  return new HttpError(500, "payout_operation_failed");
}

async function recordPayoutEvent(
  req: Request,
  actor: FleetActor,
  eventType: string,
  action: string,
  payoutId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  await recordSecurityEvent(req, {
    eventType,
    category: "payment",
    severity: "high",
    outcome: "success",
    principal: actor.principal,
    actorUserId: actor.authUserId,
    actorRole: actor.role,
    actorType: "admin",
    action,
    resourceType: "driver_payout",
    resourceId: payoutId || undefined,
    metadata,
  });
}

async function handleListPayouts(req: Request, actor: FleetActor): Promise<Response> {
  const url = new URL(req.url);
  const cityFilter = await getCityFilter(req, actor, url.searchParams.get("cityId"));
  const driverId = url.searchParams.get("driverId");
  const status = url.searchParams.get("status");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const page = parsePositiveInteger(url.searchParams.get("page"), 1, 100_000);
  const limit = parsePositiveInteger(url.searchParams.get("limit"), 20, 100);
  if (status && !PAYOUT_STATUSES.has(status)) throw new HttpError(400, "invalid_status_filter");
  if (startDate) requireDate(startDate, "invalid_start_date");
  if (endDate) requireDate(endDate, "invalid_end_date");
  if (startDate && endDate && startDate > endDate) throw new HttpError(400, "invalid_date_range");
  if (driverId) await requireDriver(req, actor, driverId);

  const service = getServiceClient();
  let query = service
    .from("driver_payouts")
    .select(`
      id, driver_id, amount, period_start, period_end, status, payout_method,
      payment_reference, processed_at, processed_by, rejection_reason,
      requested_by, created_at,
      drivers!inner(id, full_name, phone_number, email, city_id, cities(name, name_ar))
    `, { count: "exact" });
  if (cityFilter) query = query.in("drivers.city_id", cityFilter);
  if (driverId) query = query.eq("driver_id", driverId);
  if (status) query = query.eq("status", status);
  if (startDate) query = query.gte("period_start", startDate);
  if (endDate) query = query.lte("period_end", endDate);
  const from = (page - 1) * limit;
  const { data, error, count } = await query
    .range(from, from + limit - 1)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Payout list query failed:", error.message);
    throw new HttpError(500, "payout_list_failed");
  }

  let totalAmount = 0;
  let pendingAmount = 0;
  let paidAmount = 0;
  const driverIds = new Set<string>();
  const payouts = (data || []).map((payout) => {
    const driver = relatedDriver(payout.drivers);
    const amount = Number(payout.amount || 0);
    totalAmount += amount;
    if (payout.status === "pending") pendingAmount += amount;
    if (payout.status === "paid") paidAmount += amount;
    driverIds.add(payout.driver_id);
    return {
      id: payout.id,
      driverId: payout.driver_id,
      driverName: driver?.full_name || null,
      cityId: driver?.city_id || null,
      cityName: relatedDriver(driver?.cities)?.name || null,
      periodStart: payout.period_start,
      periodEnd: payout.period_end,
      totalAmount: amount,
      status: payout.status,
      paymentMethod: payout.payout_method,
      paymentReference: payout.payment_reference,
      processedAt: payout.processed_at,
      processedBy: payout.processed_by,
      rejectionReason: payout.rejection_reason,
      createdAt: payout.created_at,
    };
  });
  return respond(req, {
    data: payouts,
    summary: { totalAmount, pendingAmount, paidAmount, driverCount: driverIds.size },
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

async function handleCreatePayout(req: Request, actor: FleetActor): Promise<Response> {
  await enforceRateLimit(req, "fleet-payouts:create", actor.authUserId, 10, 60);
  const body = asObject(await readJsonBody<unknown>(req, 8 * 1024));
  assertAllowedKeys(body, ["driverId", "periodStart", "periodEnd", "idempotencyKey"]);
  const driverId = requireUuid(body.driverId, "invalid_driver_id");
  const period = requireDateRange(body.periodStart, body.periodEnd);
  const requestKey = requireUuid(body.idempotencyKey, "invalid_idempotency_key");
  const driver = await requireDriver(req, actor, driverId);
  const actorClient = await getActorClient(actor);
  const { data, error } = await actorClient.rpc("create_driver_payout_for_operator", {
    p_driver_id: driverId,
    p_period_start: period.start,
    p_period_end: period.end,
    p_request_key: requestKey,
  });
  if (error) {
    console.error("Atomic payout reservation failed:", error.message);
    throw payoutRpcFailure(error);
  }
  const result = asRpcResult(data);
  if (result.success !== true || typeof result.payout_id !== "string") {
    throw new HttpError(500, "payout_operation_failed");
  }
  await recordPayoutEvent(req, actor, "fleet.driver_payout_reserved", "reserve_driver_payout", result.payout_id, {
    driver_id: driverId,
    city_id: driver.city_id,
    amount: result.amount,
    duplicate: result.duplicate === true,
  });
  return respond(req, {
    id: result.payout_id,
    driverId,
    driverName: driver.full_name,
    periodStart: period.start,
    periodEnd: period.end,
    totalAmount: result.amount,
    status: result.status,
    duplicate: result.duplicate === true,
  }, result.duplicate === true ? 200 : 201);
}

async function handleProcessPayout(
  req: Request,
  actor: FleetActor,
  payoutId: string,
): Promise<Response> {
  await enforceRateLimit(req, "fleet-payouts:transition", actor.authUserId, 20, 60);
  const payout = await requirePayout(req, actor, payoutId);
  const body = asObject(await readJsonBody<unknown>(req, 8 * 1024));
  assertAllowedKeys(body, ["action", "paymentMethod", "paymentReference", "notes"]);
  const action = body.action === undefined ? "pay" : requireString(body.action, "invalid_payout_action", 3, 10);
  if (!new Set(["start", "pay", "reject"]).has(action)) {
    throw new HttpError(400, "invalid_payout_action");
  }
  const paymentReference = optionalString(body.paymentReference, "invalid_payment_reference", 3, 160);
  const notes = optionalString(body.notes, "invalid_notes", 1, 1_000);
  const paymentMethod = optionalString(body.paymentMethod, "invalid_payment_method", 3, 40);
  if (paymentMethod && !new Set(["bank_transfer", "cash", "manual_transfer"]).has(paymentMethod)) {
    throw new HttpError(400, "invalid_payment_method");
  }
  if (action === "pay" && !paymentReference) throw new HttpError(400, "payment_reference_required");

  const actorClient = await getActorClient(actor);
  const { data, error } = await actorClient.rpc("transition_driver_payout", {
    p_payout_id: payoutId,
    p_action: action,
    p_payment_reference: paymentReference,
    p_notes: notes,
  });
  if (error) {
    console.error("Atomic payout transition failed:", error.message);
    throw payoutRpcFailure(error);
  }
  const result = asRpcResult(data);
  if (result.success !== true) throw new HttpError(500, "payout_operation_failed");

  if (paymentMethod && action === "pay") {
    const service = getServiceClient();
    const { error: methodError } = await service
      .from("driver_payouts")
      .update({ payout_method: paymentMethod })
      .eq("id", payoutId);
    if (methodError) console.error("Payout method annotation failed:", methodError.message);
  }
  await recordPayoutEvent(req, actor, "fleet.driver_payout_transitioned", "transition_driver_payout", payoutId, {
    driver_id: payout.driver_id,
    city_id: payout.driver.city_id,
    previous_status: payout.status,
    new_status: result.status,
    action,
  });
  return respond(req, {
    id: payoutId,
    status: result.status,
    totalAmount: result.amount,
    paymentMethod: paymentMethod || payout.payout_method,
    paymentReference: paymentReference || payout.payment_reference,
  });
}

async function deterministicUuid(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function publicFailureCode(error: unknown): string {
  const mapped = error instanceof HttpError ? error : payoutRpcFailure(
    error && typeof error === "object" ? error as { message?: string } : null,
  );
  return mapped.code;
}

async function handleBulkPayouts(req: Request, actor: FleetActor): Promise<Response> {
  await enforceRateLimit(req, "fleet-payouts:bulk", actor.authUserId, 3, 10 * 60);
  const body = asObject(await readJsonBody<unknown>(req, 16 * 1024));
  assertAllowedKeys(body, ["cityId", "periodStart", "periodEnd", "driverIds"]);
  const cityId = requireUuid(body.cityId, "invalid_city_id");
  const period = requireDateRange(body.periodStart, body.periodEnd);
  const driverIds = body.driverIds === undefined ? null : requireUuidArray(body.driverIds, "invalid_driver_ids");
  await assertCityAccess(req, actor, cityId, "city", cityId);

  const service = getServiceClient();
  if (driverIds) {
    const { data: requestedDrivers, error: requestedError } = await service
      .from("drivers")
      .select("id, city_id")
      .in("id", driverIds);
    if (requestedError) throw new HttpError(500, "driver_lookup_failed");
    if ((requestedDrivers || []).length !== driverIds.length) throw new HttpError(400, "invalid_driver_ids");
    for (const driver of requestedDrivers || []) {
      await assertCityAccess(req, actor, driver.city_id, "driver", driver.id);
      if (driver.city_id !== cityId) throw new HttpError(400, "invalid_driver_scope");
    }
  }

  let query = service
    .from("drivers")
    .select("id, full_name, city_id, wallet_balance")
    .eq("city_id", cityId)
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .gt("wallet_balance", 0)
    .limit(100);
  if (driverIds) query = query.in("id", driverIds);
  const { data: drivers, error: driverError } = await query;
  if (driverError) throw new HttpError(500, "driver_lookup_failed");

  const actorClient = await getActorClient(actor);
  const processed: JsonObject[] = [];
  const failed: JsonObject[] = [];
  for (const driver of drivers || []) {
    const requestKey = await deterministicUuid(`fleet-payout:${driver.id}:${period.start}:${period.end}`);
    try {
      const { data, error } = await actorClient.rpc("create_driver_payout_for_operator", {
        p_driver_id: driver.id,
        p_period_start: period.start,
        p_period_end: period.end,
        p_request_key: requestKey,
      });
      if (error) throw payoutRpcFailure(error);
      const result = asRpcResult(data);
      if (result.success !== true || typeof result.payout_id !== "string") {
        throw new HttpError(500, "payout_operation_failed");
      }
      processed.push({
        id: result.payout_id,
        driverId: driver.id,
        driverName: driver.full_name,
        totalAmount: result.amount,
        duplicate: result.duplicate === true,
      });
    } catch (error) {
      failed.push({ driverId: driver.id, reason: publicFailureCode(error) });
    }
  }
  const eligible = new Set((drivers || []).map((driver) => driver.id));
  for (const requestedId of driverIds || []) {
    if (!eligible.has(requestedId)) failed.push({ driverId: requestedId, reason: "driver_not_payout_eligible" });
  }

  await recordPayoutEvent(req, actor, "fleet.driver_payout_bulk_reserved", "bulk_reserve_driver_payouts", null, {
    city_id: cityId,
    period_start: period.start,
    period_end: period.end,
    processed: processed.length,
    failed: failed.length,
  });
  return respond(req, {
    processed: processed.length,
    failed: failed.length,
    payouts: processed,
    failures: failed,
  });
}

function routeParts(req: Request): string[] {
  let path = new URL(req.url).pathname;
  path = path.replace(/^\/fleet-payouts\/?/, "");
  path = path.replace(/^\/fleet\/payouts\/?/, "");
  return path.split("/").filter(Boolean);
}

serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;
  try {
    const ip = getClientIp(req) || "unknown";
    await enforceRateLimit(req, "fleet-payouts:ip", ip, 120, 60);
    const actor = await authenticateFleetActor(req);
    await enforceRateLimit(req, "fleet-payouts:actor", actor.authUserId, 60, 60);
    const path = routeParts(req);

    if (path.length === 0 && req.method === "GET") return await handleListPayouts(req, actor);
    if (path.length === 0 && req.method === "POST") return await handleCreatePayout(req, actor);
    if (path.length === 1 && path[0] === "bulk" && req.method === "POST") {
      return await handleBulkPayouts(req, actor);
    }
    if (path.length === 2 && path[1] === "process" && req.method === "POST") {
      return await handleProcessPayout(req, actor, path[0]);
    }
    if (path.length === 1 && req.method === "POST") {
      return await handleProcessPayout(req, actor, path[0]);
    }
    throw new HttpError(404, "not_found");
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
      await recordSecurityEvent(req, {
        eventType: "authorization.fleet_payout_request_denied",
        category: "authorization",
        severity: "critical",
        outcome: "denied",
        actorType: "anonymous",
        action: "fleet_payout_request",
        metadata: { reason: error.code },
      });
    }
    return safeError(req, error);
  }
});
