import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.99.2";

import { checkRateLimit } from "./rateLimiter.ts";
import {
  BoundedResponseReadError,
  readBoundedResponseJson as readBoundedResponseJsonCore,
  readBoundedResponseText as readBoundedResponseTextCore,
  type BoundedResponseReadOptions,
} from "./boundedResponse.ts";
import {
  getSupabasePublishableKey,
  getSupabaseSecretKey,
} from "./supabaseKeys.ts";

export { getSupabasePublishableKey, getSupabaseSecretKey } from "./supabaseKeys.ts";
export type { BoundedResponseReadOptions } from "./boundedResponse.ts";

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://nutrio.me",
  "https://www.nutrio.me",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const configuredOrigins = (Deno.env.get("APP_ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

for (const origin of configuredOrigins) {
  try {
    const parsed = new URL(origin);
    const localDevelopment = parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    if (
      (parsed.protocol !== "https:" && !localDevelopment) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("invalid_origin");
    }
    DEFAULT_ALLOWED_ORIGINS.add(parsed.origin);
  } catch {
    console.error("Ignoring invalid APP_ALLOWED_ORIGINS entry");
  }
}

export interface SecurityPrincipal {
  user: User;
  role: string;
  isAdmin: boolean;
  aal: "aal1" | "aal2" | null;
}

export interface SecurityEventInput {
  eventType: string;
  category:
    | "authentication"
    | "authorization"
    | "admin"
    | "data_change"
    | "payment"
    | "api"
    | "edge_function"
    | "storage"
    | "configuration"
    | "detection"
    | "incident";
  severity?: "info" | "low" | "medium" | "high" | "critical";
  source?: "client" | "edge" | "database" | "auth" | "storage" | "provider" | "system";
  outcome?: "success" | "failure" | "blocked" | "denied" | "unknown";
  principal?: SecurityPrincipal | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  actorType?: "user" | "admin" | "partner" | "driver" | "coach" | "service" | "anonymous" | "system";
  action?: string;
  resourceType?: string;
  resourceId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export function hasAdminAssurance(
  principal: SecurityPrincipal | null | undefined,
): boolean {
  return principal?.isAdmin === true && principal.aal === "aal2";
}

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message = code) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function requireAllowedHttpsUrl(
  value: string,
  configName: string,
  allowedHostsEnvName: string,
  defaultHosts: readonly string[] = [],
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(503, `${configName.toLowerCase()}_invalid`);
  }

  const roots = (Deno.env.get(allowedHostsEnvName) || defaultHosts.join(","))
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/.test(host) && !host.startsWith(".") && !host.endsWith("."));
  const hostname = url.hostname.toLowerCase();
  const allowed = roots.some((root) => hostname === root || hostname.endsWith(`.${root}`));

  if (url.protocol !== "https:" || url.username || url.password || !roots.length || !allowed) {
    throw new HttpError(503, `${configName.toLowerCase()}_invalid`);
  }
  return url;
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-request-id, x-correlation-id, x-internal-secret, mcp-protocol-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (origin && DEFAULT_ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function errorResponse(req: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(req, { error: error.code, message: error.message }, error.status);
  }

  console.error("Unhandled Edge Function error", safeErrorDetails(error));
  return jsonResponse(req, { error: "internal_error" }, 500);
}

export function safeErrorDetails(error: unknown): Record<string, string | number> {
  if (!error || typeof error !== "object") {
    return { kind: typeof error };
  }

  const candidate = error as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
  };
  const details: Record<string, string | number> = {};
  if (typeof candidate.name === "string") details.name = candidate.name.slice(0, 80);
  if (typeof candidate.code === "string") details.code = candidate.code.slice(0, 80);
  if (typeof candidate.status === "number" && Number.isFinite(candidate.status)) {
    details.status = candidate.status;
  }
  return Object.keys(details).length > 0 ? details : { kind: "error" };
}

export function handlePreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: getCorsHeaders(req) });
}

export function requirePost(req: Request): void {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
}

function assertRequestLimit(maxBytes: number): void {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 10 * 1024 * 1024) {
    throw new HttpError(500, "invalid_request_limit");
  }
}

function assertContentType(req: Request, allowedMimeTypes: readonly string[]): void {
  const contentType = (req.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!allowedMimeTypes.includes(contentType)) {
    throw new HttpError(415, "content_type_not_allowed");
  }
}

async function readBodyBytes(req: Request, maxBytes: number): Promise<Uint8Array> {
  assertRequestLimit(maxBytes);

  const declaredLengthHeader = req.headers.get("content-length");
  const declaredLength = declaredLengthHeader === null
    ? null
    : Number(declaredLengthHeader);
  if (
    declaredLength !== null &&
    (!Number.isSafeInteger(declaredLength) || declaredLength < 0)
  ) {
    throw new HttpError(400, "invalid_content_length");
  }
  if (declaredLength !== null && declaredLength > maxBytes) {
    throw new HttpError(413, "request_too_large");
  }

  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "invalid_json");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request_too_large").catch(() => undefined);
        throw new HttpError(413, "request_too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid_json");
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readTextBody(
  req: Request,
  maxBytes = 64 * 1024,
  allowedMimeTypes: readonly string[] = ["text/plain"],
): Promise<string> {
  assertContentType(req, allowedMimeTypes);
  const bytes = await readBodyBytes(req, maxBytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HttpError(400, "invalid_utf8");
  }
}

