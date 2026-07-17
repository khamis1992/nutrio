import { getServiceClient, HttpError } from "./security.ts";

export function getAdminClient() {
  return getServiceClient();
}

export function randomBase64Url(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64Url(bytes);
}

export function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

async function getEncryptionKey() {
  const encoded = Deno.env.get("SPORTHUB_TOKEN_ENCRYPTION_KEY");
  if (!encoded) throw new Error("SPORTHUB_TOKEN_ENCRYPTION_KEY is missing");
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  if (raw.byteLength !== 32) throw new Error("SPORTHUB_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function decryptSecret(value: string) {
  const [ivPart, encryptedPart] = value.split(".");
  if (!ivPart || !encryptedPart) throw new Error("Encrypted secret format is invalid");
  const key = await getEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(ivPart) },
    key,
    decodeBase64Url(encryptedPart),
  );
  return new TextDecoder().decode(decrypted);
}

export function safeRedirectPath(value: unknown) {
  const allowed = new Set(["/dashboard/activity", "/partners/sporthub"]);
  return typeof value === "string" && allowed.has(value)
    ? value
    : "/dashboard/activity";
}

export function requireHttpsUrl(value: string | undefined, configName: string): URL {
  if (!value) throw new HttpError(503, `${configName.toLowerCase()}_missing`);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return url;
  } catch {
    throw new HttpError(503, `${configName.toLowerCase()}_invalid`);
  }
}

export function requireSportHubUrl(value: string | undefined, configName: string): URL {
  const url = requireHttpsUrl(value, configName);
  const configuredRoots = (Deno.env.get("SPORTHUB_ALLOWED_HOSTS") || "sporthubapp.com")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/.test(host) && !host.startsWith(".") && !host.endsWith("."));

  const hostname = url.hostname.toLowerCase();
  const allowed = configuredRoots.some(
    (root) => hostname === root || hostname.endsWith(`.${root}`),
  );
  if (!configuredRoots.length || !allowed) {
    throw new HttpError(503, `${configName.toLowerCase()}_host_not_allowed`);
  }
  return url;
}

export async function readLimitedJson<T>(response: Response, maxBytes = 1024 * 1024): Promise<T> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(502, "sporthub_response_too_large");
  }
  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new HttpError(502, "sporthub_response_too_large");
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(502, "sporthub_response_invalid");
  }
}

export function appRedirect(path: string, params: Record<string, string>) {
  const base = Deno.env.get("NUTRIO_APP_URL") || "https://nutrio.me/nutrio";
  const parsedBase = requireHttpsUrl(base, "NUTRIO_APP_URL");
  const url = new URL(parsedBase.toString().replace(/\/$/, "") + safeRedirectPath(path));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
