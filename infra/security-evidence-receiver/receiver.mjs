import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient, GetItemCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { anchorAck, alertAck, hmac, nonce, parseSignature, safeEqual, sha256 } from "./protocol.mjs";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const secrets = new SecretsManagerClient({});
const cache = new Map();
const hex64 = /^[0-9a-f]{64}$/;
const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/;

const response = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

async function secret(arn) {
  if (!arn) throw new Error("secret_not_configured");
  if (cache.has(arn)) return cache.get(arn);
  const value = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
  const resolved = value.SecretString || Buffer.from(value.SecretBinary || []).toString("utf8");
  if (Buffer.byteLength(resolved, "utf8") < 32) throw new Error("secret_too_short");
  cache.set(arn, resolved);
  return resolved;
}

function headers(event) {
  return Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
}

function bodyText(event) {
  const body = event.body || "";
  const value = event.isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
  if (!value || Buffer.byteLength(value, "utf8") > 64 * 1024) throw new Error("invalid_body_size");
  return value;
}

async function existing(pk) {
  const result = await ddb.send(new GetItemCommand({
    TableName: process.env.STATE_TABLE,
    Key: { pk: { S: pk } },
    ConsistentRead: true,
  }));
  return result.Item || null;
}

async function putWorm(key, body, metadata) {
  const retainUntil = new Date(Date.now() + Number(process.env.RETENTION_DAYS || 2555) * 86400000);
  const result = await s3.send(new PutObjectCommand({
    Bucket: process.env.EVIDENCE_BUCKET,
    Key: key,
    Body: body,
    ContentType: "application/json",
    Metadata: metadata,
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: process.env.KMS_KEY_ARN,
    ObjectLockMode: "COMPLIANCE",
    ObjectLockRetainUntilDate: retainUntil,
  }));
  if (!result.VersionId) throw new Error("worm_version_missing");
  return result.VersionId;
}

async function receiveAnchor(raw, h) {
  const requestKey = await secret(process.env.ANCHOR_REQUEST_SECRET_ARN);
  const ackKey = await secret(process.env.ANCHOR_ACK_SECRET_ARN);
  if (requestKey === ackKey) throw new Error("anchor_keys_must_differ");
  const payloadHash = sha256(raw);
  const anchorHash = h["x-nutrio-anchor-hash"] || "";
  const claimedHash = h["x-nutrio-payload-sha256"] || "";
  if (!hex64.test(anchorHash) || claimedHash !== payloadHash ||
      !safeEqual(parseSignature(h["x-nutrio-signature"]), hmac(requestKey, raw))) {
    return response(401, { error: "invalid_anchor_signature" });
  }
  const parsed = JSON.parse(raw);
  const previous = parsed?.anchor?.previous_anchor_hash;
  if (parsed?.evidence_format !== "nutrio-security-anchor-v3" ||
      parsed?.anchor?.anchor_hash !== anchorHash || !/^(GENESIS|[0-9a-f]{64})$/.test(previous || "")) {
    return response(400, { error: "invalid_anchor_payload" });
  }
  const pk = `ANCHOR#${anchorHash}`;
  const prior = await existing(pk);
  if (prior) {
    if (prior.payload_hash?.S !== payloadHash) return response(409, { error: "anchor_hash_conflict" });
    return response(200, JSON.parse(prior.ack?.S || "{}"));
  }
  const objectKey = `anchors/${anchorHash}.json`;
  const version = await putWorm(objectKey, raw, { anchor_hash: anchorHash, payload_sha256: payloadHash });
  const acknowledgedAt = new Date().toISOString();
  const externalReference = `aws-s3:${sha256(`${process.env.EVIDENCE_BUCKET}\n${objectKey}\n${version}`)}`;
  const ack = anchorAck({ anchor_hash: anchorHash, payload_sha256: payloadHash,
    previous_anchor_hash: previous, external_reference: externalReference,
    acknowledged_at: acknowledgedAt, nonce: nonce(), key_id: process.env.ANCHOR_ACK_KEY_ID }, ackKey);
  const expectedHead = previous === "GENESIS" ? { attribute_not_exists: "head_hash" } : { value: previous };
  await ddb.send(new TransactWriteItemsCommand({ TransactItems: [
    { Put: { TableName: process.env.STATE_TABLE, Item: { pk: { S: pk }, payload_hash: { S: payloadHash }, object_key: { S: objectKey }, object_version: { S: version }, ack: { S: JSON.stringify(ack) } }, ConditionExpression: "attribute_not_exists(pk)" } },
    { Update: { TableName: process.env.STATE_TABLE, Key: { pk: { S: "ANCHOR_HEAD" } },
      UpdateExpression: "SET head_hash = :next", ConditionExpression: expectedHead.attribute_not_exists ? "attribute_not_exists(head_hash)" : "head_hash = :previous",
      ExpressionAttributeValues: expectedHead.value ? { ":next": { S: anchorHash }, ":previous": { S: expectedHead.value } } : { ":next": { S: anchorHash } } } },
  ] }));
  return response(200, ack);
}

