import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retry";

describe("withRetry", () => {
  it("returns result on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on second attempt", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("success");

    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after maxAttempts exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent failure"));

    await expect(
      withRetry(fn, { maxAttempts: 3, delayMs: 10 })
    ).rejects.toThrow("persistent failure");

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("non-retryable"));
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(
      withRetry(fn, { maxAttempts: 3, delayMs: 10, shouldRetry })
    ).rejects.toThrow("non-retryable");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
  });

  it("allows retry when shouldRetry returns true", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("retryable"))
      .mockResolvedValueOnce("ok");
    const shouldRetry = vi.fn().mockReturnValue(true);

    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10, shouldRetry });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
  });

  it("defaults maxAttempts to 3", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(withRetry(fn, { delayMs: 10 })).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("returns the last error when all attempts fail", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"));

    await expect(withRetry(fn, { maxAttempts: 3, delayMs: 10 })).rejects.toThrow("fail 3");
  });

  it("works with typed return values", async () => {
    const fn = vi.fn().mockResolvedValue({ id: 1, name: "test" });
    const result = await withRetry(fn);
    expect(result).toEqual({ id: 1, name: "test" });
  });

  it("calls shouldRetry with the actual error", async () => {
    const customError = new Error("custom");
    const fn = vi.fn().mockRejectedValueOnce(customError).mockResolvedValueOnce("ok");
    const shouldRetry = vi.fn().mockReturnValue(true);

    await withRetry(fn, { maxAttempts: 3, delayMs: 10, shouldRetry });
    expect(shouldRetry).toHaveBeenCalledWith(customError);
  });
});