export async function readJsonBody<T>(req: Request, maxBytes = 64 * 1024): Promise<T> {
  const raw = await readTextBody(req, maxBytes, ["application/json"]);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

export async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  options: BoundedResponseReadOptions = {},
): Promise<string> {
  try {
    return await readBoundedResponseTextCore(response, maxBytes, options);
  } catch (error) {
    if (error instanceof BoundedResponseReadError) {
      throw new HttpError(error.status, error.code);
    }
    throw error;
  }
}

export async function readBoundedResponseJson<T>(
  response: Response,
  maxBytes: number,
  options: BoundedResponseReadOptions = {},
): Promise<T> {
  try {
    return await readBoundedResponseJsonCore<T>(response, maxBytes, options);
  } catch (error) {
    if (error instanceof BoundedResponseReadError) {
      throw new HttpError(error.status, error.code);
    }
    throw error;
  }
}

export function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new HttpError(503, "backend_url_not_configured");
  let key: string;
  try {
    key = getSupabaseSecretKey();
  } catch {
    throw new HttpError(503, "backend_secret_not_configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getAnonClient(authorization: string) {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new HttpError(503, "backend_url_not_configured");
  let key: string;
  try {
    key = getSupabasePublishableKey();
  } catch {
    throw new HttpError(503, "backend_publishable_key_not_configured");
  }
  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getAuthenticatedClient(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    throw new HttpError(401, "authentication_required");
  }
  return getAnonClient(authorization);
}

function getVerifiedTokenAal(token: string): "aal1" | "aal2" | null {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { aal?: unknown };
    return payload.aal === "aal1" || payload.aal === "aal2" ? payload.aal : null;
  } catch {
    return null;
  }
}

export async function authenticateRequest(req: Request): Promise<SecurityPrincipal> {
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    throw new HttpError(401, "authentication_required");
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const authClient = getAnonClient(authorization);
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) throw new HttpError(401, "invalid_or_expired_token");

  const service = getServiceClient();
  const { data: roles, error: roleError } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    console.error("Unable to load caller role:", roleError.message);
    throw new HttpError(503, "authorization_unavailable");
  }

  const roleNames = (roles || []).map((row) => String(row.role));
  const role = roleNames.includes("admin") ? "admin" : (roleNames[0] || "user");
  return {
    user,
    role,
    isAdmin: roleNames.includes("admin"),
    // The token was validated by auth.getUser above; decoding here reads the
    // verified assurance claim and does not replace signature verification.
    aal: getVerifiedTokenAal(token),
  };
}

export async function requireAdmin(req: Request): Promise<SecurityPrincipal> {
  const principal = await authenticateRequest(req);
  if (!principal.isAdmin) {
    await recordSecurityEvent(req, {
      eventType: "authorization.admin_access_denied",
      category: "authorization",
      severity: "high",
      outcome: "denied",
      principal,
      action: "admin_access",
    });
    throw new HttpError(403, "admin_required");
  }
  if (principal.aal !== "aal2") {
    await recordSecurityEvent(req, {
      eventType: "authorization.admin_mfa_required",
      category: "authorization",
      severity: "high",
      outcome: "denied",
      principal,
      action: "admin_access_without_step_up",
    });
    throw new HttpError(403, "mfa_required");
  }
  return principal;
}

export async function requireMfaAssurance(
  req: Request,
  principal: SecurityPrincipal,
  action: string,
): Promise<void> {
  if (principal.aal === "aal2") return;

  await recordSecurityEvent(req, {
    eventType: "authorization.privileged_mfa_required",
    category: "authorization",
    severity: "high",
    outcome: "denied",
    principal,
    actorType: "admin",
    action,
  });
  throw new HttpError(403, "mfa_required");
}

export async function requireSelfOrAdmin(
  req: Request,
  requestedUserId: string,
): Promise<SecurityPrincipal> {
  const principal = await authenticateRequest(req);
  await assertSelfOrAdmin(req, principal, requestedUserId);
  return principal;
}

export async function assertSelfOrAdmin(
  req: Request,
  principal: SecurityPrincipal,
  requestedUserId: string,
): Promise<void> {
  if (principal.user.id !== requestedUserId && !principal.isAdmin) {
    await recordSecurityEvent(req, {
      eventType: "authorization.object_access_denied",
      category: "authorization",
      severity: "high",
      outcome: "denied",
      principal,
      action: "access_other_user",
      resourceType: "auth.user",
      resourceId: requestedUserId,
    });
    throw new HttpError(403, "forbidden");
  }
  if (principal.user.id !== requestedUserId && principal.aal !== "aal2") {
    await recordSecurityEvent(req, {
      eventType: "authorization.admin_mfa_required",
      category: "authorization",
      severity: "high",
      outcome: "denied",
      principal,
      action: "access_other_user_without_step_up",
      resourceType: "auth.user",
      resourceId: requestedUserId,
    });
    throw new HttpError(403, "mfa_required");
  }
}

