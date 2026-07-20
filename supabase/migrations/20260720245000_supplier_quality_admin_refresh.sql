-- Remote follow-up: expose refresh only to authenticated callers; the RPC itself
-- requires the central AAL2-protected admin role (or service_role).

BEGIN;
REVOKE ALL ON FUNCTION public.refresh_supplier_quality_snapshots(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_supplier_quality_snapshots(INTEGER) TO authenticated, service_role;
COMMIT;
