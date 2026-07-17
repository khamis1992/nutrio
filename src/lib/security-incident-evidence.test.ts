import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import {
  formatSha256Checksum,
  incidentEvidenceFilename,
  serializeIncidentPackage,
  sha256Hex,
  verifyPreparedEvidencePackage,
} from "@/lib/security-incident-evidence";

describe("security incident evidence packages", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: webcrypto,
    });
  });

  it("creates a deterministic manifest for the exported case snapshot", () => {
    const serialized = serializeIncidentPackage(
      {
        incident: { case_number: "SEC-2026-0001", title: "Suspicious access" },
        timeline: [{ sequence_number: 1, event_hash: "a".repeat(64) }],
        evidence: [],
      },
      new Date("2026-07-16T12:00:00.000Z"),
    );
    const parsed = JSON.parse(serialized) as {
      manifest: Record<string, string>;
      incident: { case_number: string };
    };

    expect(parsed.manifest).toMatchObject({
      product: "Nutrio",
      case_number: "SEC-2026-0001",
      generated_at: "2026-07-16T12:00:00.000Z",
    });
    expect(parsed.incident.case_number).toBe("SEC-2026-0001");
  });

  it("produces the standard SHA-256 digest", async () => {
    await expect(sha256Hex("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("sanitizes exported filenames and checksum lines", () => {
    const filename = incidentEvidenceFilename("../SEC 2026/1\r\n");
    expect(filename).toBe("SEC_2026_1-evidence.json");
    expect(formatSha256Checksum("a".repeat(64), `${filename}\r\nspoofed`)).toBe(
      `${"a".repeat(64)}  ${filename}__spoofed\n`,
    );
    expect(() => formatSha256Checksum("invalid", filename)).toThrow(
      "Invalid SHA-256 digest",
    );
  });

  it("accepts only the exact server-prepared evidence bytes", async () => {
    const content = "{\n  \"case\": \"NTR-1\"\n}\n";
    const sha256 = await sha256Hex(content);

    await expect(verifyPreparedEvidencePackage({
      content,
      sha256,
      byte_length: new TextEncoder().encode(content).byteLength,
      filename: "NTR-1-evidence.json",
      media_type: "application/json;charset=utf-8",
      format: "json",
      event_count: 2,
      total_count: 2,
      truncated: false,
      integrity: { valid: true },
    })).resolves.toMatchObject({ sha256, truncated: false });
  });

  it("rejects altered bytes, unsafe filenames, and hidden truncation metadata", async () => {
    const content = "evidence\n";
    const sha256 = await sha256Hex(content);
    const base = {
      content,
      sha256,
      byte_length: new TextEncoder().encode(content).byteLength,
      filename: "evidence.csv",
      media_type: "text/csv;charset=utf-8",
      format: "csv",
      event_count: 1,
      total_count: 1,
      truncated: false,
      integrity: { valid: true },
    } as const;

    await expect(verifyPreparedEvidencePackage({
      ...base,
      content: `${content}altered`,
    })).rejects.toThrow("byte length");
    await expect(verifyPreparedEvidencePackage({
      ...base,
      filename: "../evidence.csv",
    })).rejects.toThrow("metadata");
    await expect(verifyPreparedEvidencePackage({
      ...base,
      total_count: 2,
      truncated: false,
    })).rejects.toThrow("metadata");
    await expect(verifyPreparedEvidencePackage({
      ...base,
      integrity: undefined,
    })).rejects.toThrow("metadata");
  });
});
