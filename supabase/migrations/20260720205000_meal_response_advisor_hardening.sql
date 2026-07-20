BEGIN;

-- These functions already reject missing auth.uid(), but removing anon at the
-- privilege boundary prevents unnecessary SECURITY DEFINER execution entirely.
REVOKE EXECUTE ON FUNCTION public.revoke_wearable_provider(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rebuild_health_daily_metrics_from_wearables(UUID, DATE) FROM anon;

COMMENT ON TABLE public.meal_response_model_registry IS
  'Private service/admin model registry. RLS intentionally has no client policies; access is through AAL2 admin RPCs.';
COMMENT ON TABLE public.meal_response_model_governance_audit IS
  'Private append-only governance ledger. RLS intentionally has no client policies.';
COMMENT ON TABLE public.meal_response_privacy_actions IS
  'Private idempotency and privacy-action ledger. RLS intentionally has no client policies.';

COMMIT;
