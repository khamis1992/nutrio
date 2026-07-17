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

function decodeEncryptionKey(encoded: string) {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  if (raw.byteLength !== 32) throw new Error("SPORTHUB_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return raw;
}

async function getEncryptionKey(requestedKeyId?: string) {
  if (requestedKeyId === "legacy") {
    const legacyEncoded = Deno.env.get("SPORTHUB_TOKEN_ENCRYPTION_KEY");
    if (legacyEncoded) {
      const key = await crypto.subtle.importKey(
        "raw",
        decodeEncryptionKey(legacyEncoded),
        "AES-GCM",
        false,
        ["encrypt", "decrypt"],
      );
      return { key, keyId: "legacy" };
    }
  }

  const keyringValue = Deno.env.get("SPORTHUB_TOKEN_ENCRYPTION_KEYS")?.trim();
  if (keyringValue) {
    let keyring: Record<string, unknown>;
    try {
      keyring = JSON.parse(keyringValue) as Record<string, unknown>;
    } catch {
      throw new Error("SPORTHUB_TOKEN_ENCRYPTION_KEYS is invalid");
    }
    const keyId = requestedKeyId ||
      (Deno.env.get("SPORTHUB_TOKEN_ENCRYPTION_KEY_ID") || "").trim();
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(keyId)) {
      throw new Error("SPORTHUB_TOKEN_ENCRYPTION_KEY_ID is invalid");
    }
    const encoded = keyring[keyId];
    if (typeof encoded !== "string") {
      throw new Error("SportHub token encryption key is unavailable");
    }
    const key = await crypto.subtle.importKey(
      "raw",
      decodeEncryptionKey(encoded),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"],
    );
    return { key, keyId };
  }

  if (requestedKeyId && requestedKeyId !== "legacy") {
    throw new Error("SportHub token encryption key is unavailable");
  }
  const encoded = Deno.env.get("SPORTHUB_TOKEN_ENCRYPTION_KEY");
  if (!encoded) throw new Error("SPORTHUB_TOKEN_ENCRYPTION_KEY is missing");
  const key = await crypto.subtle.importKey(
    "raw",
    decodeEncryptionKey(encoded),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
  return { key, keyId: "legacy" };
}

function tokenAdditionalData(context: string) {
  if (!/^sporthub:[0-9a-f-]{36}:(?:access|refresh)$/i.test(context)) {
    throw new Error("SportHub token encryption context is invalid");
  }
  return new TextEncoder().encode(`nutrio:sporthub-token:v2:${context}`);
}

export async function encryptSecret(value: string, context: string) {
  if (!value || value.length > 16_384) throw new Error("SportHub token is invalid");
  const { key, keyId } = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: tokenAdditionalData(context) },
    key,
    new TextEncoder().encode(value),
  );
  return `v2.${keyId}.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function isLegacyEncryptedSecret(value: string) {
  return !value.startsWith("v2.");
}

export async function decryptSecret(value: string, context: string) {
  const parts = value.split(".");
  let decrypted: ArrayBuffer;
  if (parts[0] === "v2") {
    if (parts.length !== 4 || !/^[A-Za-z0-9_-]{1,32}$/.test(parts[1])) {
      throw new Error("Encrypted secret format is invalid");
    }
    const iv = decodeBase64Url(parts[2]);
    const ciphertext = decodeBase64Url(parts[3]);
    if (iv.byteLength !== 12 || ciphertext.byteLength > 20_000) {
      throw new Error("Encrypted secret format is invalid");
    }
    const { key } = await getEncryptionKey(parts[1]);
    decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: tokenAdditionalData(context) },
      key,
      ciphertext,
    );
  } else {
    if (parts.length !== 2) throw new Error("Encrypted secret format is invalid");
    const iv = decodeBase64Url(parts[0]);
    const ciphertext = decodeBase64Url(parts[1]);
    if (iv.byteLength !== 12 || ciphertext.byteLength > 20_000) {
      throw new Error("Encrypted secret format is invalid");
    }
    const { key } = await getEncryptionKey("legacy");
    decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );
  }

  const plaintext = new TextDecoder("utf-8", { fatal: true }).decode(decrypted);
  if (!plaintext || plaintext.length > 16_384) {
    throw new Error("Decrypted SportHub token is invalid");
  }
  return plaintext;
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
  const configuredHosts = (Deno.env.get("SPORTHUB_ALLOWED_HOSTS") || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/.test(host) && !host.startsWith(".") && !host.endsWith("."));

  const hostname = url.hostname.toLowerCase();
  const allowed = configuredHosts.includes(hostname);
  if (!configuredHosts.length || !allowed) {
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