async function hashValue(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([hashValue(left), hashValue(right)]);
  let difference = leftHash.length ^ rightHash.length;
  const length = Math.max(leftHash.length, rightHash.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftHash[index] || 0) ^ (rightHash[index] || 0);
  }
  return difference === 0;
}

export async function requireInternalSecret(
  req: Request,
  envName = "INTERNAL_FUNCTION_SECRET",
): Promise<void> {
  const expected = Deno.env.get(envName) || "";
  const received = req.headers.get("x-internal-secret") || "";
  if (!expected || !received || !(await constantTimeEqual(expected, received))) {
    await recordSecurityEvent(req, {
      eventType: "authorization.internal_secret_denied",
      category: "authorization",
      severity: "critical",
      outcome: "denied",
      actorType: "anonymous",
      action: "invoke_internal_function",
      metadata: { secret_name: envName },
    });
    throw new HttpError(401, "invalid_internal_credentials");
  }
}

export async function requireAdminOrInternal(
  req: Request,
  envName = "INTERNAL_FUNCTION_SECRET",
): Promise<SecurityPrincipal | null> {
  if (req.headers.has("x-internal-secret")) {
    await requireInternalSecret(req, envName);
    return null;
  }
  return await requireAdmin(req);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getClientIp(req: Request): string | null {
  // Supabase documents X-Forwarded-For as the client IP source at its API
  // boundary. Prefer the first hop supplied by the gateway and only use the
  // Cloudflare header as a fallback for deployments placed behind Cloudflare.
  const forwarded = req.headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    null;
  if (!candidate || candidate.length > 64 || /[\r\n\0]/.test(candidate)) {
    return null;
  }
  return candidate;
}

function getSafeHeader(req: Request, name: string, maxLength: number): string | null {
  const value = req.headers.get(name)?.trim();
  if (!value || /[\r\n\0]/.test(value)) return null;
  return value.slice(0, maxLength);
}

export function getRequestId(req: Request): string {
  return (
    getSafeHeader(req, "sb-request-id", 160) ||
    getSafeHeader(req, "x-request-id", 160) ||
    crypto.randomUUID()
  );
}

export async function getSessionFingerprint(req: Request): Promise<string | null> {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) return null;
  const digest = await hashValue(match[1]);
  const hexadecimal = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hexadecimal}`;
}

export async function enforceRateLimit(
  req: Request,
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ remaining: number; resetAt: number }> {
  const service = getServiceClient();
  const result = await checkRateLimit(
    service,
    `${scope}:${identifier}`.slice(0, 250),
    limit,
    windowSeconds,
  );

  if (!result.allowed) {
    await recordSecurityEvent(req, {
      eventType: "api.rate_limit_blocked",
      category: "api",
      severity: "medium",
      outcome: "blocked",
      actorType: "anonymous",
      action: scope,
      metadata: { limit, window_seconds: windowSeconds },
    });
    throw new HttpError(429, "rate_limit_exceeded");
  }

  return { remaining: result.remaining, resetAt: result.resetAt };
}

export async function recordSecurityEvent(
  req: Request,
  event: SecurityEventInput,
): Promise<void> {
  try {
    const service = getServiceClient();
    const principal = event.principal;
    const actorUserId = event.actorUserId ?? principal?.user.id ?? null;
    const actorRole = event.actorRole ?? principal?.role ?? null;
    const actorType = event.actorType ?? (
      principal?.isAdmin ? "admin" : principal ? "user" : "anonymous"
    );
    const countryCode = getSafeHeader(req, "cf-ipcountry", 2)?.toUpperCase();

    const { error } = await service.rpc("record_security_event", {
      p_event_type: event.eventType,
      p_category: event.category,
      p_severity: event.severity || "info",
      p_source: event.source || "edge",
      p_outcome: event.outcome || "success",
      p_actor_user_id: actorUserId,
      p_actor_role: actorRole,
      p_actor_type: actorType,
      p_action: event.action || null,
      p_resource_type: event.resourceType || null,
      p_resource_id: event.resourceId || null,
      p_request_id: getRequestId(req),
      p_correlation_id: event.correlationId?.slice(0, 160) ||
        getSafeHeader(req, "x-correlation-id", 160),
      p_session_fingerprint: await getSessionFingerprint(req),
      p_ip_address: getClientIp(req),
      p_country_code: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
      p_user_agent: getSafeHeader(req, "user-agent", 1000),
      p_metadata: event.metadata || {},
    });

    if (error) console.error("Security event write failed:", error.message);
  } catch (error) {
    // Telemetry must never turn a denied request into an allowed request or
    // hide the original application result.
    console.error("Security event capture unavailable:", error);
  }
}
