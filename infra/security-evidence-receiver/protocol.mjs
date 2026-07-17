import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");
export const hmac = (secret, value) => createHmac("sha256", secret).update(value, "utf8").digest("hex");

export function safeEqual(left, right) {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function parseSignature(value) {
  const normalized = String(value || "").replace(/^sha256=/i, "").toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : "";
}

export function anchorAck(fields, secret) {
  const protocol = "nutrio-security-anchor-ack-v1";
  const payload = [protocol, fields.anchor_hash, fields.payload_sha256,
    fields.previous_anchor_hash, fields.external_reference, fields.acknowledged_at,
    fields.nonce, fields.key_id].join("\n");
  return { protocol, ...fields, signature: `sha256=${hmac(secret, payload)}` };
}

export function alertAck(fields, secret) {
  const protocol = "nutrio-security-alert-ack-v1";
  const payload = [protocol, fields.alert_id, fields.event_hash,
    fields.external_reference, fields.acknowledged_at, fields.nonce,
    fields.key_id].join("\n");
  return { protocol, ...fields, signature: `sha256=${hmac(secret, payload)}` };
}

export const nonce = () => randomBytes(18).toString("base64url");

