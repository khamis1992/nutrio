import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Supabase API key migration", () => {
  it("does not permit legacy key fallbacks in the Edge runtime", () => {
    const resolver = read("supabase/functions/_shared/supabaseKeys.ts");
    const legacyServerKeyName = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
    const legacyPublicKeyName = ["SUPABASE", "ANON", "KEY"].join("_");

    expect(resolver).toContain('"SUPABASE_SECRET_KEYS"');
    expect(resolver).toContain('"SUPABASE_PUBLISHABLE_KEYS"');
    expect(resolver).toContain('"NUTRIO_ADMIN_KEY"');
    expect(resolver).toContain('"NUTRIO_PUBLIC_KEY"');
    expect(resolver).toContain('"NUTRIO_SUPABASE_SECRET_KEY"');
    expect(resolver).toContain('"NUTRIO_SUPABASE_PUBLISHABLE_KEY"');
    expect(resolver).not.toContain(legacyServerKeyName);
    expect(resolver).not.toContain(legacyPublicKeyName);
  });

  it("requires new keys in deployment and scheduled-worker workflows", () => {
    const workflows = [
      read(".github/workflows/deploy-edge-functions.yml"),
      read(".github/workflows/database-migration.yml"),
      read(".github/workflows/scheduled-security-workers.yml"),
    ].join("\n");
    const legacyServerKeyName = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
    const legacyPublicKeyName = ["SUPABASE", "ANON", "KEY"].join("_");

    expect(workflows).toContain("secrets.SUPABASE_SECRET_KEY");
    expect(workflows).toContain("secrets.SUPABASE_PUBLISHABLE_KEY");
    expect(workflows).not.toContain(legacyServerKeyName);
    expect(workflows).not.toContain(legacyPublicKeyName);
  });
});
