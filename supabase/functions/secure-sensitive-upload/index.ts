import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getAuthenticatedClient,
  getClientIp,
  getServiceClient,
  handlePreflight,
  hasAdminAssurance,
  HttpError,
  jsonResponse,
  readBoundedResponseText,
  recordSecurityEvent,
  requireAllowedHttpsUrl,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 512 * 1024;
const SCANNER_RESPONSE_LIMIT = 32 * 1024;
const SCANNER_TIMEOUT_MS = 45_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_PATH_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

type SensitiveBucket =
  | "blood-reports"
  | "ticket-attachments"
  | "coach-photos"
  | "coach-attachments"
  | "fleet-documents";

type ScanStatus = "clean" | "validated_only" | "rejected" | "error";

interface ScanResult {
  clean: boolean;
  provider: string;
  reference: string | null;
  threatName: string | null;
}

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "text/plain": ["txt"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
};

const BUCKET_TYPES: Record<SensitiveBucket, ReadonlySet<string>> = {
  "blood-reports": new Set(["application/pdf"]),
  "ticket-attachments": new Set(Object.keys(MIME_EXTENSIONS)),
  "coach-photos": new Set(["image/jpeg", "image/png", "image/webp"]),
  "coach-attachments": new Set(Object.keys(MIME_EXTENSIONS)),
  "fleet-documents": new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
};

async function readBoundedBody(req: Request): Promise<Uint8Array> {
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "request_too_large");
  }

  if (!req.body) throw new HttpError(400, "file_required");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(413, "request_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readUploadForm(req: Request): Promise<{
  bucket: SensitiveBucket;
  path: string;
  file: File;
}> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new HttpError(415, "multipart_form_required");
  }

  const raw = await readBoundedBody(req);
  let form: FormData;
  try {
    form = await new Response(raw, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new HttpError(400, "invalid_multipart_form");
  }

  const bucket = form.get("bucket");
  const path = form.get("path");
  const file = form.get("file");

  if (typeof bucket !== "string" || !(bucket in BUCKET_TYPES)) {
    throw new HttpError(400, "invalid_bucket");
  }
  if (typeof path !== "string" || !isSafeObjectPath(path)) {
    throw new HttpError(400, "invalid_object_path");
  }
  if (!(file instanceof File) || file.size <= 0) {
    throw new HttpError(400, "file_required");
  }
  if (file.size > MAX_FILE_BYTES) throw new HttpError(413, "file_too_large");

  return { bucket: bucket as SensitiveBucket, path, file };
}

function isSafeObjectPath(path: string): boolean {
  return path.length >= 3 &&
    path.length <= 500 &&
    SAFE_PATH_PATTERN.test(path) &&
    !path.startsWith("/") &&
    !path.includes("..") &&
    !path.includes("//");
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const needle = new TextEncoder().encode(value);
  outer: for (let offset = 0; offset <= bytes.length - needle.length; offset += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (bytes[offset + index] !== needle[index]) continue outer;
    }
    return true;
  }
  return false;
}

function containsZipMetadata(bytes: Uint8Array, value: string): boolean {
  // ZIP central directories live near the end of the file. Limiting the search
  // avoids repeatedly scanning a full 10 MiB upload for short metadata names.
  const ZIP_METADATA_WINDOW = 512 * 1024;
  const start = Math.max(0, bytes.length - ZIP_METADATA_WINDOW);
  return containsAscii(bytes.subarray(start), value);
}

function validateFileSignature(bytes: Uint8Array, declaredMime: string): string {
  switch (declaredMime) {
    case "application/pdf":
      if (hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return declaredMime;
      break;
    case "image/jpeg":
      if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return declaredMime;
      break;
    case "image/png":
      if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return declaredMime;
      break;
    case "image/webp":
      if (
        hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
      ) return declaredMime;
      break;
    case "text/plain":
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        if (!bytes.includes(0)) return declaredMime;
      } catch {
        // Rejected below.
      }
      break;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      if (
        hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04]) &&
        containsZipMetadata(bytes, "[Content_Types].xml") &&
        containsZipMetadata(bytes, "word/")
      ) return declaredMime;
      break;
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      if (
        hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04]) &&
        containsZipMetadata(bytes, "[Content_Types].xml") &&
        containsZipMetadata(bytes, "xl/")
      ) return declaredMime;
      break;
  }
  throw new HttpError(415, "file_signature_mismatch");
}