async function receiveAlert(raw, h) {
  const key = await secret(process.env.ALERT_HMAC_SECRET_ARN);
  const timestamp = h["x-nutrio-timestamp"] || "";
  const requestId = h["x-nutrio-request-id"] || "";
  const keyId = h["x-nutrio-key-id"] || "";
  if (!safeId.test(requestId) || keyId !== process.env.ALERT_HMAC_KEY_ID ||
      Math.abs(Date.now() - new Date(timestamp).getTime()) > 5 * 60 * 1000 ||
      !safeEqual(parseSignature(h["x-nutrio-signature"]), hmac(key, `${timestamp}.${requestId}.${raw}`))) {
    return response(401, { error: "invalid_alert_signature" });
  }
  const parsed = JSON.parse(raw);
  if (parsed?.protocol !== "nutrio-security-alert-v1" || !safeId.test(parsed.alert_id || "") || !hex64.test(parsed.event_hash || "")) {
    return response(400, { error: "invalid_alert_payload" });
  }
  const payloadHash = sha256(raw);
  const pk = `ALERT#${parsed.alert_id}`;
  const prior = await existing(pk);
  if (prior) {
    if (prior.payload_hash?.S !== payloadHash) return response(409, { error: "alert_replay_conflict" });
    return response(200, JSON.parse(prior.ack?.S || "{}"));
  }
  const objectKey = `alerts/${parsed.alert_id}.json`;
  const version = await putWorm(objectKey, raw, { alert_id: parsed.alert_id, event_hash: parsed.event_hash });
  const ack = alertAck({ alert_id: parsed.alert_id, event_hash: parsed.event_hash,
    external_reference: `aws-s3:${sha256(`${process.env.EVIDENCE_BUCKET}\n${objectKey}\n${version}`)}`,
    acknowledged_at: new Date().toISOString(), nonce: nonce(), key_id: keyId }, key);
  await ddb.send(new TransactWriteItemsCommand({ TransactItems: [{ Put: {
    TableName: process.env.STATE_TABLE,
    Item: { pk: { S: pk }, payload_hash: { S: payloadHash }, object_key: { S: objectKey }, object_version: { S: version }, ack: { S: JSON.stringify(ack) } },
    ConditionExpression: "attribute_not_exists(pk)",
  } }] }));
  return response(200, ack);
}

export async function handler(event) {
  try {
    const method = event.requestContext?.http?.method || event.httpMethod;
    if (method !== "POST") return response(405, { error: "method_not_allowed" });
    const h = headers(event);
    if (!(h["content-type"] || "").toLowerCase().startsWith("application/json")) return response(415, { error: "content_type_required" });
    const raw = bodyText(event);
    const path = event.rawPath || event.path || "";
    if (path.endsWith("/anchors")) return await receiveAnchor(raw, h);
    if (path.endsWith("/alerts")) return await receiveAlert(raw, h);
    return response(404, { error: "not_found" });
  } catch (error) {
    console.error("Evidence receiver rejected request", { name: error instanceof Error ? error.name : "unknown" });
    return response(503, { error: "receiver_unavailable" });
  }
}
