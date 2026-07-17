import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    storage: { from: vi.fn() },
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { uploadSensitiveFile, validatePrivateStorageFile } from "@/lib/private-storage";

const invoke = vi.mocked(supabase.functions.invoke);

describe("sensitive private storage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends sensitive files only through the scan gateway", async () => {
    const path = "11111111-1111-4111-8111-111111111111/report.pdf";
    const file = new File(["%PDF-1.7"], "report.pdf", { type: "application/pdf" });
    invoke.mockResolvedValue({
      data: {
        path,
        sha256: "a".repeat(64),
        scan_status: "clean",
        evidence_id: "scan-evidence-id",
      },
      error: null,
    });

    await expect(uploadSensitiveFile("blood-reports", path, file)).resolves.toMatchObject({
      path,
      scan_status: "clean",
    });

    expect(invoke).toHaveBeenCalledOnce();
    const [functionName, options] = invoke.mock.calls[0];
    expect(functionName).toBe("secure-sensitive-upload");
    expect(options?.body).toBeInstanceOf(FormData);
    const body = options?.body as FormData;
    expect(body.get("bucket")).toBe("blood-reports");
    expect(body.get("path")).toBe(path);
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("fails closed when the gateway returns incomplete scan evidence", async () => {
    invoke.mockResolvedValue({
      data: {
        path: "11111111-1111-4111-8111-111111111111/report.pdf",
        sha256: "not-a-hash",
        scan_status: "clean",
      },
      error: null,
    });

    const file = new File(["%PDF-1.7"], "report.pdf", { type: "application/pdf" });
    await expect(uploadSensitiveFile(
      "blood-reports",
      "11111111-1111-4111-8111-111111111111/report.pdf",
      file,
    )).rejects.toThrow("invalid response");
  });

  it("rejects disallowed types before upload", () => {
    const file = new File(["<html></html>"], "payload.html", { type: "text/html" });
    expect(() => validatePrivateStorageFile(file, ["application/pdf"], 1024)).toThrow(
      "File type not allowed",
    );
  });
});
