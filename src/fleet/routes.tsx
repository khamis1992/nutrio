import { Route } from "react-router-dom";
import { FleetLayout } from "./components/FleetLayout";
import { ProtectedFleetRoute } from "./components/ProtectedFleetRoute";
import { FleetAuthProvider } from "./context/FleetAuthContext";

// Lazy load all fleet pages
import { lazy } from "react";

const FleetLogin = lazy(() => import("./pages/FleetLogin"));
const FleetDashboard = lazy(() => import("./pages/FleetDashboard"));
const DriverManagement = lazy(() => import("./pages/DriverManagement"));
const DriverDetail = lazy(() => import("./pages/DriverDetail"));
const AddDriver = lazy(() => import("./pages/AddDriver"));
const VehicleManagement = lazy(() => import("./pages/VehicleManagement"));
const LiveTracking = lazy(() => import("./pages/LiveTracking"));
const PayoutManagement = lazy(() => import("./pages/PayoutManagement"));
const PayoutProcessing = lazy(() => import("./pages/PayoutProcessing"));
const RouteOptimization = lazy(() => import("./pages/RouteOptimization"));

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
        <Route path="drivers" element={<DriverManagement />} />
        <Route path="drivers/new" element={<AddDriver />} />
        <Route path="drivers/:id" element={<DriverDetail />} />
        <Route path="vehicles" element={<VehicleManagement />} />
        <Route path="tracking" element={<LiveTracking />} />
        <Route path="routes" element={<RouteOptimization />} />
        <Route path="payouts" element={<PayoutManagement />} />
        <Route path="payouts/process" element={<PayoutProcessing />} />
      </Route>
    </Route>
  </>
);
