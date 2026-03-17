import { Route, Navigate } from "react-router-dom";
import { FleetLayout } from "./components/FleetLayout";
import { ProtectedFleetRoute } from "./components/ProtectedFleetRoute";
import { FleetAuthProvider } from "./context/FleetAuthContext";

// Lazy load all fleet pages
import { lazy } from "react";

const FleetLogin = lazy(() => import("./pages/FleetLogin"));
const FleetDashboard = lazy(() => import("./pages/FleetDashboard"));
const DispatchCenter = lazy(() => import("./pages/DispatchCenter"));
const DriverManagement = lazy(() => import("./pages/DriverManagement"));
const DriverDetail = lazy(() => import("./pages/DriverDetail"));
const AddDriver = lazy(() => import("./pages/AddDriver"));
const VehicleManagement = lazy(() => import("./pages/VehicleManagement"));
const LiveTracking = lazy(() => import("./pages/LiveTracking"));
const PayoutManagement = lazy(() => import("./pages/PayoutManagement"));
const PayoutProcessing = lazy(() => import("./pages/PayoutProcessing"));
const FleetAnalytics = lazy(() => import("./pages/FleetAnalytics"));
const BranchOrders = lazy(() => import("./pages/BranchOrders"));

export const fleetRoutes = (
  <>
    <Route path="/fleet/login" element={<FleetLogin />} />
    <Route element={
      <FleetAuthProvider>
        <ProtectedFleetRoute />
      </FleetAuthProvider>
    }>
      <Route path="/fleet" element={<FleetLayout />}>
        <Route index element={<FleetDashboard />} />

        {/* Unified dispatch hub */}
        <Route path="dispatch" element={<DispatchCenter />} />

        {/* Legacy redirects — old bookmarks / links still work */}
        <Route path="orders" element={<Navigate to="/fleet/dispatch?tab=live" replace />} />
        <Route path="routes" element={<Navigate to="/fleet/dispatch?tab=bulk" replace />} />
        <Route path="auto-dispatch" element={<Navigate to="/fleet/dispatch?tab=rules" replace />} />

        <Route path="drivers" element={<DriverManagement />} />
        <Route path="drivers/new" element={<AddDriver />} />
        <Route path="drivers/:id" element={<DriverDetail />} />
        <Route path="vehicles" element={<VehicleManagement />} />
        <Route path="tracking" element={<LiveTracking />} />
        <Route path="payouts" element={<PayoutManagement />} />
        <Route path="payouts/process" element={<PayoutProcessing />} />
        <Route path="analytics" element={<FleetAnalytics />} />
        <Route path="branch-orders" element={<BranchOrders />} />
      </Route>
    </Route>
  </>
);
