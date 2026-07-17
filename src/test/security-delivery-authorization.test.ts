import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717133000_close_delivery_and_catalog_authorization_gaps.sql",
);
const driverOrderDetail = readRepoFile(
  "src/pages/driver/DriverOrderDetail.tsx",
);
const customerTracker = readRepoFile(
  "src/components/customer/CustomerDeliveryTracker.tsx",
);
const orderDispatch = readRepoFile("src/fleet/services/orderDispatch.ts");
const partnerHandoff = readRepoFile(
  "src/components/partner/PartnerDeliveryHandoff.tsx",
);
const deliveryIntegration = readRepoFile(
  "src/integrations/supabase/delivery.ts",
);
const routeOptimization = readRepoFile(
  "src/fleet/pages/RouteOptimization.tsx",
);
const fleetRealtimeDrivers = readRepoFile(
  "src/fleet/hooks/useFleetRealtimeDrivers.ts",
);

const section = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, start).toBeGreaterThanOrEqual(0);
  expect(endIndex, end).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("delivery and catalog authorization boundaries", () => {
  it("pins every security-definer helper away from caller-writable schemas", () => {
    expect(migration).not.toContain("SET search_path TO public");
  });

  it("stores only salted pickup hashes and consumes one-time capabilities atomically", () => {
    expect(migration).toContain("security.delivery_pickup_capabilities");
    expect(migration).toContain("code_salt TEXT NOT NULL");
    expect(migration).toContain("code_hash TEXT NOT NULL");
    expect(migration).toContain("qr_nonce_hash TEXT NOT NULL");
    expect(migration).toContain("FOR UPDATE OF dj");
    expect(migration).toContain("SET used_at = now()");
    expect(
      migration.match(/accepted_at = COALESCE\(accepted_at, now\(\)\)/g),
    ).toHaveLength(2);
    expect(migration).toContain("delivery_jobs_no_public_pickup_secrets");
    expect(migration).toContain("pickup_verification_code IS NULL");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.verify_pickup_by_code(TEXT, UUID)",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.verify_pickup_by_qr(UUID, TEXT, UUID)",
    );
  });

  it("denies direct delivery mutations and exposes reviewed transition RPCs", () => {
    expect(migration).toContain("CREATE POLICY delivery_jobs_rpc_only_insert");
    expect(migration).toContain("CREATE POLICY delivery_jobs_rpc_only_update");
    expect(migration).toContain("WITH CHECK (false)");
    expect(migration).toContain("DELIVERY_FINANCIAL_FIELDS_REQUIRE_RPC");
    expect(migration).toContain("DELIVERY_STATUS_REQUIRES_RPC");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.transition_delivery_job");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.assign_fleet_delivery_job");
    expect(migration).toContain("SET current_job_id = v_job_id");
    expect(migration).toContain(
      "'driver_transition', 'pickup', 'partner_override', 'verification_refresh',\n       'fleet_assignment'",
    );

    const assignment = section(
      orderDispatch,
      "export async function assignDispatchOrder",
      "export interface AutoDispatchRule",
    );
    expect(assignment).toContain('"assign_fleet_delivery_job"');
    expect(assignment).not.toContain(".from(");
  });

  it("keeps assignment and lifecycle state atomic across jobs and drivers", () => {
    const transition = section(
      migration,
      "CREATE OR REPLACE FUNCTION public.transition_delivery_job",
      "REVOKE ALL ON FUNCTION public.transition_delivery_job",
    );
    expect(transition).toContain("WHEN v_target = 'accepted' THEN COALESCE(accepted_at, now())");
    expect(transition).toContain("WHEN v_target = 'delivered' THEN COALESCE(delivered_at, now())");
    expect(transition).toContain("WHEN v_target = 'failed' THEN COALESCE(failed_at, now())");
    expect(transition).toContain(
      "v_target IN ('pending', 'delivered', 'failed', 'cancelled')",
    );
    expect(transition).toContain("SET current_job_id = NULL");
    expect(transition).toContain("AND current_job_id = v_job.id");

    const fleetAssignment = section(
      migration,
      "CREATE OR REPLACE FUNCTION public.assign_fleet_delivery_job",
      "REVOKE ALL ON FUNCTION public.assign_fleet_delivery_job",
    );
    expect(fleetAssignment).toContain("v_previous_driver_id <> p_driver_id");
    expect(fleetAssignment).toContain(
      "v_job.status NOT IN ('pending', 'assigned', 'accepted')",
    );
    expect(fleetAssignment).toContain(
      "WHEN v_previous_driver_id IS DISTINCT FROM p_driver_id THEN NULL",
    );
    expect(fleetAssignment).toContain("WHERE id = v_previous_driver_id");
    expect(fleetAssignment).toContain("SET current_job_id = v_job_id");
    expect(fleetAssignment).toContain("'unassigned', v_reason");
    expect(fleetAssignment).toContain("'assigned', v_reason");
  });

  it("limits fleet driver writes to operational fields or reviewed scopes", () => {
    const driverBoundary = section(
      migration,
      "CREATE OR REPLACE FUNCTION public.enforce_driver_authorization_boundary",
      "REVOKE ALL ON FUNCTION public.enforce_driver_authorization_boundary",
    );
    expect(driverBoundary).not.toContain(
      "IF v_is_service OR v_is_admin OR v_is_fleet_operator THEN",
    );
    expect(driverBoundary).toContain("DRIVER_CREATION_REQUIRES_REVIEWED_RPC");
    expect(driverBoundary).toContain("FLEET_DRIVER_OPERATIONAL_FIELDS_ONLY");
    expect(driverBoundary).toContain("'fleet_assignment', 'driver_transition'");
    expect(driverBoundary).toContain(
      "'approval_status', 'is_active', 'is_online', 'status'",
    );
    expect(driverBoundary).toContain("DRIVER_FINANCE_SCOPE_VIOLATION");
    expect(driverBoundary).toContain("DELIVERY_ASSIGNMENT_SCOPE_VIOLATION");

    const fleetOperationalBranch = section(
      driverBoundary,
      "IF v_is_fleet_operator THEN\n    IF (to_jsonb(NEW)",
      "IF v_actor IS NULL",
    );
    for (const forbidden of [
      "wallet_balance",
      "total_earnings",
      "payout_details",
      "user_id",
      "email",
      "full_name",
      "phone_number",
      "license_number",
      "current_job_id",
    ]) {
      expect(fleetOperationalBranch).not.toContain(forbidden);
    }
  });

  it("returns only the latest location for the customer's own active delivery", () => {
    const trackingRpc = section(
      migration,
      "CREATE OR REPLACE FUNCTION public.get_customer_delivery_tracking",
      "REVOKE ALL ON FUNCTION public.get_customer_delivery_tracking",
    );
    expect(trackingRpc).toContain("ms.user_id = v_actor");
    expect(trackingRpc).toContain("o.user_id = v_actor");
    expect(trackingRpc).toContain(
      "v_job.status IN ('assigned', 'accepted', 'picked_up', 'in_transit')",
    );
    expect(trackingRpc).toContain("ORDER BY l.timestamp DESC NULLS LAST");
    expect(trackingRpc).toContain("LIMIT 1");
    expect(trackingRpc).toContain(
      ">= COALESCE(v_job.accepted_at, v_job.assigned_at, v_job.created_at)",
    );
    expect(trackingRpc).not.toContain("jsonb_agg");

    expect(customerTracker).toContain('"get_customer_delivery_tracking"');
    for (const table of ["delivery_jobs", "drivers", "driver_locations"]) {
      expect(customerTracker).not.toContain(`.from("${table}")`);
    }
  });

  it("uses AAL2 city-scoped driver and customer projections for fleet dispatch", () => {
    const customerProjection = section(
      migration,
      "CREATE OR REPLACE FUNCTION public.get_fleet_dispatch_customers",
      "CREATE OR REPLACE FUNCTION public.get_fleet_dispatch_drivers",
    );
    const driverProjection = section(
      migration,
      "CREATE OR REPLACE FUNCTION public.get_fleet_dispatch_drivers",
      "REVOKE ALL ON FUNCTION public.get_fleet_dispatch_customers",
    );

    for (const projection of [customerProjection, driverProjection]) {
      expect(projection).toContain("auth.jwt() ->> 'aal'");
      expect(projection).toContain("public.can_manage_fleet_city");
    }
    for (const forbidden of ["email", "wallet_balance", "payout_details", "license_number"]) {
      expect(driverProjection).not.toContain(forbidden);
    }
    expect(customerProjection).toContain("RETURNS TABLE(user_id UUID, full_name TEXT)");
    expect(orderDispatch).toContain('"get_fleet_dispatch_customers"');
    expect(orderDispatch).toContain('"get_fleet_dispatch_drivers"');
    expect(orderDispatch).not.toContain('.from("profiles")');
    expect(orderDispatch).not.toContain('.from("drivers")');
  });

  it("requires AAL2 for every fleet document access path", () => {
    const fleetDocuments = section(
      migration,
      "CREATE OR REPLACE FUNCTION public.can_access_fleet_document_storage",
      "REVOKE ALL ON FUNCTION public.can_access_fleet_document_storage",
    );
    expect(fleetDocuments).toContain("auth.jwt() ->> 'aal'");
    expect(fleetDocuments).toContain("public.can_manage_fleet_city(v_city_id)");
    expect(fleetDocuments).toContain("fm.role = 'super_admin'");
  });

  it("constrains public restaurant photos by role, owner, path, MIME, and size", () => {
    const restaurantPhotos = section(
      migration,
      "-- restaurant-photos ownership, role, path, MIME, and size boundaries",
      "-- Safe public catalog projections",
    );
    expect(restaurantPhotos).toContain("5242880");
    expect(restaurantPhotos).toContain("'image/jpeg', 'image/png', 'image/webp'");
    expect(restaurantPhotos).toContain("p_owner_id = p_user_id::TEXT");
    expect(restaurantPhotos).toContain("cardinality(storage.foldername(p_name)) = 1");
    expect(restaurantPhotos).toContain("'partner'::public.app_role");
    expect(restaurantPhotos).toContain("'restaurant'::public.app_role");
    expect(restaurantPhotos).toContain("public.is_restaurant_operator");
  });

  it("publishes filtered catalog views without internal business fields", () => {
    const restaurantView = section(
      migration,
      "CREATE OR REPLACE VIEW public.public_restaurant_catalog",
      "CREATE OR REPLACE VIEW public.public_meal_catalog",
    );
    const mealView = section(
      migration,
      "CREATE OR REPLACE VIEW public.public_meal_catalog",
      "REVOKE ALL ON public.public_restaurant_catalog",
    );
    const restaurantSelect = section(restaurantView, "SELECT", "FROM public.restaurants");
    const mealSelect = section(mealView, "SELECT", "FROM public.meals");

    for (const forbidden of [
      "owner_id",
      "bank_info",
      "commission_rate",
      "payout_rate",
      "approval_status",
      "rejection_reason",
    ]) {
      expect(restaurantSelect).not.toContain(forbidden);
    }
    for (const forbidden of [
      "estimated_cost",
      "featured_priority",
      "approval_status",
      "deleted_at",
    ]) {
      expect(mealSelect).not.toContain(forbidden);
    }
    expect(migration).toContain(
      "REVOKE SELECT ON public.restaurants, public.meals FROM PUBLIC, anon",
    );
  });

  it("keeps driver pickup and lifecycle changes behind the new RPC surface", () => {
    expect(driverOrderDetail).toContain('"get_delivery_details_for_driver"');
    expect(driverOrderDetail).toContain('"complete_delivery_pickup"');
    expect(driverOrderDetail).toContain('"transition_delivery_job"');
    expect(driverOrderDetail).not.toContain("verify_pickup_by_code");
    expect(driverOrderDetail).not.toContain("verify_pickup_by_qr");
    expect(driverOrderDetail).not.toContain('.from("delivery_jobs")');
  });

  it("keeps partner QR, delivery writes, and fleet tracking on secure capabilities", () => {
    expect(partnerHandoff).toContain('"initialize_delivery_verification"');
    expect(partnerHandoff).toContain("result.qr_nonce");
    expect(partnerHandoff).toContain("value={qrCode}");
    expect(partnerHandoff).not.toContain("setQrCode(deliveryJob.id)");
    expect(partnerHandoff).not.toContain("qrCode || deliveryJob.id");
    expect(partnerHandoff).not.toContain('.from("drivers")');
    expect(partnerHandoff).not.toContain('.select("*")');
    expect(partnerHandoff).not.toContain("postgres_changes");
    expect(partnerHandoff).not.toContain(".channel(");

    expect(deliveryIntegration).toContain('"transition_delivery_job"');
    expect(deliveryIntegration).toContain('"complete_delivery_pickup"');
    expect(deliveryIntegration).toContain('"assign_fleet_delivery_job"');
    expect(deliveryIntegration).not.toMatch(
      /\.from\("delivery_jobs"\)\s*\.update\(/,
    );

    expect(routeOptimization).toContain("getDispatchDrivers");
    expect(routeOptimization).toContain("getDispatchOrders");
    expect(routeOptimization).toContain("assignDispatchOrder");
    expect(routeOptimization).not.toContain('.from("drivers")');
    expect(routeOptimization).not.toContain('.from("delivery_jobs")');

    expect(fleetRealtimeDrivers).toContain("getDispatchDrivers");
    expect(fleetRealtimeDrivers).not.toContain("postgres_changes");
    expect(fleetRealtimeDrivers).not.toContain('.from("drivers")');
    expect(fleetRealtimeDrivers).not.toContain('.from("driver_locations")');
  });
});
