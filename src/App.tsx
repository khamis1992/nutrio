import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Meals from "./pages/Meals";
import RestaurantDetail from "./pages/RestaurantDetail";
import MealDetail from "./pages/MealDetail";
import Schedule from "./pages/Schedule";
import Progress from "./pages/Progress";
import Profile from "./pages/Profile";
import OrderHistory from "./pages/OrderHistory";
import DeliveryTracking from "./pages/DeliveryTracking";
import Subscription from "./pages/Subscription";
import Notifications from "./pages/Notifications";
import Favorites from "./pages/Favorites";
import Settings from "./pages/Settings";
import Referral from "./pages/Referral";
import Addresses from "./pages/Addresses";
import PartnerDashboard from "./pages/partner/PartnerDashboard";
import PartnerMenu from "./pages/partner/PartnerMenu";
import PartnerOrders from "./pages/partner/PartnerOrders";
import PartnerSettings from "./pages/partner/PartnerSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/onboarding" 
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meals" 
              element={
                <ProtectedRoute>
                  <Meals />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/restaurants/:id" 
              element={
                <ProtectedRoute>
                  <RestaurantDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meals/:id" 
              element={
                <ProtectedRoute>
                  <MealDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/schedule" 
              element={
                <ProtectedRoute>
                  <Schedule />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/progress" 
              element={
                <ProtectedRoute>
                  <Progress />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders" 
              element={
                <ProtectedRoute>
                  <OrderHistory />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tracking" 
              element={
                <ProtectedRoute>
                  <DeliveryTracking />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/subscription" 
              element={
                <ProtectedRoute>
                  <Subscription />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/favorites" 
              element={
                <ProtectedRoute>
                  <Favorites />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/referral" 
              element={
                <ProtectedRoute>
                  <Referral />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/addresses" 
              element={
                <ProtectedRoute>
                  <Addresses />
                </ProtectedRoute>
              } 
            />
            {/* Partner Portal Routes */}
            <Route 
              path="/partner" 
              element={
                <ProtectedRoute>
                  <PartnerDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/menu" 
              element={
                <ProtectedRoute>
                  <PartnerMenu />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/orders" 
              element={
                <ProtectedRoute>
                  <PartnerOrders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/settings" 
              element={
                <ProtectedRoute>
                  <PartnerSettings />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
