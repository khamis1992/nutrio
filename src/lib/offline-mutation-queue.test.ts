import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enqueueOfflineMutation,
  flushOfflineMutations,
  readOfflineMutations,
} from "@/lib/offline-mutation-queue";

describe("offline mutation queue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("deduplicates mutations by their stable request id", () => {
    const mutation = { id: "request-1", kind: "meal-log" as const, userId: "user-1", payload: { name: "Soup" } };
    enqueueOfflineMutation(mutation);
    enqueueOfflineMutation(mutation);

    expect(readOfflineMutations()).toHaveLength(1);
  });

  it("flushes only the active user's handled mutations", async () => {
    enqueueOfflineMutation({ id: "meal-1", kind: "meal-log", userId: "user-1", payload: {} });
    enqueueOfflineMutation({ id: "meal-2", kind: "meal-log", userId: "user-2", payload: {} });
    const handler = vi.fn().mockResolvedValue(undefined);

    await expect(flushOfflineMutations("user-1", { "meal-log": handler })).resolves.toEqual({ synced: 1, remaining: 0 });
    expect(readOfflineMutations().map((item) => item.id)).toEqual(["meal-2"]);
  });

  it("keeps failed mutations and records the retry", async () => {
    enqueueOfflineMutation({ id: "meal-1", kind: "meal-log", userId: "user-1", payload: {} });

    await flushOfflineMutations("user-1", {
      "meal-log": async () => { throw new Error("network unavailable"); },
    });

    expect(readOfflineMutations()[0]).toMatchObject({ attempts: 1, lastError: "network unavailable" });
  });
});
