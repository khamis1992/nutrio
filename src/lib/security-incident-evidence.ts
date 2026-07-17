type IncidentEvidenceSource = {
  incident: {
    case_number: string;
  };
};

export type PreparedEvidencePackage = {
  content: string;
  sha256: string;
  byte_length: number;
  filename: string;
  media_type: string;
  format: "json" | "csv";
  event_count: number;
  total_count: number;
  truncated: boolean;
  has_more?: boolean;
  next_before_sequence?: number | string | null;
  integrity?: {
    valid?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export function serializeIncidentPackage<T extends IncidentEvidenceSource>(
  detail: T,
  generatedAt = new Date(),
): string {
  const payload = {
    ...detail,
    manifest: {
      product: "Nutrio",
      case_number: detail.incident.case_number,
      generated_at: generatedAt.toISOString(),
      notice:
        "Technical identifiers support correlation but do not independently prove a person's identity.",
      custody:
        "Preserve this original file. Its detached SHA-256 is recorded in the Nutrio case timeline and companion checksum file.",
    },
  };

  return JSON.stringify(payload, null, 2);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
}

export async function verifyPreparedEvidencePackage(
  value: unknown,
): Promise<PreparedEvidencePackage> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Evidence package response is invalid");
  }

  const candidate = value as Partial<PreparedEvidencePackage>;
  const byteLength = Number(candidate.byte_length);
  const eventCount = Number(candidate.event_count);
  const totalCount = Number(candidate.total_count);
  const mediaMatchesFormat =
    (candidate.format === "json" &&
      candidate.media_type === "application/json;charset=utf-8" &&
      candidate.filename?.toLowerCase().endsWith(".json")) ||
    (candidate.format === "csv" &&
      candidate.media_type === "text/csv;charset=utf-8" &&
      candidate.filename?.toLowerCase().endsWith(".csv"));
  const cursorBased = typeof candidate.has_more === "boolean";
  const nextSequence = candidate.next_before_sequence == null
    ? null
    : Number(candidate.next_before_sequence);
  if (
    typeof candidate.content !== "string" ||
    typeof candidate.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(candidate.sha256) ||
    typeof candidate.filename !== "string" ||
    candidate.filename.length < 3 ||
    candidate.filename.length > 180 ||
    /[\\/]/.test(candidate.filename) ||
    containsControlCharacter(candidate.filename) ||
    !mediaMatchesFormat ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0 ||
    byteLength > 20 * 1024 * 1024 ||
    !Number.isSafeInteger(eventCount) ||
    eventCount < 0 ||
    !Number.isSafeInteger(totalCount) ||
    totalCount < eventCount ||
    typeof candidate.truncated !== "boolean" ||
    (
      cursorBased
        ? candidate.truncated !== candidate.has_more ||
          (candidate.has_more
            ? !Number.isSafeInteger(nextSequence) || Number(nextSequence) < 1
            : nextSequence !== null)
        : candidate.truncated !== (totalCount > eventCount)
    ) ||
    !candidate.integrity ||
    typeof candidate.integrity !== "object" ||
    Array.isArray(candidate.integrity) ||
    typeof candidate.integrity.valid !== "boolean"
  ) {
    throw new Error("Evidence package metadata is invalid");
  }

  const contentBytes = new TextEncoder().encode(candidate.content);
  if (contentBytes.byteLength !== Number(candidate.byte_length)) {
    throw new Error("Evidence package byte length does not match");
  }
  const calculatedHash = await sha256Hex(candidate.content);
  if (calculatedHash !== candidate.sha256) {
    throw new Error("Evidence package checksum does not match");
  }

  return {
    ...candidate,
    content: candidate.content,
    sha256: candidate.sha256,
    byte_length: byteLength,
    filename: candidate.filename,
    media_type: candidate.media_type as PreparedEvidencePackage["media_type"],
    format: candidate.format as PreparedEvidencePackage["format"],
    event_count: eventCount,
    total_count: totalCount,
    truncated: candidate.truncated,
    has_more: cursorBased ? candidate.has_more : undefined,
    next_before_sequence: cursorBased ? nextSequence : undefined,
  } as PreparedEvidencePackage;
}

export function incidentEvidenceFilename(caseNumber: string): string {
  const safeCaseNumber = caseNumber
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, 120);

  return `${safeCaseNumber || "security-incident"}-evidence.json`;
}

export function formatSha256Checksum(hash: string, filename: string): string {
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error("Invalid SHA-256 digest");
  }

  const safeFilename = filename.replace(/[\r\n]/g, "_");
  return `${hash}  ${safeFilename}\n`;
}
