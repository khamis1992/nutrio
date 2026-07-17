import { describe, expect, it } from "vitest";

import { normalizeExternalUrl } from "@/lib/external-links";

describe("external link validation", () => {
  it("allows normal https links", () => {
    expect(normalizeExternalUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "http://example.com",
    "https://user:password@example.com",
    "not a url",
  ])("rejects unsafe external URL %s", (value) => {
    expect(normalizeExternalUrl(value)).toBeNull();
  });
});
