import { describe, expect, it } from "vitest";

import migrationSql from "../../supabase/migrations/20260720201200_secure_wearable_ingest_execution.sql?raw";

describe("wearable ingest execution hardening", () => {
  it("removes anonymous access while retaining authenticated execution", () => {
    expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.ingest_wearable_metric_samples\(JSONB\)[\s\S]*FROM PUBLIC, anon/i);
    expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.upsert_wearable_sync_state\(TEXT, TEXT, JSONB, TEXT\)[\s\S]*FROM PUBLIC, anon/i);
    expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.ingest_wearable_metric_samples\(JSONB\)[\s\S]*TO authenticated/i);
  });
});
