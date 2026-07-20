BEGIN;

-- These functions authenticate with auth.uid(), so anonymous execution is
-- never useful. Older migrations granted anon explicitly; remove that grant.
REVOKE ALL ON FUNCTION public.ingest_wearable_metric_samples(JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_wearable_sync_state(TEXT, TEXT, JSONB, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ingest_wearable_metric_samples(JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_wearable_sync_state(TEXT, TEXT, JSONB, TEXT)
  TO authenticated;

COMMIT;
