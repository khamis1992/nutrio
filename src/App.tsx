import { lazy, Suspense, useEffect } from "react";
import { isNative } from "@/lib/capacitor";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AnalyticsProvider } from "@/contexts/AnalyticsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SessionTimeoutManager } from "@/components/SessionTimeoutManager";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Loader2 } from "lucide-react";
import { fleetRoutes } from "@/fleet/routes";
import { customerRoutes } from "@/customer/routes";
import CustomerLayout from "@/components/CustomerLayout";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy loaded pages - split by feature area
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const GoogleFitCallback = lazy(() => import("./pages/GoogleFitCallback"));

// Customer pages (used outside CustomerLayout)
const WalkthroughScreen = lazy(() => import("./pages/WalkthroughScreen"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const LiveMap = lazy(() => import("./pages/LiveMap"));

// Partner pages
const PartnerAuth = lazy(() => import("./pages/partner/PartnerAuth"));
const PartnerDashboard = lazy(() => import("./pages/partner/PartnerDashboard"));
const PartnerMenu = lazy(() => import("./pages/partner/PartnerMenu"));
const PartnerOrders = lazy(() => import("./pages/partner/PartnerOrders"));
const PartnerSettings = lazy(() => import("./pages/partner/PartnerSettings"));
const PartnerAnalytics = lazy(() => import("./pages/partner/PartnerAnalytics"));
const PartnerNotifications = lazy(() => import("./pages/partner/PartnerNotifications"));
const PartnerReviews = lazy(() => import("./pages/partner/PartnerReviews"));
const PartnerProfile = lazy(() => import("./pages/partner/PartnerProfile"));
const PartnerPayouts = lazy(() => import("./pages/partner/PartnerPayouts"));
const PartnerOnboarding = lazy(() => import("./pages/partner/PartnerOnboarding"));
const PartnerBoost = lazy(() => import("./pages/partner/PartnerBoost"));
const PendingApproval = lazy(() => import("./pages/partner/PendingApproval"));
const PartnerEarningsDashboard = lazy(() => import("./pages/partner/PartnerEarningsDashboard"));
const PartnerPortalShell = lazy(() => import("./components/PartnerLayout").then(m => ({ default: m.PartnerPortalShell })));
const SportHubWelcome = lazy(() => import("./pages/partners/SportHubWelcome"));
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
const AdminCustomerWallets = lazy(() => import("./pages/admin/AdminCustomerWallets"));
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
const AdminSecurityCenter = lazy(() => import("./pages/admin/AdminSecurityCenter"));
const AdminFreezeManagement = lazy(() => import("./pages/admin/AdminFreezeManagement"));
const AdminRetentionAnalytics = lazy(() => import("./pages/admin/AdminRetentionAnalytics"));
const FreezeManagementPanel = lazy(() => import("./pages/admin/subscriptions/FreezeManagementPanel"));
const RolloverAuditLogViewer = lazy(() => import("./pages/admin/audit/RolloverAuditLogViewer"));
const RetentionAnalyticsDashboard = lazy(() => import("./pages/admin/analytics/RetentionAnalyticsDashboard"));
const AdminStreakRewards = lazy(() => import("./pages/admin/AdminStreakRewards"));
const AdminCommunityChallenges = lazy(() => import("./pages/admin/AdminCommunityChallenges"));
const AdminProfitDashboard = lazy(() => import("./pages/admin/AdminProfitDashboard"));
const AdminMealApprovals = lazy(() => import("./pages/admin/AdminMealApprovals"));
const AdminNutritionQuality = lazy(() => import("./pages/admin/AdminNutritionQuality"));
const AdminHealthPrograms = lazy(() => import("./pages/admin/AdminHealthPrograms"));
const AdminCorporateBenefits = lazy(() => import("./pages/admin/AdminCorporateBenefits"));
const AdminPremiumAnalytics = lazy(() => import("./pages/admin/AdminPremiumAnalytics"));
const AdminCoachApprovals = lazy(() => import("./pages/admin/AdminCoachApprovals"));
const AdminCoachCommission = lazy(() => import("./pages/admin/AdminCoachCommission"));
const AdminPartnerIntegrations = lazy(() => import("./pages/admin/AdminPartnerIntegrations"));
const AdminPortalShell = lazy(() => import("./components/AdminLayout").then(m => ({ default: m.AdminPortalShell })));

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
const CoachDashboard = lazy(() => import("./pages/coach/CoachDashboard"));
const CoachInsights = lazy(() => import("./pages/coach/CoachInsights"));
const CoachSettings = lazy(() => import("./pages/coach/CoachSettings"));
const CoachChatPage = lazy(() => import("./pages/coach/CoachChatPage"));
const CoachClientDetail = lazy(() => import("./pages/coach/CoachClientDetail"));
const CoachEarningsPage = lazy(() => import("./pages/coach/CoachEarningsPage"));
const CoachPortalLayout = lazy(() => import("./components/coach/CoachPortalLayout").then(m => ({ default: m.CoachPortalLayout })));
const CoachSchedule = lazy(() => import("./pages/coach/CoachSchedule"));
const AdminAIEngineMonitor = lazy(() => import("./pages/admin/AdminAIEngineMonitor"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const AppContentLoader = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="top-center" />
      <BrowserRouter basename={isNative ? undefined : "/nutrio"}>
        <AuthProvider>
          <AnalyticsProvider>
            <SessionTimeoutManager>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <RouteErrorBoundary>
                <Routes>
            <Route
              path="/"
              element={<Navigate to="/auth" replace />}
            />
            <Route path="/walkthrough" element={<WalkthroughScreen />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/sporthub" element={<SportHubWelcome />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/auth/google-fit/callback"
              element={<ProtectedRoute><GoogleFitCallback /></ProtectedRoute>}
            />
            
            {/* Onboarding has no dock/nav */}
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

            {/* Live map — no nav bar, full screen */}
            <Route path="/live/:id" element={<ProtectedRoute><LiveMap /></ProtectedRoute>} />

            {/* Customer App Routes */}
            <Route element={<CustomerLayout />}>
              {customerRoutes}
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
                  <Suspense fallback={<AppContentLoader />}>
                    <PartnerPortalShell />
                  </Suspense>
                </ProtectedRoute>
              }
            >
              <Route index element={<PartnerDashboard />} />
              <Route path="menu" element={<PartnerMenu />} />
              <Route path="addons" element={<Navigate to="/partner/menu?tab=addons" replace />} />
              <Route path="orders" element={<PartnerOrders />} />
              <Route path="settings" element={<PartnerSettings />} />
              <Route path="analytics" element={<PartnerAnalytics />} />
              <Route path="notifications" element={<PartnerNotifications />} />
              <Route path="reviews" element={<PartnerReviews />} />
              <Route path="profile" element={<PartnerProfile />} />
              <Route path="payouts" element={<PartnerPayouts />} />
              <Route path="boost" element={<PartnerBoost />} />
              <Route path="earnings" element={<PartnerEarningsDashboard />} />
            </Route>
            <Route 
              path="/partner/pending-approval" 
              element={
                <ProtectedRoute requiredRole="partner">
                  <PendingApproval />
                </ProtectedRoute>
              } 
            />
            {/* Admin Portal Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Suspense fallback={<AppContentLoader />}>
                    <AdminPortalShell />
                  </Suspense>
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="restaurants" element={<AdminRestaurants />} />
              <Route path="restaurants/:id" element={<AdminRestaurantDetail />} />
              <Route path="featured" element={<AdminFeatured />} />
              <Route path="meal-approvals" element={<AdminMealApprovals />} />
              <Route path="nutrition-quality" element={<AdminNutritionQuality />} />
              <Route path="health-programs" element={<AdminHealthPrograms />} />
              <Route path="corporate-benefits" element={<AdminCorporateBenefits />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:userId" element={<AdminUsers />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="income" element={<Navigate to="/admin/profit" replace />} />
              <Route path="profit" element={<AdminProfitDashboard />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="exports" element={<AdminExports />} />
              <Route path="payouts" element={<AdminPayouts />} />
              <Route path="customer-wallets" element={<AdminCustomerWallets />} />
              <Route path="affiliate-payouts" element={<AdminAffiliatePayouts />} />
              <Route path="premium-analytics" element={<AdminPremiumAnalytics />} />
              <Route path="affiliate-applications" element={<AdminAffiliateApplications />} />
              <Route path="partner-integrations" element={<AdminPartnerIntegrations />} />
              <Route path="affiliate-milestones" element={<AdminMilestones />} />
              <Route path="streak-rewards" element={<AdminStreakRewards />} />
              <Route path="community-challenges" element={<AdminCommunityChallenges />} />
              <Route path="diet-tags" element={<AdminDietTags />} />
              <Route path="promotions" element={<AdminPromotions />} />
              <Route path="announcements" element={<Navigate to="/admin/notifications" replace />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="drivers" element={<AdminDrivers />} />
              <Route path="deliveries" element={<AdminDeliveries />} />
              <Route path="ip-management" element={<AdminIPManagement />} />
              <Route path="security" element={<AdminSecurityCenter />} />
              <Route path="freeze-management" element={<AdminFreezeManagement />} />
              <Route path="subscriptions/freezes" element={<FreezeManagementPanel />} />
              <Route path="retention-analytics" element={<AdminRetentionAnalytics />} />
              <Route path="audit/rollovers" element={<RolloverAuditLogViewer />} />
              <Route path="analytics/retention" element={<RetentionAnalyticsDashboard />} />
              <Route path="coach-applications" element={<AdminCoachApprovals />} />
              <Route path="coach-commission" element={<AdminCoachCommission />} />
              <Route path="ai-engine" element={<AdminAIEngineMonitor />} />
            </Route>
            {/* Driver Portal Routes */}
            <Route path="/driver/auth" element={<DriverAuth />} />
            <Route 
              path="/driver/onboarding" 
              element={
                <ProtectedRoute requiredRole="driver">
                  <DriverOnboarding />
                </ProtectedRoute>
              } 
            />
            <Route path="/driver" element={
              <ProtectedRoute requiredRole="driver">
                <Suspense fallback={<AppContentLoader />}>
                  <DriverLayout />
                </Suspense>
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
            {/* Coach Portal Routes */}
            <Route path="/coach" element={
              <ProtectedRoute requiredRole="coach">
                <Suspense fallback={<AppContentLoader />}>
                  <CoachPortalLayout />
                </Suspense>
              </ProtectedRoute>
            }>
              <Route index element={<CoachDashboard />} />
              <Route path="insights" element={<CoachInsights />} />
              <Route path="chat" element={<CoachChatPage />} />
              <Route path="earnings" element={<CoachEarningsPage />} />
              <Route path="settings" element={<CoachSettings />} />
              <Route path="client/:clientId" element={<CoachClientDetail />} />
              <Route path="schedule" element={<CoachSchedule />} />
            </Route>
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
