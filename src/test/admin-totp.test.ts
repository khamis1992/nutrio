import { describe, expect, it } from "vitest";

import { generateTotp, secondsUntilNextTotp } from "../../e2e/utils/totp";

describe("admin launch-gate TOTP", () => {
  it("matches the RFC 6238 SHA-1 vector at 59 seconds", () => {
    expect(
      generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000),
    ).toBe("287082");
  });

  it("reports the remaining validity window without exposing the secret", () => {
    expect(secondsUntilNextTotp(29_000)).toBe(1);
    expect(secondsUntilNextTotp(30_000)).toBe(30);
  });

  it("rejects malformed secrets", () => {
    expect(() => generateTotp("not-a-totp-secret!", 59_000)).toThrow(
      /valid base32/i,
    );
  });
});