function validateExtension(path: string, mime: string): void {
  const extension = path.split(".").pop()?.toLowerCase() || "";
  if (!MIME_EXTENSIONS[mime]?.includes(extension)) {
    throw new HttpError(415, "file_extension_mismatch");
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function authorizeUpload(
  req: Request,
  principal: SecurityPrincipal,
  bucket: SensitiveBucket,
  path: string,
): Promise<void> {
  const parts = path.split("/");
  const client = getAuthenticatedClient(req);
  let allowed = false;

  if (bucket === "blood-reports") {
    allowed = parts.length === 2 && UUID_PATTERN.test(parts[0]) &&
      (parts[0] === principal.user.id || hasAdminAssurance(principal));
  } else if (bucket === "ticket-attachments") {
    if (parts.length === 2 && UUID_PATTERN.test(parts[0])) {
      const { data, error } = await client.rpc("can_access_support_ticket_storage", {
        p_ticket_id: parts[0],
      });
      if (error) throw new HttpError(503, "authorization_unavailable");
      allowed = data === true;
    }
  } else if (bucket === "coach-photos") {
    if (parts.length === 2 && UUID_PATTERN.test(parts[0])) {
      const { data, error } = await client.rpc("can_access_coach_photo_storage", {
        p_client_id: parts[0],
      });
      if (error) throw new HttpError(503, "authorization_unavailable");
      allowed = data === true;
    }
  } else if (bucket === "coach-attachments") {
    if (parts.length === 3 && UUID_PATTERN.test(parts[0]) && UUID_PATTERN.test(parts[1])) {
      const { data, error } = await client.rpc("can_access_coach_attachment_storage", {
        p_coach_id: parts[0],
        p_client_id: parts[1],
      });
      if (error) throw new HttpError(503, "authorization_unavailable");
      allowed = data === true;
    }
  } else if (bucket === "fleet-documents") {
    if (
      parts.length === 5 && parts[0] === "cities" && UUID_PATTERN.test(parts[1]) &&
      (parts[2] === "drivers" || parts[2] === "vehicles") && UUID_PATTERN.test(parts[3])
    ) {
      const { data, error } = await client.rpc("can_access_fleet_document_storage", {
        p_city_id: parts[1],
      });
      if (error) throw new HttpError(503, "authorization_unavailable");
      allowed = data === true;
    }
  }

  if (!allowed) {
    await recordSecurityEvent(req, {
      eventType: "authorization.sensitive_upload_denied",
      category: "authorization",
      severity: "high",
      outcome: "denied",
      principal,
      action: "upload_sensitive_file",
      resourceType: `storage.${bucket}`,
    });
    throw new HttpError(403, "upload_not_authorized");
  }
}

async function scanForMalware(bytes: Uint8Array, mime: string, extension: string): Promise<ScanResult | null> {
  const scannerUrl = Deno.env.get("MALWARE_SCANNER_URL") || "";
  const scannerKey = Deno.env.get("MALWARE_SCANNER_API_KEY") || "";
  const scanRequired = (Deno.env.get("REQUIRE_MALWARE_SCAN") || "true").toLowerCase() !== "false";

  if (!scannerUrl || !scannerKey) {
    if (scanRequired) throw new HttpError(503, "malware_scanner_not_configured");
    return null;
  }

  const scannerOrigin = requireAllowedHttpsUrl(
    scannerUrl,
    "MALWARE_SCANNER_URL",
    "MALWARE_SCANNER_ALLOWED_HOSTS",
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCANNER_TIMEOUT_MS);
  const body = new FormData();
  body.set("file", new File([bytes], `upload.${extension}`, { type: mime }));

  try {
    const response = await fetch(scannerOrigin, {
      method: "POST",
      headers: { Authorization: `Bearer ${scannerKey}` },
      body,
      signal: controller.signal,
    });
    const raw = await readBoundedResponseText(response, SCANNER_RESPONSE_LIMIT, {
      tooLargeCode: "scanner_response_too_large",
      invalidBodyCode: "invalid_scanner_response",
    });
    if (!response.ok) throw new HttpError(503, "malware_scanner_unavailable");

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.clean !== "boolean") throw new HttpError(502, "invalid_scanner_response");
    return {
      clean: parsed.clean,
      provider: String(parsed.provider || scannerOrigin.hostname).slice(0, 80),
      reference: parsed.scan_id ? String(parsed.scan_id).slice(0, 240) : null,
      threatName: parsed.threat ? String(parsed.threat).slice(0, 240) : null,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HttpError(503, "malware_scanner_timeout");
    }
    throw new HttpError(503, "malware_scanner_unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

async function recordScan(
  bucket: SensitiveBucket,
  path: string,
  principal: SecurityPrincipal,
  status: ScanStatus,
  hash: string,
  bytes: Uint8Array,
  mime: string,
  result: ScanResult | null,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const service = getServiceClient();
  const { data, error } = await service.rpc("record_sensitive_file_scan", {
    p_bucket_id: bucket,
    p_object_path: path,
    p_uploader_user_id: principal.user.id,
    p_status: status,
    p_sha256: hash,
    p_size_bytes: bytes.byteLength,
    p_detected_mime: mime,
    p_scanner_provider: result?.provider || null,
    p_scanner_reference: result?.reference || null,
    p_threat_name: result?.threatName || null,
    p_metadata: metadata,
  });
  if (error || !data) throw new HttpError(503, "scan_evidence_unavailable");
  return String(data);
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let upload: Awaited<ReturnType<typeof readUploadForm>> | null = null;

  try {
    requirePost(req);
    principal = await authenticateRequest(req);
    await enforceRateLimit(
      req,
      "sensitive-upload",
      `${principal.user.id}:${getClientIp(req) || "unknown"}`,
      30,
      10 * 60,
    );

    upload = await readUploadForm(req);
    await authorizeUpload(req, principal, upload.bucket, upload.path);

    const declaredMime = upload.file.type.toLowerCase();
    if (!BUCKET_TYPES[upload.bucket].has(declaredMime)) {
      throw new HttpError(415, "file_type_not_allowed");
    }
    validateExtension(upload.path, declaredMime);

    const bytes = new Uint8Array(await upload.file.arrayBuffer());
    const detectedMime = validateFileSignature(bytes, declaredMime);
    const hash = await sha256Hex(bytes);
    const extension = upload.path.split(".").pop()?.toLowerCase() || "bin";

    let scanResult: ScanResult | null;
    try {
      scanResult = await scanForMalware(bytes, detectedMime, extension);
    } catch (scanError) {
      await recordScan(
        upload.bucket,
        upload.path,
        principal,
        "error",
        hash,
        bytes,
        detectedMime,
        null,
        { reason: scanError instanceof HttpError ? scanError.code : "scanner_error" },
      ).catch((error) => console.error("Unable to record failed scan:", error));
      await recordSecurityEvent(req, {
        eventType: "storage.malware_scan_unavailable",
        category: "storage",
        severity: "high",
        outcome: "failure",
        principal,
        action: "scan_sensitive_file",
        resourceType: `storage.${upload.bucket}`,
        metadata: { sha256: hash },
      });
      throw scanError;
    }

    if (scanResult && !scanResult.clean) {
      await recordScan(
        upload.bucket,
        upload.path,
        principal,
        "rejected",
        hash,
        bytes,
        detectedMime,
        scanResult,
      );
      await recordSecurityEvent(req, {
        eventType: "storage.malware_upload_blocked",
        category: "storage",
        severity: "critical",
        outcome: "blocked",
        principal,
        action: "upload_sensitive_file",
        resourceType: `storage.${upload.bucket}`,
        metadata: { sha256: hash, scanner_reference: scanResult.reference },
      });
      throw new HttpError(422, "malware_detected");
    }

    const service = getServiceClient();
    const { error: uploadError } = await service.storage
      .from(upload.bucket)
      .upload(upload.path, bytes, {
        contentType: detectedMime,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      console.error("Sensitive storage upload failed:", uploadError.message);
      throw new HttpError(uploadError.message.includes("already exists") ? 409 : 503, "storage_upload_failed");
    }

    const status: ScanStatus = scanResult ? "clean" : "validated_only";
    let evidenceId: string;
    try {
      evidenceId = await recordScan(
        upload.bucket,
        upload.path,
        principal,
        status,
        hash,
        bytes,
        detectedMime,
        scanResult,
      );
    } catch (error) {
      let cleanupFailure: string | null = null;
      try {
        const { error: cleanupError } = await service.storage
          .from(upload.bucket)
          .remove([upload.path]);
        cleanupFailure = cleanupError?.message || null;
      } catch (cleanupError) {
        cleanupFailure = cleanupError instanceof Error ? cleanupError.message : "cleanup_request_failed";
      }
      if (cleanupFailure) {
        console.error("Unable to remove upload without scan evidence:", cleanupFailure);
        await recordSecurityEvent(req, {
          eventType: "storage.orphaned_sensitive_upload",
          category: "storage",
          severity: "critical",
          outcome: "failure",
          principal,
          action: "remove_untracked_sensitive_file",
          resourceType: `storage.${upload.bucket}`,
          resourceId: upload.path,
          metadata: { sha256: hash, cleanup_error: cleanupFailure.slice(0, 240) },
        });
      }
      throw error;
    }

    await recordSecurityEvent(req, {
      eventType: "storage.sensitive_upload_accepted",
      category: "storage",
      severity: status === "clean" ? "info" : "medium",
      outcome: "success",
      principal,
      action: "upload_sensitive_file",
      resourceType: `storage.${upload.bucket}`,
      resourceId: upload.path,
      metadata: { sha256: hash, size_bytes: bytes.byteLength, scan_status: status, evidence_id: evidenceId },
    });

    return jsonResponse(req, {
      path: upload.path,
      sha256: hash,
      scan_status: status,
      evidence_id: evidenceId,
    }, 201);
  } catch (error) {
    if (principal && upload && error instanceof HttpError && error.status >= 400 && error.status < 500) {
      await recordSecurityEvent(req, {
        eventType: "storage.sensitive_upload_rejected",
        category: "storage",
        severity: error.status === 403 ? "high" : "medium",
        outcome: error.status === 403 ? "denied" : "blocked",
        principal,
        action: "upload_sensitive_file",
        resourceType: `storage.${upload.bucket}`,
        metadata: { reason: error.code },
      });
    }
    return errorResponse(req, error);
  }
});
