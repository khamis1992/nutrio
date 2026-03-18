import { lazy, Suspense, useEffect } from "react";
import { initSentry } from "@/lib/sentry";
import { Toaster } from "@/components/ui/sonner";
import { Toaster as RadixToaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AnalyticsProvider } from "@/contexts/AnalyticsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NativeRouteRedirect } from "@/components/NativeRouteRedirect";
import { SessionTimeoutManager } from "@/components/SessionTimeoutManager";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Loader2 } from "lucide-react";
import { fleetRoutes } from "@/fleet/routes";
import CustomerLayout from "@/components/CustomerLayout";

// Critical first-render pages (eager loaded)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy loaded pages - split by feature area
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Customer pages
const WalkthroughScreen = lazy(() => import("./pages/WalkthroughScreen"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Meals = lazy(() => import("./pages/Meals"));
const RestaurantDetail = lazy(() => import("./pages/RestaurantDetail"));
const MealDetail = lazy(() => import("./pages/MealDetail"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Progress = lazy(() => import("./pages/ProgressRedesigned"));
const Tracker = lazy(() => import("./pages/Tracker"));
const WaterTracker = lazy(() => import("./pages/WaterTracker"));
const StepCounter = lazy(() => import("./pages/StepCounter"));
const WeightTracking = lazy(() => import("./pages/WeightTracking"));

const Profile = lazy(() => import("./pages/Profile"));
const Dietary = lazy(() => import("./pages/Dietary"));
const Policies = lazy(() => import("./pages/Policies"));
const PersonalInfo = lazy(() => import("./pages/PersonalInfo"));
const LiveMap = lazy(() => import("./pages/LiveMap"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Settings = lazy(() => import("./pages/Settings"));
const Affiliate = lazy(() => import("./pages/Affiliate"));
const ReferralTracking = lazy(() => import("./pages/ReferralTracking"));
const Addresses = lazy(() => import("./pages/Addresses"));
const Support = lazy(() => import("./pages/Support"));
const Wallet = lazy(() => import("./pages/Wallet"));
const InvoiceHistory = lazy(() => import("./pages/InvoiceHistory"));
const Checkout = lazy(() => import("./pages/Checkout"));

// Partner pages
const PartnerAuth = lazy(() => import("./pages/partner/PartnerAuth"));
const PartnerDashboard = lazy(() => import("./pages/partner/PartnerDashboard"));
const PartnerMenu = lazy(() => import("./pages/partner/PartnerMenu"));
const PartnerOrders = lazy(() => import("./pages/partner/PartnerOrders"));
const PartnerSettings = lazy(() => import("./pages/partner/PartnerSettings"));
const PartnerAnalytics = lazy(() => import("./pages/partner/PartnerAnalytics"));
const PartnerNotifications = lazy(() => import("./pages/partner/PartnerNotifications"));
const PartnerProfile = lazy(() => import("./pages/partner/PartnerProfile"));
const PartnerPayouts = lazy(() => import("./pages/partner/PartnerPayouts"));
const PartnerOnboarding = lazy(() => import("./pages/partner/PartnerOnboarding"));
const PartnerBoost = lazy(() => import("./pages/partner/PartnerBoost"));
const PartnerAddons = lazy(() => import("./pages/partner/PartnerAddons"));
const PendingApproval = lazy(() => import("./pages/partner/PendingApproval"));
const PartnerEarningsDashboard = lazy(() => import("./pages/partner/PartnerEarningsDashboard"));
// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminRestaurants = lazy(() => import("./pages/admin/AdminRestaurants"));
const AdminRestaurantDetail = lazy(() => import("./pages/admin/AdminRestaurantDetail"));
const AdminFeatured = lazy(() => import("./pages/admin/AdminFeatured"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminExports = lazy(() => import("./pages/admin/AdminExports"));
const AdminPayouts = lazy(() => import("./pages/admin/AdminPayouts"));
const AdminAffiliatePayouts = lazy(() => import("./pages/admin/AdminAffiliatePayouts"));
const AdminAffiliateApplications = lazy(() => import("./pages/admin/AdminAffiliateApplications"));
const AdminMilestones = lazy(() => import("./pages/admin/AdminMilestones"));
const AdminDietTags = lazy(() => import("./pages/admin/AdminDietTags"));
const AdminPromotions = lazy(() => import("./pages/admin/AdminPromotions"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminDrivers = lazy(() => import("./pages/admin/AdminDrivers"));
const AdminDeliveries = lazy(() => import("./pages/admin/AdminDeliveries"));
const AdminIPManagement = lazy(() => import("./pages/admin/AdminIPManagement"));
const AdminFreezeManagement = lazy(() => import("./pages/admin/AdminFreezeManagement"));
const AdminRetentionAnalytics = lazy(() => import("./pages/admin/AdminRetentionAnalytics"));
const AdminStreakRewards = lazy(() => import("./pages/admin/AdminStreakRewards"));
const AdminProfitDashboard = lazy(() => import("./pages/admin/AdminProfitDashboard"));
const AdminMealApprovals = lazy(() => import("./pages/admin/AdminMealApprovals"));
const AdminPremiumAnalytics = lazy(() => import("./pages/admin/AdminPremiumAnalytics"));

// Driver pages
const DriverAuth = lazy(() => import("./pages/driver/DriverAuth"));
const DriverOnboarding = lazy(() => import("./pages/driver/DriverOnboarding"));
const DriverDashboard = lazy(() => import("./pages/driver/DriverDashboard"));
const DriverOrders = lazy(() => import("./pages/driver/DriverOrders"));
const DriverOrderDetail = lazy(() => import("./pages/driver/DriverOrderDetail"));
const DriverHistory = lazy(() => import("./pages/driver/DriverHistory"));
const DriverEarnings = lazy(() => import("./pages/driver/DriverEarnings"));
const DriverPayouts = lazy(() => import("./pages/driver/DriverPayouts"));
const DriverProfile = lazy(() => import("./pages/driver/DriverProfile"));
const DriverSettings = lazy(() => import("./pages/driver/DriverSettings"));
const DriverSupport = lazy(() => import("./pages/driver/DriverSupport"));
const DriverNotifications = lazy(() => import("./pages/driver/DriverNotifications"));
const DriverLayout = lazy(() => import("./components/driver/DriverLayout").then(m => ({ default: m.DriverLayout })));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Resets scroll to top on every route change (fixes Capacitor WebView scroll persistence)
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
};

const queryClient = new QueryClient();

// Initialize Sentry error tracking
initSentry();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="top-right" />
      <RadixToaster />
      <BrowserRouter>
        <AuthProvider>
          <AnalyticsProvider>
            <SessionTimeoutManager>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <RouteErrorBoundary>
                <Routes>
            <Route
              path="/"
              element={
                <NativeRouteRedirect>
                  <Index />
                </NativeRouteRedirect>
              }
            />
            <Route path="/walkthrough" element={<WalkthroughScreen />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Onboarding has no dock/nav */}
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

            {/* Live map — no nav bar, full screen */}
            <Route path="/live/:id" element={<ProtectedRoute><LiveMap /></ProtectedRoute>} />

            {/* Customer App Routes - Wrapped with CustomerLayout for background */}
            <Route element={<CustomerLayout />}>
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            {/* Public routes - accessible without login (guest browsing) */}
            <Route path="/meals" element={<Meals />} />
            <Route path="/restaurant/:id" element={<RestaurantDetail />} />
            <Route path="/meals/:id" element={<MealDetail />} />
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
              path="/tracker" 
              element={
                <ProtectedRoute>
                  <Tracker />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/water-tracker" 
              element={
                <ProtectedRoute>
                  <WaterTracker />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/step-counter" 
              element={
                <ProtectedRoute>
                  <StepCounter />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/weight-tracking" 
              element={
                <ProtectedRoute>
                  <WeightTracking />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/goals" 
              element={<Navigate to="/progress?tab=goals" replace />} 
            />
            <Route
              path="/dietary"
              element={
                <ProtectedRoute>
                  <Dietary />
                </ProtectedRoute>
              }
            />
            <Route
              path="/policies"
              element={
                <ProtectedRoute>
                  <Policies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/personal-info"
              element={
                <ProtectedRoute>
                  <PersonalInfo />
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
            <Route path="/orders" element={<Navigate to="/dashboard" replace />} />
            <Route path="/order/:id" element={<Navigate to="/dashboard" replace />} />
            <Route path="/tracking" element={<Navigate to="/dashboard" replace />} />
            <Route 
              path="/subscription" 
              element={
                <ProtectedRoute>
                  <Subscription />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wallet" 
              element={
                <ProtectedRoute>
                  <Wallet />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/checkout" 
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/invoices" 
              element={
                <ProtectedRoute>
                  <InvoiceHistory />
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
              path="/affiliate" 
              element={
                <ProtectedRoute>
                  <Affiliate />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/affiliate/tracking" 
              element={
                <ProtectedRoute>
                  <ReferralTracking />
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
            <Route 
              path="/support" 
              element={
                <ProtectedRoute>
                  <Support />
                </ProtectedRoute>
              } 
            />
            </Route>
            {/* Partner Portal Routes */}
            <Route path="/partner/auth" element={<PartnerAuth />} />
            <Route 
              path="/partner/onboarding" 
              element={
                <ProtectedRoute requiredRole="partner">
                  <PartnerOnboarding />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/menu" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerMenu />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/addons" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerAddons />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/orders"
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerOrders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/settings" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/analytics" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/notifications" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerNotifications />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/profile" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/payouts" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerPayouts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/boost" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerBoost />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/pending-approval" 
              element={
                <ProtectedRoute requiredRole="partner">
                  <PendingApproval />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/earnings" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerEarningsDashboard />
                </ProtectedRoute>
              } 
            />
            {/* Admin Portal Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/restaurants" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminRestaurants />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/restaurants/:id" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminRestaurantDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/featured" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminFeatured />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/meal-approvals" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminMealApprovals />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminUsers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/orders" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminOrders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/subscriptions" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminSubscriptions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/analytics" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/income" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminProfitDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/profit" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminProfitDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/settings" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/exports" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminExports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/payouts" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPayouts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/affiliate-payouts" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAffiliatePayouts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/premium-analytics" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPremiumAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/affiliate-applications" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAffiliateApplications />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/admin/affiliate-milestones"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminMilestones />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/streak-rewards"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminStreakRewards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/diet-tags" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDietTags />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/promotions" 
              element={
                <ProtectedRoute>
                  <AdminPromotions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/announcements" 
              element={<Navigate to="/admin/notifications" replace />} 
            />
            <Route 
              path="/admin/support" 
              element={
                <ProtectedRoute>
                  <AdminSupport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/notifications" 
              element={
                <ProtectedRoute>
                  <AdminNotifications />
                </ProtectedRoute>
              } 
            />
<Route 
  path="/admin/drivers" 
  element={
    <ProtectedRoute>
      <AdminDrivers />
    </ProtectedRoute>
  } 
/>
<Route
  path="/admin/deliveries"
  element={
    <ProtectedRoute>
      <AdminDeliveries />
    </ProtectedRoute>
  }
/>
<Route 
  path="/admin/ip-management" 
  element={
    <ProtectedRoute>
      <AdminIPManagement />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/admin/freeze-management" 
  element={
    <ProtectedRoute>
      <AdminFreezeManagement />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/admin/retention-analytics" 
  element={
    <ProtectedRoute>
      <AdminRetentionAnalytics />
    </ProtectedRoute>
  } 
/>
            {/* Driver Portal Routes */}
            <Route path="/driver/auth" element={<DriverAuth />} />
            <Route 
              path="/driver/onboarding" 
              element={
                <ProtectedRoute>
                  <DriverOnboarding />
                </ProtectedRoute>
              } 
            />
            <Route path="/driver" element={
              <ProtectedRoute>
                <DriverLayout />
              </ProtectedRoute>
            }>
              <Route index element={<DriverDashboard />} />
              <Route path="orders" element={<DriverOrders />} />
              <Route path="orders/:id" element={<DriverOrderDetail />} />
              <Route path="history" element={<DriverHistory />} />
              <Route path="earnings" element={<DriverEarnings />} />
              <Route path="payouts" element={<DriverPayouts />} />
              <Route path="profile" element={<DriverProfile />} />
              <Route path="settings" element={<DriverSettings />} />
              <Route path="support" element={<DriverSupport />} />
              <Route path="notifications" element={<DriverNotifications />} />
            </Route>
            {/* Fleet Management Portal Routes */}
            {fleetRoutes}
            <Route path="*" element={<NotFound />} />
          </Routes>
              </RouteErrorBoundary>
          </Suspense>
          </SessionTimeoutManager>
          </AnalyticsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
