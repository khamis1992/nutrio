import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  throw new Error(message);
}

function assertHex(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail(`${label} is not a SHA-256 digest`);
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseChecksum(value, expectedFilename) {
  const line = value.trimEnd();
  const match = line.match(/^([0-9a-f]{64})  ([^\r\n]+)$/);
  if (!match) fail("Checksum file does not use the SHA-256 two-space format");
  if (match[2] !== expectedFilename) fail("Checksum filename does not match the evidence file");
  return match[1];
}

function verifyAnchor(anchor, memberships, eventsById) {
  const ordered = memberships
    .filter((entry) => entry.anchor_hash === anchor.anchor_hash)
    .sort((left, right) => Number(left.ordinal) - Number(right.ordinal));
  if (ordered.length !== Number(anchor.event_count)) {
    fail(`Anchor ${anchor.anchor_hash} membership count mismatch`);
  }
  let membershipHash = sha256("NUTRIO-EVENT-MEMBERSHIP-V3");
  ordered.forEach((entry, index) => {
    if (Number(entry.ordinal) !== index + 1) {
      fail(`Anchor ${anchor.anchor_hash} has a non-contiguous ordinal`);
    }
    assertHex(entry.event_hash_snapshot, "Membership event hash");
    membershipHash = sha256(
      `${membershipHash}:${entry.ordinal}:${entry.event_sequence}:${entry.event_id}:${entry.event_hash_snapshot}`,
    );
    const exportedEvent = eventsById.get(entry.event_id);
    if (exportedEvent && !safeEqual(exportedEvent.event_hash, entry.event_hash_snapshot)) {
      fail(`Event ${entry.event_id} does not match its anchored hash snapshot`);
    }
  });
  if (!safeEqual(membershipHash, anchor.membership_hash)) {
    fail(`Anchor ${anchor.anchor_hash} membership digest mismatch`);
  }
  if (ordered.length > 0) {
    const first = ordered[0];
    const last = ordered.at(-1);
    if (
      Number(first.event_sequence) !== Number(anchor.first_sequence) ||
      Number(last.event_sequence) !== Number(anchor.last_sequence) ||
      !safeEqual(last.event_hash_snapshot, anchor.last_hash)
    ) {
      fail(`Anchor ${anchor.anchor_hash} boundary metadata mismatch`);
    }
  }
}

async function main() {
  const [, , evidenceArgument, checksumArgument] = process.argv;
  if (!evidenceArgument) {
    fail("Usage: node scripts/security/verify-forensic-export.mjs <evidence.json> [evidence.json.sha256]");
  }
  const evidencePath = resolve(evidenceArgument);
  const bytes = await readFile(evidencePath);
  const fileHash = sha256(bytes);
  if (checksumArgument) {
    const checksum = parseChecksum(
      await readFile(resolve(checksumArgument), "utf8"),
      basename(evidencePath),
    );
    if (!safeEqual(fileHash, checksum)) fail("Evidence file SHA-256 does not match its checksum file");
  }

  const payload = JSON.parse(bytes.toString("utf8"));
  if (payload?.manifest?.evidence_format !== "nutrio-security-ledger-export-v4") {
    fail("Unsupported evidence format; expected Nutrio ledger export v4");
  }
  const events = Array.isArray(payload.events) ? payload.events : fail("Events array is missing");
  const anchors = Array.isArray(payload.anchors) ? payload.anchors : fail("Anchors array is missing");
  const memberships = Array.isArray(payload.anchor_memberships)
    ? payload.anchor_memberships
    : fail("Anchor memberships are missing");
  const receipts = Array.isArray(payload.external_receipts)
    ? payload.external_receipts
    : fail("External receipts are missing");
  const eventsById = new Map();
  const sequences = new Set();
  for (const event of events) {
    assertHex(event.event_hash, `Event ${event.event_id} hash`);
    if (eventsById.has(event.event_id) || sequences.has(String(event.sequence_number))) {
      fail("Duplicate event ID or sequence in export page");
    }
    eventsById.set(event.event_id, event);
    sequences.add(String(event.sequence_number));
  }
  for (const anchor of anchors) {
    assertHex(anchor.anchor_hash, "Anchor hash");
    assertHex(anchor.membership_hash, "Anchor membership hash");
    verifyAnchor(anchor, memberships, eventsById);
  }
  const anchorHashes = new Set(anchors.map((anchor) => anchor.anchor_hash));
  for (const receipt of receipts) {
    assertHex(receipt.receipt_hash, "External receipt hash");
    if (!anchorHashes.has(receipt.anchor_hash)) fail("Receipt references an absent anchor");
    if (receipt.integrity_version >= 3 && receipt.acknowledgement_validated !== true) {
      fail("Database-verified receiver acknowledgement is marked invalid");
    }
    if (receipt.receipt_signature != null) assertHex(receipt.receipt_signature, "Receipt signature");
  }

  const result = {
    valid: true,
    file: basename(evidencePath),
    sha256: fileHash,
    events: events.length,
    anchors: anchors.length,
    memberships: memberships.length,
    external_receipts: receipts.length,
    continuation: payload.manifest.next_before_sequence ?? null,
    scope: [
      "file checksum",
      "anchor membership hash chains",
      "event-to-anchor hash snapshots",
      "anchor counts and boundaries",
      "receipt-to-anchor linkage",
    ],
    limitation:
      "HMAC authenticity still requires the receiver key and provider records; this tool does not attribute an IP or account to a person.",
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`Evidence verification failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
});
